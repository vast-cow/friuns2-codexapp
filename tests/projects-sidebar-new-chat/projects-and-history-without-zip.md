### Change: Projects and history without ZIP import/export

#### Setup
Build the app. Use an isolated `CODEX_HOME` with a registered project, normal and previously imported conversations, and a copy of an old ZIP archive. Record project/session/archive contents before checking. Use a Codex-capable host for live message execution.

#### Actions
1. Open Home in light and dark themes. Confirm `Select folder` and `Create Project` remain while `Import Project` and the ZIP input are absent.
2. Open an existing project using `Select folder`. Verify its name and historical conversations appear in the sidebar; switch between them and reload.
3. Open thread and project menus in both themes. Confirm `Browse files` remains and `Export Project` is absent. Open the existing chat and check historical messages and file/image attachments.
4. Resume the conversation, send a message, observe streaming, and immediately steer with a follow-up. Archive/unarchive a disposable conversation with the normal Codex flow and verify historical messages are available after resumption.
5. Request the retired GET/HEAD `/codex-api/project-zip` and POST `/codex-api/project-import` routes. Confirm no archive handling or filesystem changes occur.
6. Compare existing project files, `.codex-project` metadata, session logs and prior ZIP archive bytes with the initial copies.

#### Expected
Projects open and list normally; history remains readable and resumable. SQLite supplementation still exposes historical sessions, saved titles, ordering and deduplication without archive creation/import. UI and routes provide no backup/restore ZIP workflow. Normal attachment handling, raw upload bodies, archive recovery and shared global-state serialization remain; deferred prompt queues are removed. No migration/deletion of user data occurs.

#### Cleanup
Restore themes and remove only isolated test fixtures. Keep original ZIP archives, project folders, Codex sessions, databases and user configuration.

#### Performance audit
The archive CRC-table initialization, ZIP streaming/backpressure handlers, recursive export/session scans, full-buffer ZIP parsing, session rewriting/database import writes and frontend archive blobs/progress state are removed. No new startup requests, timers, caches or fanout are introduced. The existing read-only SQLite historical-list query remains unchanged (one process/query per thread-list response when the database exists), as do its existing 200-row limit and merge semantics.

#### Validation evidence and limits
- `pnpm run build` passes, including frontend typecheck and CLI production build. Frontend main JS decreases from 448.34 kB to 440.75 kB; CLI decreases from 381.08 KB to 348.12 KB. `node dist-cli/index.js --help` and `pnpm pack --pack-destination /tmp` pass.
- Seven new project/history regressions verify route retirement, project opening/listing, historical SQLite row merging/title/order/deduplication, read-only database fallback, historical message/attachment reload, and byte preservation of project files, `.codex-project` metadata, session logs and prior archives. SQLite process output and Codex RPC are controlled fixtures; the host has no SQLite CLI or live Codex CLI.
- Focused history/archive/attachment/queue/gateway/normalizer/message suites: 115 passed. Full suite: 312 passed, one failed. The duplicate-user-row failure in `refreshes a loaded optimistic thread when completion events arrive` also occurs in the pre-change baseline (305 passed, one failed). Server-only typecheck retains ten identical pre-existing browser-type errors in `codexRpcClient.ts`.
- Browser Use is unavailable; Playwright uses controlled Codex RPC and WebSocket fixtures at `http://127.0.0.1:4173/#/thread/zip-removal-fixture`, 1440x1000. It verifies Home and project/thread menus in light/dark, retained folder/project controls, project/history listing, historical image attachment rendering, reloading/resumption, turn submission and a streamed delta. Zero ZIP API requests and page exceptions occur. Screenshots: `output/playwright/zip-removal-home-light.png`, `zip-removal-home-dark.png`, `zip-removal-menu-light.png` and `zip-removal-menu-dark.png`.
- `node scripts/test-local-connectivity.cjs` passes actual HTTP/API and WebSocket ready/ping/pong on local port 38769 and independent proxy port 35743. Startup measures 313 ms with a Codex discovery stub; live model latency was not measured.
- Docker is unavailable, so the test image changes were not built in Docker. Real Codex execution, real SQLite CLI process integration and externally restored archives were not exercised. Existing archive files remain usable by independent external tools; this app no longer imports or exports them.
