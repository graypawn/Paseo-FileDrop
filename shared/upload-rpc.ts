import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CHUNK_BYTES = 256 * 1024;

const uploadId = z.string().uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 digest");

export const beginUpload = defineRpc({
  name: "filedrop.begin",
  input: z.object({
    workspaceId: z.string().min(1),
    directory: z.string().max(512),
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(MAX_FILE_BYTES),
    contentType: z.string().max(255).nullable(),
  }),
  output: z.object({ uploadId, chunkBytes: z.number().int().positive() }),
});

export const uploadChunk = defineRpc({
  name: "filedrop.chunk",
  input: z.object({
    uploadId,
    index: z.number().int().min(0),
    data: z.string().min(1).max(400_000),
    sha256: digest,
  }),
  output: z.object({ received: z.number().int().nonnegative() }),
});

export const completeUpload = defineRpc({
  name: "filedrop.complete",
  input: z.object({ uploadId, sha256: digest }),
  output: z.object({ relativePath: z.string(), size: z.number().int().positive(), sha256: digest }),
});

export const abortUpload = defineRpc({
  name: "filedrop.abort",
  input: z.object({ uploadId }),
  output: z.object({ aborted: z.boolean() }),
});
