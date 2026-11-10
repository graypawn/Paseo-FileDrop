import { createHash, randomUUID } from "node:crypto";
import { appendFile, link, lstat, mkdir, realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { CHUNK_BYTES, abortUpload, beginUpload, completeUpload, uploadChunk } from "../shared/upload-rpc";

type BeginInput = RpcInput<typeof beginUpload>;
type ChunkInput = RpcInput<typeof uploadChunk>;
type CompleteInput = RpcInput<typeof completeUpload>;
type AbortInput = RpcInput<typeof abortUpload>;

type UploadSession = {
  root: string;
  target: string;
  temporary: string;
  expectedSize: number;
  received: number;
  nextIndex: number;
  hash: ReturnType<typeof createHash>;
  expiresAt: number;
};

const SESSION_TTL_MS = 10 * 60 * 1000;

function rejectUnsafePath(value: string, label: string): void {
  if (value.includes("\0") || path.isAbsolute(value)) throw new Error(`${label} must be a relative path.`);
  for (const part of value.split(/[\\/]/)) {
    if (part === "." || part === "..") throw new Error(`${label} cannot contain . or .. segments.`);
  }
}

function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("Chunk is not valid Base64.");
  }
  return Buffer.from(value, "base64");
}

async function ensureDirectoryBelow(root: string, relativeDirectory: string): Promise<string> {
  let current = root;
  for (const part of relativeDirectory.split(/[\\/]/).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Upload directory contains a symbolic link or is not a directory.");
    } catch (error: unknown) {
      if (!(error as NodeJS.ErrnoException).code || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current);
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Could not create a safe upload directory.");
    }
  }
  const resolved = await realpath(current);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error("Upload directory escapes the workspace.");
  return resolved;
}

export class UploadService {
  private readonly sessions = new Map<string, UploadSession>();

  begin = async (input: BeginInput, { paseo }: PluginHandlerContext) => {
    rejectUnsafePath(input.directory, "Directory");
    rejectUnsafePath(input.name, "File name");
    if (path.basename(input.name) !== input.name) throw new Error("File name cannot contain a path separator.");

    const workspace = await paseo.workspaces.ref(input.workspaceId).refresh();
    if (!workspace?.workspaceDirectory) throw new Error("Workspace is unavailable or has no project directory.");

    const root = await realpath(workspace.workspaceDirectory);
    const destinationDirectory = await ensureDirectoryBelow(root, input.directory);
    const target = path.join(destinationDirectory, input.name);
    const temporary = path.join(destinationDirectory, `.paseo-filedrop-${randomUUID()}.part`);

    try {
      await lstat(target);
      throw new Error("A file with this name already exists.");
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const id = randomUUID();
    this.sessions.set(id, {
      root,
      target,
      temporary,
      expectedSize: input.size,
      received: 0,
      nextIndex: 0,
      hash: createHash("sha256"),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { uploadId: id, chunkBytes: CHUNK_BYTES };
  };

  writeChunk = async (input: ChunkInput) => {
    const session = this.requireSession(input.uploadId);
    if (input.index !== session.nextIndex) throw new Error("Chunk arrived out of order.");
    const bytes = decodeBase64(input.data);
    if (bytes.length > CHUNK_BYTES) throw new Error("Chunk exceeds the configured size.");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== input.sha256.toLowerCase()) throw new Error("Chunk hash does not match.");
    if (session.received + bytes.length > session.expectedSize) throw new Error("Upload exceeds its declared size.");

    await appendFile(session.temporary, bytes, { flag: session.received === 0 ? "wx" : "a" });
    session.hash.update(bytes);
    session.received += bytes.length;
    session.nextIndex += 1;
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return { received: session.received };
  };

  complete = async (input: CompleteInput) => {
    const session = this.requireSession(input.uploadId);
    try {
      if (session.received !== session.expectedSize) throw new Error("Upload size does not match its declaration.");
      const sha256 = session.hash.digest("hex");
      if (sha256 !== input.sha256.toLowerCase()) throw new Error("Final file hash does not match.");
      await link(session.temporary, session.target);
      await unlink(session.temporary);
      this.sessions.delete(input.uploadId);
      return { relativePath: path.relative(session.root, session.target), size: session.received, sha256 };
    } catch (error) {
      await this.removeSession(input.uploadId, session);
      throw error;
    }
  };

  abort = async (input: AbortInput) => {
    const session = this.sessions.get(input.uploadId);
    if (!session) return { aborted: false };
    await this.removeSession(input.uploadId, session);
    return { aborted: true };
  };

  async dispose(): Promise<void> {
    await Promise.all([...this.sessions].map(([id, session]) => this.removeSession(id, session)));
  }

  private requireSession(id: string): UploadSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Upload session was not found.");
    if (session.expiresAt < Date.now()) {
      void this.removeSession(id, session);
      throw new Error("Upload session expired.");
    }
    return session;
  }

  private async removeSession(id: string, session: UploadSession): Promise<void> {
    this.sessions.delete(id);
    await rm(session.temporary, { force: true });
  }
}
