import type { PluginServerContext } from "@getpaseo/plugin/server";
import { UploadService } from "./server/upload-service";
import { abortUpload, beginUpload, completeUpload, uploadChunk } from "./shared/upload-rpc";

export default function contribute(server: PluginServerContext) {
  const uploads = new UploadService();
  server.handle(beginUpload, uploads.begin);
  server.handle(uploadChunk, uploads.writeChunk);
  server.handle(completeUpload, uploads.complete);
  server.handle(abortUpload, uploads.abort);
  return () => uploads.dispose();
}
