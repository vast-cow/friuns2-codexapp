### Change: Local connectivity without built-in tunnels

#### Setup
Build with `pnpm run build`. Use a disposable `CODEX_HOME` for runtime checks. No Cloudflare binary, account, or network service is needed. The smoke scripts use a command stub for Codex discovery; they do not execute a live model.

#### Actions
1. Run `node scripts/test-local-connectivity.cjs`. It starts the packaged CLI on a requested ephemeral port, verifies HTTP frontend/API routing, WebSocket `ready` plus ping/pong, and repeats through an independent local HTTP/WebSocket reverse proxy.
2. Run `node scripts/test-password-auth.cjs` for default access and password-protected HTTP/WebSocket access. Confirm no install-prompt marker is created.
3. Inspect `node dist-cli/index.js --help`. The retired `--tunnel` and `--no-tunnel` arguments should be rejected. Normal port, browser, login, sandbox, approval and project options remain.
4. Start with `CODEX_HOME=<disposable-home> node dist-cli/index.js --port 5900 --no-open --no-login`. Confirm local/network URLs appear without a tunnel URL, QR code, download, install prompt or tunnel process. Repeat with a pre-existing `.cloudflared-install-prompted` marker and confirm its bytes remain unchanged.
5. If a private-network or externally managed reverse proxy deployment is available, connect through it and verify HTTP and WebSocket upgrades. The app does not configure or terminate that external service.
6. Stop the CLI with SIGTERM and confirm it exits normally. For development, `pnpm run dev --host 127.0.0.1 --port 4173` retains the normal Vite host/port controls.

#### Expected
The app runs directly with existing HTTP/WebSocket/auth behavior and port selection. It does not probe, download, install, start, stop or print connection QR codes for Cloudflare Tunnel. The dedicated QR dependencies are absent. Previously installed binaries/markers and other user files remain untouched. Cloudflare Skills/plugins, unrelated CDN resources, external proxies, and transcription error handling remain independent features.

#### Cleanup
The smoke scripts stop only their child servers/proxy and remove their own temporary homes. Remove any manually created disposable fixtures. Leave existing user binaries, credentials, config and persistent dev servers unchanged.

#### Performance audit
Tunnel command probes, install-marker filesystem access, download/install work, URL parsing, process listeners, the 20-second URL wait timer and QR rendering are removed from CLI startup. No new requests, polling, payloads or caches are added. Network-interface URL display, HTTP/WebSocket routing, and ordinary shutdown remain unchanged. Smoke startup timing measures local startup with a Codex discovery stub, not live Codex or external proxy latency.

#### Validation evidence and limits
- Production build/frontend typecheck passes; the public ESM smoke `node dist-cli/index.js --help` and `pnpm pack --pack-destination /tmp` pass. The CLI bundle decreases from 387.96 KB to 381.08 KB. No tunnel/QR module references remain in the built CLI.
- `node scripts/test-local-connectivity.cjs` passes against the real packaged server at `127.0.0.1:45639` and an independent local forwarding proxy at `127.0.0.1:45515`, including WebSocket ready/ping/pong. Startup with the Codex discovery stub measures 257 ms. Both retired flags are rejected and the existing marker remains byte-identical.
- `node scripts/test-password-auth.cjs` passes all five configurations: default (44385), explicit no-password (33919), password (33483), password overriding earlier no-password (34225), and the opposite precedence (46043). Each verifies HTTP and WebSocket access plus absence of password generation, tunnel output and install-marker creation.
- Full unit suite: 305 passed, one pre-existing duplicate-message failure in `refreshes a loaded optimistic thread when completion events arrive`; the same test and output occur in the pre-change baseline. Server-only typecheck has the same ten pre-existing browser-type errors in `codexRpcClient.ts`.
- The local ignored lockfile is regenerated using `pnpm install --lockfile-only --ignore-scripts`; this repository does not track lockfiles. Both dedicated QR packages are removed from the manifest and lockfile.
- Docker is unavailable, so the updated container command was not exercised in Docker. Real Tailscale, TLS termination, Windows/Termux, live Codex execution and external service deployments were not tested. The independent HTTP forwarding proxy validates preserved request and WebSocket upgrade behavior locally.
