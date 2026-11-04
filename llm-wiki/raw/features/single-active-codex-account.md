# Single active Codex account boundary

Implementation evidence: `src/server/accountRoutes.ts`, `src/server/codexCredentials.ts`, `src/server/codexAuthStatus.ts`, `src/App.vue`, `src/api/codexGateway.ts`.

The app supports the current Codex login, without a stored-account registry, import/migration, switching, alternate-account rotation, snapshot removal or background quota inspections. Five stored-account endpoints and two exclusive archive import/copy scripts are removed. Existing auth.json, accounts.json and accounts directories are not migrated, read for selection, deleted, or rewritten on startup.

The existing Codex CLI login URL/callback flow remains. Successful CLI exit establishes file or Keyring login, and the app-server restarts to observe it without registering a snapshot. Logout uses standard account/logout RPC only after explicit user action. Runtime authentication detection remains Codex-based, including Keyring; normal active-account rate limits, secure feature credential reads and guarded token refresh remain independent.

Settings displays current Codex sign-in status, Reload, Login and Logout. It has no account list or switching/removal UI. Existing active credentials require no app-triggered reauthentication. Failed login callback validation does not invalidate the active account.
