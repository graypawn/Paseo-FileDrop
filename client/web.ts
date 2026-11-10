import { Platform } from "react-native";

declare const document: {
  createElement(tag: "input"): {
    type: string;
    multiple: boolean;
    onchange: (() => void) | null;
    files: { item(index: number): BrowserFile | null } | null;
    click(): void;
  };
};
declare const crypto: { subtle: { digest(algorithm: "SHA-256", data: ArrayBuffer): Promise<ArrayBuffer> } };
declare function btoa(value: string): string;

export type BrowserFile = {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function chooseFile(): Promise<BrowserFile | null> {
  if (Platform.OS !== "web") return null;
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.onchange = () => resolve(input.files?.item(0) ?? null);
    input.click();
  });
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
