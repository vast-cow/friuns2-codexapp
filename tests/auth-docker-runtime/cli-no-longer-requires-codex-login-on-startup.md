### Feature: CLI no longer requires codex login on startup

#### Prerequisites
- Use a fresh disposable `CODEX_HOME` without touching existing credentials.

#### Steps
1. Run `npx codexui` or `pnpm run dev`.
2. Verify the CLI prints a message about not being logged in but does NOT block or prompt for login.
3. Verify the server starts and the web UI loads successfully.
4. Attempt to chat without credentials: receive an actionable Codex authentication error. Sign in with Codex and retry; no alternative provider is selected.

#### Expected Results
- CLI does not run `codex login` on startup.
- A friendly message is shown: "You can log in later via settings or run `codexui login`."
- The UI starts without credentials; chat requires official Codex authentication or a personal official API key.

#### Rollback/Cleanup
- Run `codex login` to restore Codex authentication if needed.

---
