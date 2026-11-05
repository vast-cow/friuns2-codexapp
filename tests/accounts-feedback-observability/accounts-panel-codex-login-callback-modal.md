### Single active Codex login

#### Prerequisites
- Use a disposable `CODEX_HOME`, supported Codex CLI, and both file/Keyring credential-store environments when available.
- Keep an existing authenticated fixture and a logged-out fixture. Record active credential bytes and any legacy `accounts.json`/`accounts/` files before testing. Never put real tokens in reports.

#### Actions and expected results
1. Start with an existing active Codex login and open Settings. It shows `Codex account` and `Signed in to Codex`, with no stored-account list, selector, registration, snapshot import, switch, rotation, or remove controls. Reload the page: the login remains active without requesting authentication or rewriting credentials/snapshots.
2. Click Reload: refresh current authentication status without inspecting other stored accounts. No `/accounts`, `/accounts/active`, `/accounts/refresh`, `/accounts/switch`, or `/accounts/remove` requests occur. Active-account rate limits continue through normal Codex APIs.
3. Explicitly click Logout: the app calls standard `account/logout` and shows Login. Legacy saved-account files remain untouched; there is no replacement-account selection.
4. Click Login. The existing `codex login` flow opens the authorization URL and callback modal. Complete the browser login, paste its localhost callback URL, and submit. Successful CLI exit establishes login for the configured file or Keyring backend without creating account registry/snapshot files. Invalid callbacks and failed logins must not invalidate existing credentials.
5. Repeat in light/dark themes. During active turns or pending approvals, login/logout are blocked to preserve the active workflow.
6. Check private connector credential access, metadata-only public auth, and token refresh with their focused tests. Never export Keyring secrets or use snapshot fallback.

#### Cleanup
Stop disposable processes and remove only test fixtures. Existing credential files, legacy account archives and current login must not be migrated, deleted, or invalidated by app startup.

#### Performance audit
The stored-account registry, snapshot migrations, background quota inspections/temporary Codex servers, card polling, and import-on-startup requests are removed. Status uses existing Codex authentication interfaces; active-account quota reporting remains. No alternate-account requests, fanout, new caches or polling are added. Live latency was not measured.

#### Verification boundary
- Production build with frontend typecheck, package creation, and public ESM CLI smoke pass.
- Focused authentication tests: 43 passed, covering file/Keyring CLI completion, normal login/logout gateway requests, legacy file preservation, failed login/callback behavior, secure credential access, and token refresh.
- Full suite: 286 passed, 32 failed, two unhandled errors; failure signatures match the pre-change suite. Server-only typecheck retains ten baseline browser-type errors in `codexRpcClient.ts`.
- Playwright at `http://127.0.0.1:4173/`, viewport 1440x1000, confirms an existing active login across page reload without any login request, explicit logout, callback login completion, and no multi-account management requests/controls. Screenshots: `output/playwright/single-account-light.png` and `output/playwright/single-account-dark.png`.
- Browser RPC/auth/login endpoints use controlled fixtures because Codex CLI is unavailable. Browser Use is unavailable; Playwright supplies required request interception. Docker is unavailable, so the isolated provider/auth container matrix and live Keyring/Codex authentication were not run. No real credentials were used or changed.
