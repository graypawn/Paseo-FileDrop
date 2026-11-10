import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { abortUpload, beginUpload, completeUpload, MAX_FILE_BYTES, uploadChunk } from "../shared/upload-rpc";
import { chooseFile, encodeBase64, sha256, type BrowserFile } from "./web";

type Status = { kind: "idle" | "working" | "success" | "error"; message: string };

export function FileDropPanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const begin = useRpc(beginUpload);
  const sendChunk = useRpc(uploadChunk);
  const complete = useRpc(completeUpload);
  const abort = useRpc(abortUpload);
  const [directory, setDirectory] = useState("uploads");
  const [file, setFile] = useState<BrowserFile | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" });
  const styles = useMemo(
    () => ({
      screen: { flex: 1, padding: layout.compact ? 16 : 24, gap: 16, backgroundColor: theme.colors.surface0 },
      title: { color: theme.colors.foreground, fontSize: 20, fontWeight: "600" as const },
      text: { color: theme.colors.foreground },
      muted: { color: theme.colors.foregroundMuted },
      file: { color: theme.colors.foreground, backgroundColor: theme.colors.surface1, borderRadius: 6, padding: 12 },
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
    setStatus({ kind: "idle", message: "" });
  };

  const upload = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: "error", message: "파일은 10MB 이하만 업로드할 수 있습니다." });
      return;
    }
    setStatus({ kind: "working", message: "업로드 준비 중…" });
    let uploadId: string | null = null;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const session = await begin({ workspaceId, directory, name: file.name, size: bytes.byteLength, contentType: file.type || null });
      uploadId = session.uploadId;
      for (let offset = 0, index = 0; offset < bytes.length; offset += session.chunkBytes, index += 1) {
        const chunk = bytes.slice(offset, offset + session.chunkBytes);
        await sendChunk({ uploadId: session.uploadId, index, data: encodeBase64(chunk), sha256: await sha256(chunk) });
        setStatus({ kind: "working", message: `업로드 중… ${formatSize(Math.min(offset + chunk.length, bytes.length))} / ${formatSize(bytes.length)}` });
      }
      const result = await complete({ uploadId: session.uploadId, sha256: await sha256(bytes) });
      uploadId = null;
      setStatus({ kind: "success", message: `${result.relativePath}에 저장했습니다.` });
    } catch (error) {
      if (uploadId) void abort({ uploadId });
      setStatus({ kind: "error", message: uploadErrorMessage(error) });
    }
  };

  const disabled = status.kind === "working";
  const statusStyle = status.kind === "error" ? styles.error : status.kind === "success" ? styles.success : styles.muted;
  return (
    <View style={styles.screen}>
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>파일 업로드</Text>
        <Text style={styles.muted}>현재 프로젝트에 파일을 올립니다.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="파일 선택" onPress={() => void selectFile()} style={[styles.button, disabled && styles.disabled]} disabled={disabled}>
        <Text style={styles.buttonText}>{file ? "다른 파일 선택" : "파일 선택"}</Text>
      </Pressable>
      {file ? <Text style={styles.file}>{file.name} · {formatSize(file.size)}</Text> : null}
      <View style={{ gap: 6 }}>
        <Text style={styles.text}>저장할 폴더</Text>
        <TextInput accessibilityLabel="저장할 폴더" placeholder="예: uploads" placeholderTextColor={theme.colors.foregroundMuted} value={directory} onChangeText={setDirectory} style={styles.input} editable={!disabled} />
        <Text style={styles.muted}>비워두면 프로젝트 최상위 폴더에 저장합니다.</Text>
      </View>
      {status.message ? <Text style={statusStyle}>{status.message}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="업로드" onPress={() => void upload()} style={[styles.button, (!file || disabled) && styles.disabled]} disabled={!file || disabled}>
        <Text style={styles.buttonText}>{disabled ? "업로드 중…" : "업로드"}</Text>
      </Pressable>
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function uploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("already exists")) return "같은 이름의 파일이 이미 있습니다.";
  if (message.includes("relative path") || message.includes("path separator")) return "저장할 폴더 또는 파일 이름을 확인하세요.";
  if (message.includes("exceeds") || message.includes("declared size")) return "파일 크기가 허용 범위를 벗어났습니다.";
  return "업로드하지 못했습니다. 다시 시도하세요.";
}
