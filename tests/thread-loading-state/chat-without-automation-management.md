### Change: Chat workflows after automation management removal

#### Setup
Use a disposable `CODEX_HOME` with working Codex authentication and an existing conversation. Optionally copy an automation directory containing `automation.toml` and `memory.md` into this disposable home; record their contents before testing. Do not edit real automation records. Start the current application.

#### Actions
1. Inspect the sidebar toolbar, thread menu, and project menu in light and dark themes. Visit `#/automations` directly.
2. Resume the existing conversation and send a new message; observe streaming and completion. Send a second message while the first is busy and verify immediate Steer submission.
3. Reload and confirm conversation history remains available. If history contains a heartbeat envelope, confirm its instructions remain readable and the existing automation label is displayed.
4. Archive a disposable thread and remove its project from the sidebar. Compare the saved automation TOML and memory contents with the originals.
5. Inspect network traffic for retired `/codex-api/thread-automations`, `/project-automations`, `/thread-automation`, `/project-automation`, and `/thread-automation/run` paths. Send GET/PUT/DELETE/POST requests to the retired routes as appropriate.
6. Open Skills from the toolbar; return to the chat and verify model/reasoning controls, approval replies, and normal navigation remain available.

#### Expected
There is no Automations navigation, creation/editor dialog, schedule/status control, badge, or manual run action. The old route returns to Home. The app makes no automation-management requests and retired endpoints are unhandled. Startup, thread archive, and project removal leave existing automation records untouched. Normal Codex conversation and immediate steering remain available; no schedule worker is introduced. Any scheduler outside this application is unaffected.

#### Cleanup
Restore theme/navigation and remove only disposable fixtures. Existing user automation data, Codex config, credentials, and conversation history must remain unchanged.

#### Performance audit
Sidebar mount no longer fetches thread/project automation maps or scans automation directories. The lazily loaded Automations panel, editor state/computed values, and automation CSS are removed. No replacement requests, polling, background timers, or caches are added. Telegram processing and SSE keepalive remain active infrastructure; prompt queue drain timers are removed. Live provider latency is not measured here.

#### Historical validation evidence and limits

The following results describe the earlier automation removal, including its then-existing prompt queue; they are not verification of current queue behavior.
- `pnpm run build` passes, including frontend typecheck and production CLI build. Main frontend JS decreases from 470.60 kB to 448.34 kB; CLI decreases from 409.52 KB to 387.96 KB. The Automations lazy chunk is gone. `pnpm pack --pack-destination /tmp` and the public ESM entry smoke `node dist-cli/index.js --help` pass.
- Focused routes, queue processing, inline history, archive recovery, gateway, normalizer, and message-stream tests: 140 passed. Full suite: 305 passed, one failed. The same duplicate-user-row failure in `refreshes a loaded optimistic thread when completion events arrive` occurs in the pre-change baseline (298 passed, one failed); two removed automation-only tests and nine new retired-route cases account for the passing-count change.
- Server-only typecheck still reports the same ten pre-existing browser-type errors in `codexRpcClient.ts`; output is byte-identical to the pre-change check.
- Browser Use is unavailable. Playwright with controlled Codex RPC/WebSocket fixtures passes at `http://127.0.0.1:4173/#/thread/automation-removal-fixture`, viewport 1440x1000: absence of navigation/editor actions in thread/project menus, historical heartbeat instructions, streamed reply delta, normal turn submission, busy queue editing/persistence, conversation resumption, and old-route redirect to Home. No automation API requests or page exceptions occur. Screenshots: `output/playwright/automation-removal-light.png` and `output/playwright/automation-removal-dark.png`.
- This host has no Codex CLI; real provider execution and external scheduler behavior were not measured. Prompt queue workers are removed; legacy-state retirement is covered by unit tests. Existing automation data is preserved rather than migrated or deactivated, so scheduling managed outside the app remains outside its control.
