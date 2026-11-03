# Attachment-only thread persistence

## Prerequisites / Setup

- Use a working Codex provider and a disposable project with a persistent test `CODEX_HOME`.
- Prepare `notes.txt` containing a unique marker and a second file with another marker.
- Prepare at least 2,000 characters of plain text containing a third unique marker.

## Actions

1. Create a new chat, paste the long text, confirm it becomes a `pasted-text-*.txt` attachment, and submit with an empty composer.
2. Record the thread URL. Wait for completion, refresh the thread list, reload the page, then restart the application with the same `CODEX_HOME` and reopen it.
3. Confirm the thread remains in the sidebar and the persisted first user request includes `Attached file: pasted-text-...txt`. Ask Codex to read the file and report its unique marker.
4. Repeat with only a manually uploaded `notes.txt`, then with whitespace-only composer content, then with both prepared files and no request text.
5. Submit an attachment with a multiline request. Confirm the request is retained and no fallback is appended. Send a plain text message and confirm its existing behavior.
6. While a turn runs, queue an attachment with no text. Let it drain and confirm the persisted request includes the filename and Codex can read the file. Repeat the reload and application restart checks.
7. Repeat the sidebar and message visibility checks in light and dark themes.

## Expected Results

- Attachment-only requests contain a concise filename-based summary after `## My request for Codex:`; multiple files have a filename list and a remaining count when needed.
- Attachment references remain intact and contents remain accessible without being copied into the prompt.
- Threads remain discoverable after completion, full thread-list refresh, page reload, and application restart.
- Non-empty requests and text-only messages retain the existing format; normal and queued sends use the same attachment format.
- This change prevents empty requests on future submissions; it does not repair previously missing threads.

## Cleanup

- Remove disposable threads and uploaded test files, then remove the isolated test home and project if created.
- Stop only the disposable test server; preserve the persistent development server.
