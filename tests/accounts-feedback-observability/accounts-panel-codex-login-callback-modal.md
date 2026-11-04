### Accounts panel Codex login callback modal

#### Feature/Change Name
Accounts settings includes an always-available `Login` button that starts `codex login`, opens the returned authorization URL, shows an in-app callback modal, requests the pasted localhost callback URL from the server, and imports the completed Codex account.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. `codex` CLI available in the server process `PATH`
3. Browser can open the authorization URL returned by the server
4. Light theme and dark theme are available from the appearance switcher

#### Steps
1. Open settings and expand `Accounts`.
2. In light theme, verify `Login` appears even when an active account is already listed.
3. Click `Login`.
4. Verify a new tab opens to the OpenAI authorization URL and an in-app `Complete Codex login` modal asks for the localhost callback URL.
5. Complete authorization in the browser until it redirects to a `http://localhost:<port>/auth/callback?...` URL.
6. Paste that full localhost callback URL into the modal input and click `Complete`.
7. Verify the account list refreshes, the new or refreshed account is active, and normal thread/account data reloads.
8. Click `Login` again, close the modal, and verify the Accounts panel keeps the `Open login URL` fallback link available.
9. Switch to dark theme and repeat steps 1-4, verifying the Login button, link, modal, input, and buttons have readable contrast.

#### Expected Results
- `Login` is available regardless of current login state.
- Starting login runs `codex login` on the server and exposes the generated OpenAI authorization URL.
- Completing login uses the modal input value, only accepts local callback URLs, and uses the server to request the pasted callback.
- After completion, the active account is read from Codex. File-backed credentials are saved as a snapshot when account identity is available; Keyring credentials remain managed by Codex.
- Completion waits for the successful `codex login` exit with a bounded timeout, without depending on an `auth.json` update.
- Light-theme and dark-theme controls are readable and do not overlap.

#### Rollback/Cleanup
- Remove any test-only account from the Accounts panel if needed.
- If a login is abandoned, restart the dev server to clear any in-memory pending login process.

---

### Keyring account discovery and login completion

#### Prerequisites/Setup
- Prepare isolated Codex homes for `file` and `keyring` credential storage, with a working Keyring backend for the latter. Authenticate through the CLI and confirm `codex login status` succeeds. Keep the user's original profile unchanged.
- For file storage, save two accounts through Reload to exercise snapshot switching. For Keyring, confirm `auth.json` is absent.

#### Steps
1. Start with the externally authenticated Keyring profile. Open Accounts and verify the active email, plan, and quota appear when Codex exposes them. Restart the application and repeat.
2. Click Reload. Confirm the active account remains visible and no credential file or snapshot is created.
3. Complete Login from the application's callback modal with each storage mode. Also test a browser callback that has already completed before clicking Complete. Confirm a successful CLI exit completes the workflow without waiting for an auth-file timestamp.
4. Under Keyring, attempt snapshot switching and active-account removal. Confirm the controls explain that Codex manages this login; direct requests must return a clear unsupported-operation error without modifying credentials.
5. Under file storage, switch between saved accounts and remove an inactive snapshot. Confirm the existing behavior remains available.
6. With one saved snapshot matching the active Keyring email, Reload and confirm only one row represents that account. With multiple snapshots sharing an email, confirm they remain separate: email alone cannot identify the active workspace.
7. Exercise an active account with missing email/plan metadata and a quota RPC failure. Confirm the account still appears with safe fallback labels and quota error feedback; the UI must not show the runtime UI identifier as a workspace ID.
8. Check the account rows, explanatory text, and disabled actions in both light and dark themes.

#### Expected Results and Limitations
- `account/read` supplies the active runtime account. It exposes no stable account/workspace ID or raw tokens, so runtime identity is temporary and never saved as a credential snapshot.
- Keyring, auto, ephemeral, and unknown backends do not support snapshot switching or active-login removal through this app. Manage those credentials using Codex CLI. Inactive file snapshots may still be removed without touching the active credentials.
- File snapshots retain multi-account functionality. Keyring credentials are never extracted, copied, deleted, or used to create plaintext auth files. An existing stale `auth.json` under Keyring is ignored.
- Metadata matching deduplicates a unique email match; ambiguous matches retain separate rows rather than inventing a workspace identity.
- Runtime reads are shared across list/active endpoints and cached for 30 seconds, including failures. Reload and successful login explicitly invalidate the cache. Account/config/quota reads each have a five-second response deadline. Existing background snapshot inspection excludes the active login.
- Login success follows successful completion of `codex login`, and quota failure does not prevent account discovery or successful login completion.

#### Rollback/Cleanup
- Stop the temporary app and discard only the isolated test profiles. Do not remove the active Keyring login through the app or change the user's credential storage configuration.
