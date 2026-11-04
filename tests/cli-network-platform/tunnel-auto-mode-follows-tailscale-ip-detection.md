### Feature: Tunnel startup is explicit and independent of Tailscale

#### Prerequisites
- Build the current CLI and use a disposable Codex home.
- For the explicit tunnel check, have cloudflared installed and network access.
- Optionally repeat on a host with a Tailscale interface.

#### Steps
1. Run `CODEX_HOME=<disposable-home> node dist-cli/index.js --port 5900 --no-open --no-login`. Confirm startup does not start cloudflared or print a `Tunnel:` URL, regardless of Tailscale interfaces.
2. Repeat with `--no-tunnel`: tunnel startup remains disabled.
3. Repeat with `--tunnel`: confirm a base Cloudflare URL and QR code appear. Use the [password and QR checks](cloudflare-tunnel-qr-omits-password-auto-login-path.md) to verify password behavior.
4. Confirm local/network URLs still appear. In the app, check account management, navigation, Skills, and Codex Apps listing still work.

#### Expected Results
- Tunnel startup is disabled by default and enabled only explicitly; obsolete Tailscale detection is removed.
- QR generation uses the tunnel URL directly without adding credentials.
- Active account, Skills, Codex Apps, and navigation behavior is preserved after unused component removal.
- Profiling scripts retain their direct `playwright` dependency; unused SDK/test-runner dependencies and the unused PTY build allowance are absent.

#### Rollback/Cleanup
- Stop the CLI and its cloudflared child; remove only disposable home/test fixtures.
- Do not change existing credentials, settings, or conversations.

#### Performance audit
- Removed components were not imported or registered, so they contributed no active render work. Removed CLI detection helpers were never called; the URL helper only returned its input. No new requests, blocking work, fanout, payloads, or caches are added. Removing unused direct dependencies reduces install requirements. Live timings and manual checks above were not measured/executed.
