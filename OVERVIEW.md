# Paseo FileDrop

Paseo FileDrop uploads a browser-selected file into a directory inside the current
Paseo workspace. It uses the workspace panel and the existing authenticated Paseo
connection; it does not run a separate upload web server.

The first release accepts one file at a time, never overwrites an existing file,
and writes uploads through a temporary file before atomically publishing them.
Only the web client is supported initially.
