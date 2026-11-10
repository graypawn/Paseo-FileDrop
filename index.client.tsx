import type { PluginClientContext } from "@getpaseo/plugin/client";
import { FileDropPanel } from "./client/file-drop-panel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "file-drop",
    title: "FileDrop",
    icon: "Upload",
    locations: ["workspace", "explorer"],
    Component: FileDropPanel,
  });
  return () => {};
}
