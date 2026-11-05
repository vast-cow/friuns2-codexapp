# Precompressed frontend assets

Prerequisites: install dependencies and run `pnpm run build`. Start the production CLI with `node dist-cli/index.js --port 4192 --no-password --no-open --no-login`.

1. Request `/` and a JavaScript asset using `curl -sS -D /tmp/asset-headers -o /tmp/asset-body -H 'Accept-Encoding: zstd, gzip' http://127.0.0.1:4192/`.
   Expect zstd, HTML MIME, Vary: Accept-Encoding, and the encoded Content-Length.
2. Repeat with `gzip`, `gzip;q=1,zstd;q=0.5`, and `zstd;q=0,gzip`. Expect gzip.
3. Repeat with `br` or no encoding header. Expect original content without Content-Encoding. With `*;q=0`, expect 406.
4. Request a SPA route such as `/thread/example`. Expect the negotiated index HTML. Repeat with HEAD: expect identical representation headers and no body.
5. Send the selected ETag in If-None-Match with the same encoding. Expect 304; change encoding and expect 200.
6. In a temporary copy of dist, remove sidecars for one asset. Expect fallback to another acceptable representation, or 406 if identity and all available encodings are rejected.
7. Run `pnpm exec vitest run src/server/precompressedStatic.test.ts` for round-trip decompression, MIME, fallback and binary exclusion checks.

Cleanup: stop only the test server, remove temporary files/copies, and rebuild if changing dist directly. No source or configuration rollback is needed.
