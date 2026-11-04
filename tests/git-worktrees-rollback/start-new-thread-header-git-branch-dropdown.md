### Feature: Header branch management and workspace review panel removed

#### Prerequisites
- Run the app with a Git workspace, an existing thread, and terminal support.
- Have a disposable workspace available for worktree creation.

#### Steps
1. Open Start new thread and select a Git workspace, then a non-Git folder.
2. Confirm neither shows a header branch dropdown.
3. Open an existing thread. Confirm the header has no branch, checkout, commit browsing, or reset controls.
4. Confirm the thread header has no Review Worktree Changes button and no workspace review panel can be opened. Reload and confirm the conversation and composer remain visible.
   Open an existing chat file-change summary and its diff viewer; confirm the file list and patch content still display.
5. Open Terminal, run `pwd`, and confirm the thread workspace. Close and reopen it and exercise existing quick commands.
6. Create a new thread using Worktree and its searchable base branch selector. Confirm its workspace and branch selection.
7. Repeat these checks in light and dark themes at desktop, 375x812, and 768x1024 sizes.

#### Expected Results
- Branch management controls are absent from the DOM on home and thread routes.
- The workspace review button and panel are absent from the DOM.
- Terminal commands, worktree creation, branch selection, in-chat diffs, and independent Codex review keep their behavior.
- Header controls and conversation surfaces remain readable in both themes.

#### Cleanup
- Remove the disposable thread/worktree and any test files using existing controls.

#### Performance Audit
- Removed the header watcher that requested branch state, default branch commits, and unstaged summary on workspace/route changes.
- No replacement requests, polling, caches, blocking filesystem work, or fanout were added. The panel snapshot, summary, action, and Git-init endpoints and their frontend callers are removed.
- Removed the panel notification subscription, Git subprocess operations, and lazy-loaded component. No new requests, blocking work, payloads, fanout, or cache invalidation paths were introduced.
- Live performance timings have not been measured.

#### Automated verification boundary
- `pnpm run build` passes, including `vue-tsc --noEmit`; the build emits no ReviewPane chunk.
- `pnpm run test:unit`: 266 passed, 33 failed, and two unhandled errors. A clean archive of the pre-change commit produces the same failures and totals (provider/reasoning expectations and incomplete reasoningCatalog mocks).
- `node dist-cli/index.js --help` passes for the public ESM CLI entry.
- Browser verification is blocked by missing Chromium system library `libnspr4.so`. Desktop/mobile and light/dark visual checks above still require execution on a browser-capable host.
