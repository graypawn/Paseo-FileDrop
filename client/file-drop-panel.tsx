import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { abortUpload, beginUpload, completeUpload, uploadChunk } from "../shared/upload-rpc";
import { chooseFile, encodeBase64, sha256, type BrowserFile } from "./web";

type Status = { kind: "idle" | "working" | "success" | "error"; message: string };

export function FileDropPanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const workspace = useWorkspace(workspaceId, ({ directory, name }) => ({ directory, name }));
  const begin = useRpc(beginUpload);
  const sendChunk = useRpc(uploadChunk);
  const complete = useRpc(completeUpload);
  const abort = useRpc(abortUpload);
  const [directory, setDirectory] = useState("uploads");
  const [file, setFile] = useState<BrowserFile | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "Choose one file to upload." });
  const styles = useMemo(
    () => ({
      screen: { flex: 1, padding: layout.compact ? 16 : 24, gap: 12, backgroundColor: theme.colors.surface0 },
      title: { color: theme.colors.foreground, fontSize: 20, fontWeight: "600" as const },
      text: { color: theme.colors.foreground },
      muted: { color: theme.colors.foregroundMuted },
      input: { color: theme.colors.foreground, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 6, padding: 10 },
      button: { backgroundColor: theme.colors.accent, borderRadius: 6, padding: 12, alignItems: "center" as const },
      disabled: { opacity: 0.5 },
      buttonText: { color: theme.colors.accentForeground, fontWeight: "600" as const },
      error: { color: theme.colors.statusDanger },
      success: { color: theme.colors.statusSuccess },
    }),
    [layout.compact, theme],
  );

  const selectFile = async () => {
    const selected = await chooseFile();
    if (!selected) return;
    setFile(selected);
    setStatus({ kind: "idle", message: `${selected.name} (${selected.size.toLocaleString()} bytes)` });
  };

  const upload = async () => {
    if (!file || !workspace) return;
    setStatus({ kind: "working", message: "Preparing upload…" });
    let uploadId: string | null = null;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const session = await begin({ workspaceId, directory, name: file.name, size: bytes.byteLength, contentType: file.type || null });
      uploadId = session.uploadId;
      for (let offset = 0, index = 0; offset < bytes.length; offset += session.chunkBytes, index += 1) {
        const chunk = bytes.slice(offset, offset + session.chunkBytes);
        await sendChunk({ uploadId: session.uploadId, index, data: encodeBase64(chunk), sha256: await sha256(chunk) });
        setStatus({ kind: "working", message: `Uploading… ${Math.min(offset + chunk.length, bytes.length).toLocaleString()} / ${bytes.length.toLocaleString()} bytes` });
      }
      const result = await complete({ uploadId: session.uploadId, sha256: await sha256(bytes) });
      uploadId = null;
      setStatus({ kind: "success", message: `Saved ${result.relativePath} (${result.size.toLocaleString()} bytes).` });
    } catch (error) {
      if (uploadId) void abort({ uploadId });
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Upload failed." });
    }
  };

  const disabled = status.kind === "working";
  const statusStyle = status.kind === "error" ? styles.error : status.kind === "success" ? styles.success : styles.muted;
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Upload to {workspace?.name ?? "workspace"}</Text>
      <Text style={styles.muted}>Files stay inside this workspace. Existing files are never overwritten.</Text>
      <Text style={styles.text}>Destination directory (relative to the workspace)</Text>
      <TextInput accessibilityLabel="Destination directory" value={directory} onChangeText={setDirectory} style={styles.input} editable={!disabled} />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose file" onPress={() => void selectFile()} style={[styles.button, disabled && styles.disabled]} disabled={disabled}>
        <Text style={styles.buttonText}>{file ? "Choose another file" : "Choose file"}</Text>
      </Pressable>
      <Text style={statusStyle}>{status.message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Upload file" onPress={() => void upload()} style={[styles.button, (!file || disabled) && styles.disabled]} disabled={!file || disabled}>
        <Text style={styles.buttonText}>{disabled ? "Uploading…" : "Upload"}</Text>
      </Pressable>
    </View>
  );
}
