### Feature: Reverse tunnel login is required for local, reverse tunnel, and Tailscale requests

#### Prerequisites
- App is running with `--password test-secret --no-open`; use fresh cookies for each origin.
- One direct local browser session (`localhost`).
- One reverse tunnel path (for example SSH/Cloudflare forwarding) that reaches the same server.
- Optional Tailscale client in `100.64.0.0/10` or `fd7a:115c:a1e0::/48`.

#### Steps
1. Open app via `http://localhost:<port>` and confirm the login page is shown.
2. Open app via reverse-tunnel URL and confirm login page is shown.
3. Enter correct password in reverse-tunnel URL and confirm session cookie allows access.
4. (Optional) Open app via Tailscale IP and confirm login is required.

#### Expected Results
- Local loopback access requires login.
- Reverse-tunnel access does not bypass auth and requires password.
- Valid login on reverse-tunnel path creates session and grants access.
- Tailscale IPv4 and IPv6 requests require login too.

#### Rollback/Cleanup
- Clear browser cookies for the app origin(s).
- Stop the CLI process.
