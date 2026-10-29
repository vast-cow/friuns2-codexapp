# Thread goals and slash commands

## Feature / Change

Port the npm 0.1.91 goal editor and `/goal`, `/plan`, and skill completion to the source implementation.

## Prerequisites / Setup

- Use an app-server supporting `thread/goal/get`, `thread/goal/set`, and `thread/goal/clear`.
- Open an existing thread and install at least one enabled skill.

## Actions and Expected Results

1. Type `/`, use arrow keys and Enter/Tab to select `/plan`: plan mode toggles without sending a message. Escape dismisses completion.
2. Type a skill name after `/` and select it: a skill chip appears and the completion token is removed. Disabled skills are absent; at most 20 suggestions appear.
3. Select `/goal`, enter an objective, and send: the message includes `/goal` and the objective. The Goal indicator can remove the prefix before sending.
4. In an existing thread, submit `/goal` alone or click Set goal/Edit goal: the editor opens without sending a turn. Save an objective and status, reload, and confirm persistence.
5. Edit status and clear the goal: the returned server state is reflected. A failed save/clear keeps the editor open and displays an error.
6. Switch threads while a goal load/save is pending: the old response must not overwrite the new thread's panel. Complete a turn: the goal and usage refresh once.
7. Repeat the visible flows in light/dark themes and at 375x812 and 768x1024; verify wrapping and accessible controls.

## Performance Audit

Code-path analysis only: one goal RPC per panel mount/thread change and one on a running-to-idle transition. No polling, new event stream, filesystem calls, or fanout. Mutation responses update the panel directly without an additional read. Generation checks discard stale responses; there is no cross-thread goal cache. Goal data is a single object. Completion searches the installed skills locally, sorts matching skills, and renders at most 20 rows; it adds no network calls. Search cost is O(n log n) in the worst case for n matching skills. Live latency, browser rendering, and themes have not been measured or tested at the user's request.

## Rollback / Cleanup

Clear the temporary goal, disable plan mode, and remove temporary drafts/skill attachments.
