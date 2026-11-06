# Attachment-only thread persistence

## Prerequisites / Setup

- Use a working Codex provider and a disposable project with a persistent test `CODEX_HOME`.
- Prepare `notes.txt` containing a unique marker and a second file with another marker.
- Prepare at least 2,000 characters of plain text containing a third unique marker.

## Actions

1. Create a new chat, paste the long text, confirm it becomes a `pasted-text-*.txt` attachment, and submit with an empty composer.
2. Record the thread URL. Wait for completion, refresh the thread list, reload the page, then restart the application with the same `CODEX_HOME` and reopen it.
3. Confirm the thread remains in the sidebar and the persisted first user request is empty after `## My request for Codex:` and the file references remain intact. Ask Codex to read the file and report its unique marker.
4. Repeat with only a manually uploaded `notes.txt`, then with whitespace-only composer content, then with both prepared files and no request text.
5. Submit an attachment with a multiline request. Confirm the request is retained and no fallback is appended. Send a plain text message and confirm its existing behavior.
6. While a turn runs, submit an attachment with no text. Confirm immediate submission preserves its file reference and an empty request, then repeat the reload checks.
7. Repeat the sidebar and message visibility checks in light and dark themes.

## Expected Results

- Attachment-only requests contain no generated text after `## My request for Codex:`. The filename-based display title exists only in the application index.
- Attachment references remain intact and contents remain accessible without being copied into the prompt.
- Threads remain discoverable after completion, full thread-list refresh, page reload, and application restart.
- Non-empty requests and text-only messages retain the existing format; normal and steering sends use the same attachment format.
- Previously missing threads with readable accepted attachment-only turns can be recovered using the explicit [index rebuild](../../docs/persistent-thread-index.md).

## Cleanup

- Remove disposable threads and uploaded test files, then remove the isolated test home and project if created.
- Stop only the disposable test server; preserve the persistent development server.

## Optimistic attachment reconciliation regression coverage

### Status and scope

The state-level cases in `src/composables/useDesktopState.messages.test.ts` exercise the public send/load/notification APIs with a mocked gateway. They do not exercise clipboard conversion, HTTP transport, rendered chips, or link navigation. These cases now use empty persisted attachment-only user text. Automated state, gateway, prompt, and persistent-index tests run locally; browser, Docker, and live Codex restart checks still require the setup above.

The earlier workaround created a mismatch between an empty optimistic prompt and a persisted `Attached file: ...` description. That generated request has now been removed. The current `startTurnForThread()` binds the particular optimistic message ID to the returned turn ID; `hasEquivalentUserMessage()` uses that turn ID before text comparison, and `mergeMessages()` removes the optimistic row only when a persisted user row matches. The added cases target this behavior without changing production code. Existing text-only cases in the same suite remain in place.

Run focused state/prompt validation with:

```sh
pnpm run test:unit -- src/composables/useDesktopState.messages.test.ts src/utils/attachmentPrompt.test.ts
```

### Additional setup

- Use the disposable project and persistent test home described above. Inspect the current server on port 4173 before reusing it; preserve the persistent server on port 5173.
- Open browser developer tools, enable Preserve log in Network, and record the initial user-row count. Count `.message-row[data-role="user"]` within the conversation, not sidebar previews or nested elements carrying the same `data-message-type` attribute.
- Record each attachment's full upload path and link target. Use two files with different contents but the same basename in separate directories for the filename-collision case.
- For controlled races, use a test bridge or response interception that can hold `turn/start` and `thread/read` responses independently while notifications continue. Browser offline mode covers connection loss, but cannot reliably enforce notification/response ordering. If controlled interception is unavailable, mark those race cases unverified.

### Actions and expected results

1. **New chat, pasted text only:** Paste at least 2,000 characters with a unique marker, confirm conversion to a `.txt` chip, and submit with no prompt. While `turn/start` is pending, expect one optimistic user row with one chip. Release the response and wait for canonical history. Without reloading, expect one persisted user row with one chip and zero corresponding `userMessage.optimistic` rows.
2. **New chat, attachment plus text:** Repeat with the prompt `Read the unique marker`. Expect the same row replacement, the exact ordinary prompt, and the original attachment path/link. The user must not need a reload to remove a duplicate.
3. **Existing chat, attachment only:** Wait for a previous turn to complete and record its row count. Send only a pasted-text attachment. Expect exactly one additional persisted user row, no stale optimistic row for that submission, and unchanged older messages and ordering.
4. **Multiple attachments:** Send the pasted text and `notes.txt` together, first in a new chat and then in an existing chat. Expect one pending row, then one persisted row containing exactly two chips. Open/copy each link and confirm its full target and unique file content match the corresponding upload; filenames alone are insufficient evidence.
5. **Intentional repeated submissions:** Submit the same file in two separate completed turns. Hold history for the second turn so it contains only the first turn, and confirm the second optimistic row remains. Release current history; expect two distinct persisted user rows in submission order, one chip each. Repeat with the same basename from different paths. Compare full targets; neither submission may disappear or be merged with the other.
6. **Delayed responses and notifications:** Hold `turn/start` while delivering `turn/started` and a history snapshot containing the canonical attachment row; then release `turn/start`. After synchronization, expect exactly one persisted row. Separately return old history after an accepted send, then deliver `turn/completed` with current history. The optimistic row must remain until its persisted counterpart is available, then disappear without a reload. Repeat completion/history notifications; counts and order must stay unchanged.
7. **Connection interruption, failure, retry:** First accept a send, fail its history read, reconnect, and deliver completion/current history. Expect the pending attachment to survive the failed read and reconcile once, with no additional backend send. Separately reject `turn/start` before acceptance: expect the attachment and error to remain visible and no automatic retry. If a retry control exists, use it once and record whether the failed attempt is removed/replaced and the accepted attempt produces exactly one persisted row. If no retry control exists, mark retry unverified; manually resubmitting is a separate submission, not proof of retry semantics. A lost response after server acceptance is ambiguous: inspect server history before retrying and do not infer exactly-once backend delivery from UI counts.
8. **Reload:** After successful reconciliation, record user-row count, chip count, text, ordering, and link targets; reload the same thread URL. Expect identical persisted content and no optimistic rows. Repeat with multiple attachments and with repeated-file submissions.
9. Repeat the visible checks in light and dark themes. Confirm row/chip readability and that both themes show the same counts and links. Send a plain-text control and confirm one optimistic row becomes one persisted row with unchanged content.

For every accepted submission, inspect the transport/server RPC log and count actual `turn/start` calls (or `turn/steer` for a steering case), excluding uploads, history reads, and notification traffic. Expect one send per user action in these normal-provider cases. Record the submission marker, turn ID, request count, pre/post row and chip counts, full link targets, tested URL/theme, and any screenshot paths. Mock call counts establish only frontend gateway invocation counts; they do not prove backend delivery behavior.

### Coverage boundaries and cleanup

- Added state cases cover new/existing attachment-only and mixed sends, multiple attachments, prior turns with the same filename/path, history-before-response synchronization, stale history followed by completion, failed reads followed by recovery, rejected sends without automatic retry, and fresh-state history restoration.
- Clipboard conversion, DOM chip/link assertions, actual page reload, transport disconnects, retry controls, and ambiguous accepted-but-response-lost failures require the manual/browser procedure. The fresh-state unit case is not an end-to-end reload test.
- See the [persistent-index guide](../../docs/persistent-thread-index.md) for storage, reconciliation, pagination, and performance boundaries.
- Restore network connectivity, throttling, and interception settings. Remove disposable chats/files and the isolated home/project as above; do not delete uploads referenced by retained chats.

## Persistent index lifecycle and recovery

### Setup

Use an isolated persistent `CODEX_HOME`, valid provider credentials, and more than 200 threads (including attachment-only threads). Inspect actual `turn/start` input and persisted user content, not only the UI.

### Actions and expected results

1. Send single/multiple files with empty and whitespace-only requests. Check file paths remain intact and the user request remains empty. Send literal authored `Attached file: notes.txt` and confirm it remains unchanged.
2. Record canonical thread and turn IDs. Refresh, restart the application and Codex, open by ID, resume, and send a follow-up. Expect the original history and a single new turn per deliberate submission.
3. Page through all history with `created_at` and `updated_at` sorting, cwd/provider/source filters, and archived/non-archived views. Expect stable order, no duplicate IDs, and no missing attachment threads beyond row 200.
4. Rename, archive, unarchive, and delete through the app; restart. Expect the same state and no resurrected rows. An omitted page is not evidence of deletion.
5. Interrupt the connection after acceptance. Reload the list and open the thread. Expect pending intent reconciliation against a new matching turn ID, never an automatic resend. Repeat the same file in another turn; expect distinct turn IDs.
6. Make the index directory unwritable before sending: expect no `turn/start`. Separately make confirmation persistence fail after acceptance: expect the accepted response, a server warning, and later reconciliation without a resend. Restore permissions before retrying. Corrupt index JSON must produce a visible error rather than silently overwrite state.
7. With older hidden file-only sessions, invoke `POST /codex-api/thread-index/rebuild` using the authenticated app session. Expect readable accepted attachment threads to reappear, existing conversation text unchanged, unused threads excluded, archive state retained, and deletion tombstones preserved. Check returned failure count; inaccessible histories cannot be repaired by listing metadata.

### Cleanup

Restore permissions and connectivity, remove disposable threads/files/home, and preserve the persistent development server on 5173. See the guide before removing application index state.
