# Prompt and answer timestamps

Prerequisites: Run the app with a Codex conversation whose session JSONL contains
`task_started` with a turn ID, `user_message`, and `task_complete` events with ISO timestamps.

1. Send a prompt and wait for the final answer. Expect `Sent: YYYY/MM/DD HH:mm`
   below the prompt and `Answered: YYYY/MM/DD HH:mm` below the final answer.
   Compare both against the log timestamps converted to the browser timezone.
2. While streaming, expect no answer completion time. Intermediate progress
   messages must not inherit the final answer's completion time.
3. Refresh, switch threads and return, then reopen the conversation. Expect
   the same times from persisted evidence, without substituting thread activity time.
4. Open a historical conversation without timestamp evidence. Expect no invented date.
5. Inspect light and dark themes at desktop and mobile widths. Expect subtle,
   readable text below messages without overlap with actions or horizontal scrolling.

Cleanup: Remove any disposable test conversation using normal app controls.

Automated coverage: `src/server/messageTimestamps.test.ts` and
`src/api/normalizers/v2.test.ts` cover recovery, missing evidence, local formatting,
streaming suppression, and final-answer selection.

Performance audit: No new HTTP requests, timers, or dependencies. Historical
recovery reuses the existing session-file read and bounded 64-entry cache; parsing
adds one linear scan per changed session log. Live-state recovery also scans the
already-read log. Per-turn normalization uses a linear final-answer lookup.
Browser timing and visual verification were not measured in this environment.

Validation commands (2026-11-05):
- `npm run test:unit -- src/server/messageTimestamps.test.ts src/api/normalizers/v2.test.ts`: 11 passed.
- `npm run build:frontend`: typecheck and Vite build passed (chunk size warning).
- `npm run build:cli`: passed.
- CJS smoke: `node -e "const {execFileSync}=require('node:child_process'); const help=execFileSync(process.execPath,['dist-cli/index.js','--help'],{encoding:'utf8'}); if(!help.includes('--port')) throw new Error('Missing CLI options'); console.log('CJS CLI smoke passed: --help exposes --port');"`: passed.
- Full `npm run test:unit`: 261 passed, 33 failed, 2 unhandled errors.
  A separate clean HEAD snapshot with the same dependencies reproduced the same
  33 failures and 2 errors (257 passed); failures concern provider/model behavior
  and missing reasoning catalog mocks. No new suite failures were introduced.
- Live browser refresh persistence, mobile layout, and light/dark visuals remain
  unverified; follow the manual steps above on a running Codex-backed instance.

## App-server millisecond timestamps

Setup: Use a completed paginated `thread/read` response with user `startedAtMs`
(and `completedAtMs`) `1793800496289`, and final-answer `completedAtMs`
`1793800499248`. Set the assistant phase to `final_answer`; include a preceding
`commentary` message. No session JSONL timestamps are required for this case.

1. Open the conversation. Expect sent time from `2026-11-04T13:54:56.289Z`
   and answered time from `2026-11-04T13:54:59.248Z`, converted to browser local
   time (both `2026/11/04 22:54` in Asia/Tokyo). Keep existing labels and styling.
2. Refresh, switch away and reopen. Expect the same original times.
3. Set the turn to `inProgress`, or the last assistant phase to `commentary`.
   Expect no completion timestamp. Remove all timestamp evidence: expect no date.
4. Try malformed millisecond fields with valid legacy ISO fields. Expect ISO
   fallback; for user messages, valid `completedAtMs` also backs up `startedAtMs`.

Cleanup: Restore fixture responses or remove the disposable conversation.

Verification: focused normalizer and session-recovery suites pass (24 tests);
frontend typecheck/Vite build and CLI build pass. Browser local-time and visible
refresh verification could not run because the Playwright Chromium executable
is absent. The reload regression re-normalizes a serialized historical response;
it does not prove browser rendering or server persistence.

Performance: code-path audit confirms constant-time field validation/conversion
per message, retaining the existing linear traversal and final-message lookup.
No requests, session-file reads, polling, cache changes, dependencies, or UI
changes were added. Browser latency was not measured.
