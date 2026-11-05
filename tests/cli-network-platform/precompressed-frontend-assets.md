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

## Long-term HTTP caching for build-generated JavaScript

Setup: run `pnpm run build` and start the production CLI as above. Keep
`dist/.vite/manifest.json` with the matching build; missing/invalid manifests safely
fall back to ordinary revalidation. Vite development serving is unchanged.

1. Read a JavaScript `file` from `dist/.vite/manifest.json`. Request that URL with
   `curl -I -H 'Accept-Encoding: gzip' http://127.0.0.1:4192/assets/<built-name>.js`.
   Expect `Cache-Control: public, max-age=31536000, immutable`, JavaScript MIME,
   gzip encoding and `Vary: Accept-Encoding`. Repeat with zstd and identity;
   expect the same caching policy and the selected encoding (none for identity).
2. Request `/`, `/index.html` and `/thread/example`. Expect `Cache-Control: no-cache`.
   Request `/sw.js` and any unversioned public JavaScript; expect
   `public, max-age=0`, without immutable. Non-JavaScript policies remain unchanged.
3. Repeat a hashed request with its ETag in `If-None-Match`; expect 304 and the
   immutable policy. HEAD must have the GET headers with no response body.
4. In a browser with DevTools Disable cache unchecked, reload twice. Fresh hashed
   JavaScript should come from HTTP cache without revalidation; HTML revalidates.
   Change application JavaScript, rebuild and deploy the complete matching build.
   Reload: HTML references a new filename and the updated JavaScript downloads.
   No new Service Worker registration or Cache Storage should appear.
5. Exercise API, authentication and local-file routes; expect their existing
   behavior and cache policies. Run `pnpm exec vitest run src/server/precompressedStatic.test.ts`
   for automated policy, encoding, validator and route-isolation coverage.

Deployment: deploy assets and manifest together, revalidate HTML at reverse proxies,
and retain old hashed assets while older tabs may still request lazy chunks. Cache
headers here are emitted by the production CLI; external static hosts/CDNs need
matching configuration. Do not rewrite content at an immutable asset URL.

Performance audit: the manifest is read once when static middleware is created.
Each existing static request adds one Set lookup, with no extra filesystem reads,
requests, compression, or per-request manifest parsing. Fresh browser hits avoid
asset requests entirely. This manual browser check measures reload behavior;
automated HTTP tests check policy, not a browser's internal cache.

Cleanup: stop the test server and remove temporary response files; restore any
source edits made for the deployment test and rebuild. Keep the retirement worker.
