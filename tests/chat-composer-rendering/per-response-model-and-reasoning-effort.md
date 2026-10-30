### Per-response model and reasoning effort

#### Prerequisites/Setup

1. Run the app with a writable `CODEX_HOME` and a disposable thread.
2. Have two usable models and at least two reasoning effort values available.
3. Enable access to light and dark themes. For fallback coverage, use an account/model combination that triggers the existing unsupported-model retry.
4. Use a disposable copy of an older session with known `turn_context` records for history coverage. Never modify the original session logs.

#### Actions and Expected Results

1. Select model A and effort `high`, then send a request long enough to stream. The activity area and assistant response show the submitted settings, marked `(sent setting)` until execution evidence is available.
2. While A is running, select model B and another effort. A's footer retains its original values. Send the next request and check that its response shows B and its finalized effort.
3. Queue a message during generation. Change the composer controls again before the queue drains. The queued response shows the values actually passed by the queue executor, rather than the later composer selection.
4. Trigger the existing unsupported-model fallback. Check that the failed attempt and retry retain separate turn metadata and that the successful response shows the fallback model.
5. Reload during a response, reload after completion, and restart the app server. Metadata remains associated with the same response. Settings are stored under `CODEX_HOME/codexapp-turn-metadata/`; session logs remain unchanged.
6. Open a historical thread and use **Load earlier messages**. Each assistant response uses its own turn context. Recorded model/effort values take priority over submitted values independently; missing recorded fields can retain known submitted values.
7. Open history without usable turn metadata. It shows `Model unknown` and `reasoning: unknown`, never the current composer settings. A known omitted/null effort shows `unspecified`; an explicit `none` remains `none`.
8. Check intermediate assistant messages and the final answer from a single turn. They share metadata. User messages, command rows, and file change rows do not receive generation footers.
9. Repeat the display checks in light and dark themes. Footers remain small, readable, and wrap long model names without horizontal overflow.

#### Rollback/Cleanup

- Delete disposable threads and queued messages; restore the original model, effort, and appearance.
- Remove the disposable `CODEX_HOME` if one was created. For a shared home, remove only the metadata sidecar belonging to the disposable thread (its filename is the SHA-256 of the thread ID).
- These are manual instructions; they have not been executed for this change.
