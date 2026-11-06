# Persistent attachment-only thread index

Attachment references still reach Codex through the existing file-reference envelope. The request after `## My request for Codex:` is empty when the composer contains only files or whitespace. Display titles are never added to model instructions. This affects history visibility in this app; other Codex clients retain their own listing behavior.

## Storage and submission

`$CODEX_HOME/codexapp-thread-index.json` stores canonical thread metadata, a filename-based display preview, first accepted turn ID, archive/deletion state, and any pending first submission. It contains paths and prompt envelopes; treat it as private chat metadata. Writes use a cross-process lock, a mode-0600 temporary file, and atomic replacement. Codex's own database and session logs are never modified.

Unused threads are held only in a bounded in-memory startup cache. Before the first file-only submission, the app durably records its exact envelope and pre-existing turn IDs. Failure to write this intent prevents sending. Acceptance records the returned turn ID. A later metadata-write failure is logged and never changes an accepted RPC into a failed send.

Ambiguous transport failures leave the intent pending. Listing reconciles at most five pending threads per minute against `thread/read`, matching both original input and a new turn ID. Reopening a pending thread also reconciles it. No recovery path sends a message. A pending first submission blocks another attachment-only send until reconciled; if Codex never recorded it, operator inspection is needed before removing that pending record. Definitive JSON-RPC rejection clears the intent. Repeated submissions after confirmation are separate normal turns.

## Listing and recovery

The pager merges ordered native pages and filtered index rows, with canonical ID deduplication, native metadata precedence when available, and fallback preview for an empty native preview. Opaque `app-index:` cursors carry the native cursor, buffered rows, indexed ordering boundary, and IDs already emitted. Keep filters unchanged when continuing a cursor. As with native history, concurrent updates can change the ordering between page requests; begin a new listing after edits.

Cwd, provider, source, archive, creation/update ordering, and page size are applied to indexed rows. App archive/unarchive/name/delete operations update the index; a missing native page does not delete a record. Indexed rollout paths are checked asynchronously before listing, so deleted or externally moved histories are not resurrected. Rebuild after external archiving to discover the new location. A listing row cannot repair missing underlying history.

For existing hidden conversations, send `POST /codex-api/thread-index/rebuild` through an authenticated app session. This explicit maintenance operation sequentially traverses `sessions/` and `archived_sessions/`, reads canonical threads by ID, and indexes only histories containing accepted file-only user turns in the exact envelope format. It never sends turns or changes original messages. The response reports `recovered` and `failed` counts. Keep the server running until it completes; large homes may take time. Tombstoned deleted rows are not recovered. Back up the index before manual repair; removing it loses app-owned visibility and pending-submission evidence.

## Performance and verification boundaries

Ordinary listing does not traverse session files or read confirmed thread histories. It performs one asynchronous stat per matching indexed rollout path, sequentially to bound filesystem fanout. Pending reconciliation has a five-read/minute budget. Native pages are fetched only as needed; a 500-row regression fixture (250 indexed plus 250 native, 17 rows/page) requires 15 native page calls with no duplicates. That full mocked pagination/filter regression took approximately 87 ms in the local full-suite run; this is not live Codex latency. Automated tests also cover restarts through new index instances, filtered lists, repeated input, rejected/ambiguous sends, metadata failures, and history recovery. These are mocked Codex tests, not proof that a particular CLI persists or resumes empty-preview sessions.

The sparse attachment index is parsed and sorted in memory on each listing: O(index size) input and O(n log n) sorting. Mutations atomically rewrite that index, with unchanged metadata avoiding writes. Cursor size grows with indexed IDs emitted and one native page buffer. Very large attachment-only histories may warrant a queryable database; this implementation does not expand the existing synchronous 200-row legacy SQLite fallback into a session scan. That legacy fallback remains synchronous and bounded.

Live Codex version/schema, model-facing instrumentation, browser reload/theme checks, Docker provider cases, real restart/resume, and browser/thread profiling require a working Codex executable and Docker where applicable. Neither executable is available in the implementation environment. Follow the [manual test](../tests/chat-composer-rendering/attachment-only-thread-persistence.md) on the deployed runtime.
