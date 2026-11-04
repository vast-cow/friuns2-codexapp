### Local Skills without GitHub authentication or synchronization

#### Prerequisites
- Build and run the current app with a disposable `CODEX_HOME` and a locally installed sample skill.
- Repeat with no GitHub credentials and with an inert legacy `skills-sync.json` containing test-only credentials. No actual login or repository setup is required.
- Record `AGENTS.md` contents/type/link target, Skills files, Git HEAD/remotes, and remote commit before each run. Test a regular AGENTS file, an existing symlink, and no AGENTS file.

#### Actions and expected results
1. Start/restart the app, open Skills, and refresh. No Skills repository initialization, bootstrap, fetch, pull, commit, push, or AGENTS replacement occurs. Existing symlinks remain as they were; a missing AGENTS file stays missing.
2. Disable then enable the sample skill. Only the normal `skills/config/write` request and local list refresh occur; no `/skills-sync/push` request occurs. Skill selection and use in the composer remain available when enabled.
3. Explicitly install/remove a disposable sample skill. Installation may run the requested installer; removal deletes only the selected local skill. Neither operation triggers a background GitHub sync.
4. Confirm all Skills sync, repository setup, Pull/Push, GitHub login/device login/logout, and Firebase controls are absent. Removed sync endpoints must fall through without touching any stored credential file.
5. Re-check files and Git state: startup/toggles must not change them except intended local settings. Install/removal changes only the requested skill files, never legacy credential or owner metadata.


#### Cleanup
Stop the test server and remove disposable homes/fixtures only. Do not undo existing user symlinks, credentials, or local Skills configuration.

#### Performance audit
Startup no longer schedules Skills synchronization: it adds no GitHub requests, repository subprocesses, or filesystem mutation. Local toggles eliminate one push request each; install/removal eliminate background Git fetch/push jobs. Local discovery remains; all manual synchronization paths and Firebase modules are removed. No new cache, payload, blocking work, or fanout is added. Build evidence: DirectoryHub JS decreases from 48.17 kB to 40.08 kB and transformed module count from 177 to 165 after removing Firebase and sync code. Live latency was not measured.

#### Automated coverage
Focused tests cover authenticated/unauthenticated startup, repeated middleware creation, regular/missing/symlink AGENTS preservation, local install/uninstall without background GitHub activity, and both enable/disable values plus update failure. Installer subprocesses and Codex RPC are mocked; these tests do not prove live Codex, GitHub, or browser integration.

#### Validation results
- Production build, frontend typecheck and public ESM CLI smoke `node dist-cli/index.js --help` pass.
- Focused local Skills/navigation/removed-route tests: 34 passed. Full suite: 286 passed, 32 failed, two unhandled errors; failure signatures match the pre-change run.
- Server-only typecheck retains ten baseline browser-type errors in `codexRpcClient.ts`.
- Playwright at `http://127.0.0.1:4173/#/skills`, viewport 1440x1000, verifies all remaining tabs, local Skills selection and disable/enable in both themes with no GitHub authentication, sync UI or sync requests. Catalog/RPC/Skills responses are controlled fixtures because live Codex CLI is unavailable; installation and credential-file preservation are covered by unit tests with a mocked installer. Browser Use is unavailable, and Playwright provides request interception.
- Screenshots: `output/playwright/skills-sync-removal-light.png` and `output/playwright/skills-sync-removal-dark.png`. Live registry installation and real Codex were not tested.
