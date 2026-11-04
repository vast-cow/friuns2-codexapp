### Obsolete branch-management APIs removed

The header branch dropdown and its commit/reset controls and backend implementation are removed.
See [header removal checks](start-new-thread-header-git-branch-dropdown.md).

#### Prerequisites
- Run the current server with a disposable Git repository containing a commit and two branches, and a non-Git folder.
- Use the normal authenticated browser session for API requests.

#### Actions and expected results
1. Request GET `/codex-api/git/branches`, GET `/codex-api/git/branch-commits`, GET `/codex-api/git/commit-files`, POST `/codex-api/git/checkout`, and POST `/codex-api/git/reset-to-commit`. Supply the disposable repository as `cwd`, and valid `branch` and `sha` values as appropriate. These paths must no longer return branch/commit data or perform Git operations; they fall through the API bridge to the host's unmatched-route handling.
2. Compare repository HEAD, branches, worktree list, and tracked/untracked files before and after: none change.
3. Open New worktree, choose the repository, search/select a starting branch, and create the worktree. Branch listing and creation still work. Repeat using the project menu permanent-worktree action.
4. Select the non-Git folder: repository detection still hides worktree controls. Existing conversations, credentials, settings, and in-chat diffs remain available.

#### Cleanup
Remove only disposable threads, worktrees, and repository fixtures created for this check. Existing reset-history refs and `.codex/untracked-backups` are retained; this removal performs no data migration or deletion.

#### Performance audit
The five unused handlers and their exclusive helpers are deleted. Worktree branch enumeration, repository detection, and creation retain their existing code paths. No requests, subprocesses, payloads, caches, blocking work, or fanout are added. Live timings were not measured.

#### Automated verification
- Production build (including `vue-tsc --noEmit`) passes; public ESM CLI smoke `node dist-cli/index.js --help` passes.
- Full unit suite: 266 passed, 33 failed, two unhandled errors. A clean archive of HEAD reproduces the failures (provider/reasoning expectations and incomplete mocks).
- `tsc --noEmit -p tsconfig.server.json` fails with ten browser-type errors in `codexRpcClient.ts`; baseline output is identical.
- Repository-wide reference inspection found no callers of the removed endpoints. No endpoint-specific unit tests or dependencies remained to remove.
- Manual API/worktree runtime checks above were not executed.
