### Feature: Header branch management removed

#### Prerequisites
- Run the app with a Git workspace, an existing thread, and terminal support.
- Have a disposable workspace available for worktree creation.

#### Steps
1. Open Start new thread and select a Git workspace, then a non-Git folder.
2. Confirm neither shows a header branch dropdown.
3. Open an existing thread. Confirm the header has no branch, checkout, commit browsing, or reset controls.
4. Click Review Worktree Changes. Inspect changed files and diffs, close the pane, and reopen it.
5. Open Terminal, run `pwd`, and confirm the thread workspace. Close and reopen it and exercise existing quick commands.
6. Create a new thread using Worktree and its searchable base branch selector. Confirm its workspace and review changes.
7. Repeat header and review checks in light and dark themes.

#### Expected Results
- Branch management controls are absent from the DOM on home and thread routes.
- Review Worktree Changes directly toggles the existing review pane.
- Terminal commands, worktree creation, review, and other Git actions keep their behavior.
- Header controls and review surfaces remain readable in both themes.

#### Cleanup
- Remove the disposable thread/worktree and any test files using existing controls.

#### Performance Audit
- Removed the header watcher that requested branch state, default branch commits, and unstaged summary on workspace/route changes.
- No replacement requests, polling, caches, blocking filesystem work, or fanout were added. Review requests remain owned by the existing review pane.
- Live performance timings have not been measured.
