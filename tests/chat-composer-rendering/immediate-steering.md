### Immediate steering and retired queue state

Prerequisites: use a disposable Codex home and a thread with a running turn. Back up the profile before seeding legacy data.

1. In light and dark themes, verify there is no Queue panel, mode selector, or busy-send setting.
2. Send an idle message, then submit text, an attachment, and a skill during generation. Each submission must appear immediately and issue its request without waiting for completion.
3. Verify model, effort, collaboration mode, draft editing, pending approval/input requests, and Stop continue to work.
4. Seed `thread-queue-state` in `.codex-global-state.json` with a recognizable prompt and set `codex-web-local.in-progress-send-mode.v1` to `queue` in localStorage. Reload the browser and restart the backend. Wait at least 10 seconds and complete a turn. The legacy prompt must never appear or execute.
5. Submit twice rapidly, complete or interrupt the active turn while submission is pending, then wait 15 seconds. Each submitted prompt must issue exactly one immediate request; completion and interruption must never replay it. Repeat after reload with both plain `queue` and JSON-encoded `"queue"` preference values.
6. GET and PUT `/codex-api/thread-queue-state` must return an unavailable route. Verify unrelated saved state is unchanged.

Cleanup: stop disposable turns, remove the test profile, restore appearance and composer preferences. Never seed legacy state in a real profile.
