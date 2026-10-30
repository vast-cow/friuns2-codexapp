# Concurrent project state updates and stale responses

## Setup

- Use an isolated temporary `CODEX_HOME`; do not use the normal conversation directory. Build and install dependencies before starting this procedure.
- Start two updated codexapp processes using that same home on separate local ports. Open one tab for each process. All participating codexapp processes must run the updated code; reload existing tabs after deployment.
- Create folders `a/demo`, `b/demo`, and `extra` under a temporary project directory. Register both `demo` folders. Add a symlink to one folder and a managed worktree if supported by the platform.
- Keep a copy of `.codex-global-state.json`. Add an unrelated top-level key such as `"manual-preservation-marker": {"keep": true}`. If testing remote items, retain a remote record with an additional unknown property.
- Record the hashes of existing session files before project-only actions. Open browser Network tools with Preserve log enabled.

## Two tabs and two processes

1. Leave tab A showing the original roots. In tab B, register `extra`.
2. Without refreshing A, rename only `a/demo`, move it below `b/demo`, then remove `b/demo`. Also exercise each action with a deliberately delayed roots GET response.
3. Return to tab B, then reload both tabs.
4. While repeating these actions, change a thread title and pin, queue a message, dismiss the initial plugins card, and register another folder through the CLI using the same temporary `CODEX_HOME`.

Expected: `extra` and the CLI registration survive every operation. Only the selected canonical path is renamed or removed. An omitted project retains its relative order after the requested reorder. Remote metadata, unrelated keys, and unrelated settings survive. Aliases do not create duplicate registrations. Project operations do not modify existing conversation files. History-derived project visibility retains its existing rules, including when no registered roots remain.

## Legacy requests and failed saves

1. Send `PUT /codex-api/workspace-roots-state` with an older full snapshot using the authenticated tab's Network tools or console.
2. Temporarily replace the isolated state file contents with invalid JSON, then attempt a rename and deletion. Repeat with a valid non-object JSON value such as `[]`.
3. Restore the saved state. With the server running as an ordinary user, make the isolated destination directory unwritable and attempt another change; then restore its permissions.

Expected: the old PUT returns `409` and asks for a reload without changing the file. Invalid JSON and write failures surface in the existing error display. The list and localStorage retain the last successfully saved state. No empty replacement configuration is written. A rename or reorder of a root removed by the other tab never registers it again.

## Delayed reads, restoration, and themes

1. In Network tools, delay a workspace-roots response, add or import a folder, and let the earlier response finish afterward.
2. Delay a background thread-list page, rename/reorder/delete a project, and release that page. Repeat while requesting a forced refresh during an existing load; use folder import to trigger that flow.
3. Switch away and back so both `focus` and `visibilitychange` fire. Also exercise browser back/forward restoration.
4. Repeat in light and dark themes, then reload and inspect both the sidebar and folder picker.

Expected: old responses cannot overwrite the current roots, list, cursor, or pagination timer. A force request during loading produces a coalesced additional fetch. Failed fetches preserve the last usable list. Same-generation roots readers share one request; restoration refreshes roots only and coalesces duplicate events. Saved labels and ordering persist after reload, with readable surfaces and errors in both themes.

## Persistence and request counts

- Observe state-file writes while empty queues are checked: there should be no replacement writes, including when the stored queue is `{}`. Repeating an unchanged project operation should also produce no write.
- Capture roots request counts and lock wait times while exercising concurrent updates. Lock acquisition retries are bounded to five seconds; locks use a ten-second stale threshold and two-second heartbeat.
- In the isolated environment, terminate a process while it holds the lock. After the stale interval, retry through the surviving process. The file should remain valid and updates should resume.
- Check that the config symlink remains a symlink and that its target's permission bits survive an update. Only one roots request should serve concurrent readers in the same generation. Do not expect automatic restoration of registrations already lost before this change.

## Cleanup

Stop only the temporary processes, restore any changed permissions, and remove their temporary home, project folders, and symlinks. Restore browser throttling/interception and the original theme. Do not remove or change the normal Codex home or persistent development server.
