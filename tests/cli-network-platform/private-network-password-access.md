### Feature: Private network password access

#### Prerequisites
- App is running from this repository via CLI.
- A Tailscale client can reach the host over Tailscale IPv4 (`100.64.0.0/10`) or IPv6 (`fd7a:115c:a1e0::/48`).

#### Steps
1. Start CLI: `node dist-cli/index.js --no-login --no-open --port 5900`.
2. From a Tailscale client, open `http://100.x.x.x:5900` using a host address in `100.64.0.0/10` (replace with host tailnet IP).
3. Confirm the app opens directly without the password login page.
4. (Optional IPv6 check) Open the same service using the host Tailscale IPv6 address in `fd7a:115c:a1e0::/48` and confirm it also opens without login by default.
5. Restart with `--password test-secret`. Clear cookies and confirm both localhost and Tailscale IPv4/IPv6 show login; sign in and confirm access.

#### Expected Results
- Requests from Tailscale IPv4 `100.64.0.0/10` require sign-in only when `--password` is configured.
- Requests from Tailscale IPv6 `fd7a:115c:a1e0::/48` require sign-in only when `--password` is configured.

#### Rollback/Cleanup
- Stop the CLI process.
