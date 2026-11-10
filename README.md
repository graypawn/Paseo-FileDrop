# Paseo FileDrop

Paseo FileDrop is a Paseo plugin for safely uploading a browser-selected local
file to the current workspace on the connected daemon. It uses Paseo's existing
authenticated plugin RPC connection and does not expose a separate upload server.

## MVP

- One file at a time, selected in the Paseo web client
- Workspace-relative destination directory, defaulting to `uploads`
- Chunked transfer with per-chunk and final SHA-256 checks
- No overwrite: an existing target file causes the upload to fail
- Temporary-file upload and atomic publication on completion
- Path traversal and symbolic-link escape prevention

The initial browser upload limit is 10 MiB. Desktop/mobile selection, drag and
drop, multiple files, visible progress, retries, and larger-file tuning follow
after integration validation.

## Development

The plugin requires Paseo 0.15.4 or later and Node.js 20 or later.

```sh
npm install
npm run typecheck
paseo plugin install github:graypawn/Paseo-FileDrop
```

Enable plugins only on a daemon where you trust this source: plugin server code
runs with the daemon user's permissions.
