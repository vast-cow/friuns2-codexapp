### Local Skills operations do not synchronize GitHub

#### Prerequisites
- Build and run the current app with a disposable `CODEX_HOME` and a locally installed sample skill.
- Repeat with no GitHub login and with a configured test-only sync repository. Never use real credentials in fixtures.
- Record `AGENTS.md` contents/type/link target, Skills files, Git HEAD/remotes, and remote commit before each run. Test a regular AGENTS file, an existing symlink, and no AGENTS file.

#### Actions and expected results
1. Start/restart the app, open Skills, and refresh. No Skills repository initialization, bootstrap, fetch, pull, commit, push, or AGENTS replacement occurs. Existing symlinks remain as they were; a missing AGENTS file stays missing.
2. Disable then enable the sample skill. Only the normal `skills/config/write` request and local list refresh occur; no `/skills-sync/push` request occurs. Skill selection and use in the composer remain available when enabled.
3. Explicitly install/remove a disposable sample skill. Installation may run the requested installer; removal deletes only the selected local skill. Neither operation triggers a background GitHub sync.
4. Confirm configured manual Pull, Push, and legacy `Startup Sync` actions are still available. Only invoke them against disposable data when testing synchronization. The legacy name describes an explicit manual action; application startup never invokes it. No sync action replaces `CODEX_HOME/AGENTS.md` with a symlink.
5. Re-check files, Git state, and remote commits before initiating any manual sync: startup and local toggles must not change them, except the intended local enable/disable settings. Install/removal changes only their expected local files/owner metadata.

#### Cleanup
Stop the test server and remove disposable homes/fixtures only. Do not undo existing user symlinks, credentials, or local Skills configuration.

#### Performance audit
Startup no longer schedules Skills synchronization: it adds no GitHub requests, repository subprocesses, or filesystem mutation. Local toggles eliminate one push request each; install/removal eliminate background Git fetch/push jobs. Discovery and explicit manual sync retain their existing paths. No new cache, payload, blocking work, or fanout is added. Live latency was not measured.

#### Automated coverage
Focused tests cover authenticated/unauthenticated startup, repeated middleware creation, regular/missing/symlink AGENTS preservation, local install/uninstall without background GitHub activity, and both enable/disable values plus update failure. Installer subprocesses and Codex RPC are mocked; these tests do not prove live Codex, GitHub, or browser integration.

#### Validation results
- Eleven focused regression tests pass. Production build (including frontend typecheck) and `node dist-cli/index.js --help` pass.
- Full unit suite: 277 passed, 33 failed, two unhandled errors. Failure signatures match a clean archive of the pre-change commit (266 passed before the eleven new tests).
- Server-only typecheck retains ten baseline browser-type errors in `codexRpcClient.ts`.
- Live browser, Codex, and manual GitHub synchronization checks were not run.
