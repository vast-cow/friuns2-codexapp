### Feature: Cloudflare tunnel QR omits password auto-login path

#### Prerequisites
- App is running from this repository with password enabled.
- Cloudflare tunnel startup is enabled (`--tunnel`).

#### Steps
1. Start CLI with `--password test-secret --tunnel` and wait for tunnel output.
2. Verify the printed `Tunnel:` URL does not include a `/password=` suffix.
3. Scan the terminal QR code from a phone/browser.
4. Confirm first page load shows the password form when no valid session cookie exists.
5. Sign in with `test-secret`.

#### Expected Results
- Tunnel URL shown in startup output does not expose the password.
- QR code encodes the base tunnel URL without a password-bearing path.
- The configured password is never printed.
- Base tunnel URL requires login when no valid session cookie exists.

#### Rollback/Cleanup
- Stop the CLI process.
- Clear cookies for the tunnel origin if needed.
