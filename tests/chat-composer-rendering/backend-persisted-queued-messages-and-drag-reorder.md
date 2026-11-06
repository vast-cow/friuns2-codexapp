### Backend-persisted queued messages and drag reorder

#### Feature/Change Name
Queued messages are saved through the backend, survive page refresh, and can be reordered by dragging a queued row before another queued row.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Open a thread where a turn is actively running
3. Queue at least three messages while the turn is running
4. Light theme and dark theme both available from the appearance switcher

#### Steps
1. In light theme, confirm each queued row has a drag handle at the start of the row
2. Refresh the page and reopen the same thread
3. Confirm all queued rows are still visible in the same order
4. Drag the third queued message onto the first queued message
5. Confirm the third message moves to the first position and the remaining queued messages keep their relative order
6. Refresh again and confirm the reordered queue order is preserved
7. Let the active turn finish and confirm the next sent queued message is the first reordered item
8. Queue at least two more messages, switch to dark theme, and repeat the drag reorder check

#### Expected Results
- Queued rows survive a page refresh because they are restored from backend state
- Dragging a queued row onto another queued row immediately reorders the queue
- The reordered queue order survives page refresh
- The reordered queue order controls which message sends next after the active turn finishes
- Edit, Steer, and Delete actions still operate on the correct queued row after reordering
- Drag handle, hover/drop target, and row text remain readable in both light theme and dark theme

#### Rollback/Cleanup
- Delete any queued test messages that should not be sent

---

### Per-message queued model and reasoning settings

#### Prerequisites/Setup
- Run the app with an authenticated provider and a model supporting both `low` and `medium` reasoning. Keep an existing turn running long enough to queue follow-ups.
- Open network/RPC inspection or use app-server tracing to inspect actual `turn/start` payloads. Footer labels alone do not establish execution correctness.

#### Steps
1. Select model M with `low` reasoning and queue message A. Select M with `medium` reasoning and queue message B.
2. Change the composer to another model/effort after queuing both messages.
3. Refresh the page while the initial turn is running; confirm A and B remain queued. Restart the backend and reopen the thread if restart coverage is needed.
4. Let the initial turn and queued turns finish. Inspect A and B's `turn/start` requests: both top-level `model`/`effort` and `collaborationMode.settings.model`/`reasoning_effort` must match M/low and M/medium respectively. Check recorded per-turn metadata too.
5. Repeat with different models for A and B and different collaboration modes. Drag B before A, refresh, and confirm B runs first with its own settings.
6. Queue A with low, change composer settings to medium, edit A's text, and resubmit. Confirm it retains low and its original collaboration mode. Repeat using Steer; inspect the actual request and confirm the composer preferences remain medium. Editing queue text preserves its original generation settings.
7. With a disposable test profile, load a legacy queue record lacking `generationSettings`. Refresh, reorder, and edit it. Confirm no snapshot is invented; execution uses the existing legacy fallback.
8. If two providers expose identical model IDs, repeat for each provider using its supported efforts. A queued entry must never inherit the other provider's capabilities. An entry whose saved provider differs from the resumed thread must remain queued without a `turn/start` request.
9. Check a supported explicit `none` and an unspecified effort separately. `none` stays explicit; an unspecified effort remains null in collaboration settings. For an effort no longer supported by the matching provider/model catalog, expect its capability default (or first supported effort), consistently in both payload locations.
10. Repeat queue edit, reorder, and Steer in light and dark themes; existing queue controls must remain readable.

#### Expected Results
- Each queued entry retains its submission-time model, effort, provider identity, and collaboration mode across persistence and reorder.
- A/low followed by B/medium produces two independent turns with the respective effort values. Later composer or global configuration changes do not overwrite them.
- Executing saved settings does not write global model preferences. Legacy entries retain their prior fallback behavior.

#### Rollback/Cleanup
- Delete remaining test queue entries, stop disposable test turns, and restore the original composer model, reasoning effort, collaboration mode, and appearance.
- Restore any manually edited queue state from the disposable profile's backup.

## Cross-thread follow-up destinations

Prerequisites: backend running with Codex configured; two threads T1 and T2 in a project. Test both light and dark appearance.

1. Start a long turn P in T1, queue a prompt with an attachment, skill, model/effort selection and Plan mode. In its queue row choose Same thread, New thread, or an existing T2 from the searchable destination menu. Repeat for each destination.
2. Confirm the row shows P's turn ID and destination. Switch threads and refresh; return to T1 and confirm both remain saved.
3. With T2 idle, verify nothing runs until P terminates. With T2 busy, finish P and verify T2's current work continues; the follow-up starts only when T2 is idle.
4. For New thread verify a separate thread is created in T1's working directory, with the follow-up's own prompt, attachments, skills, model, effort, and mode.
5. Close the browser before P finishes; confirm backend execution from the reopened destination. Restart the backend while P or T2 is busy; verify the saved dependency remains and executes once. Reconnect repeatedly after completion and verify no duplicate follow-up.
6. Repeat with failed and interrupted/canceled P. Terminal statuses (`completed`, `failed`, `interrupted`, `canceled`, `cancelled`) release the follow-up; waiting for approval/input does not. Legacy entries without a saved predecessor keep their existing idle-thread queue behavior. Missing predecessor history leaves a follow-up pending rather than guessing completion.

Cleanup: delete unused queued entries and archive test destination threads. Restore the original appearance and composer settings.

Execution uses the existing consume-before-start policy: a backend crash between consuming the entry and submitting the RPC can lose that entry. An ambiguous RPC failure retains the pre-existing retry behavior; exactly-once delivery across an ambiguous transport failure is not guaranteed by app-server. Duplicate completion events/reconnects are serialized and do not replay consumed entries.

Performance review: processing inspects only the queue head, with one extra `thread/read(includeTurns: true)` for the predecessor on each eligibility check. Existing five-second retry timers are deduplicated per source thread; destination locks serialize competing queues. No new browser requests, background scans of all thread histories, synchronous filesystem work, or cache layers were introduced. Full predecessor history can be large, and concurrent work remains proportional to the number of queued source threads, as in the existing recovery scheduler. Live multi-thread load and provider/container performance have not been measured.

## Sequences configured before execution

Prerequisites: authenticated backend, T1 running A, and an existing T3. Use both light and dark themes.

1. Queue B after A. Click **Add follow-up** on B, enter C's instruction, then repeat on C to add D. Each new step initially uses the current composer model, effort, and collaboration mode. Edit a leaf step through the composer to add its attachments or skills before adding successors.
2. Configure and repeat these destinations: B Same/C Same; B New/C Same; B Same/C New; B existing T3/C independently selected thread. Confirm each row displays its own task ID, predecessor, destination and Pending/Dispatched state.
3. Refresh and switch UI threads before A completes. Confirm all links persist. Finish A; verify only B starts. Finish an unrelated turn and verify C stays pending. Finish B and verify C starts in B's actual execution thread for Same, including when B created that thread.
4. Restart the backend while B is running and reconnect repeatedly. Verify C waits for B's saved turn ID, and each step dispatches once.
5. Try editing or steering B after adding C: expect an explanatory error. Try reordering a sequence: expect an explanatory error. Delete pending B: C becomes blocked with “Predecessor deleted”; D becomes blocked by its predecessor. Delete blocked descendants to clean up. Editing a pending leaf preserves its dependency and settings. Executed records are retained and cannot be deleted through the queue.
6. Fail, cancel or interrupt B: the terminal-status policy above still releases C. Approval/input waiting does not. A missing historical turn remains pending. Cycles and self references are blocked by the backend resolver.

Recovery policy for dependency tasks: persist a dispatch claim before `turn/start`, then retain the returned thread and turn IDs. A restart or transport failure after the claim but before the turn ID is saved leaves an uncertain dispatch record; successors wait and the task is never automatically replayed. Inspect the destination and schedule a replacement explicitly if necessary. This favors avoiding duplicate work. Old entries without follow-up metadata retain the legacy consume/restore policy. Execution records are retained to resolve descendants; automatic pruning is not implemented.

Cleanup: delete pending/blocked descendants before their parents; archive test destination threads. Restore composer and theme settings.

Sequence performance audit: dependency lookup builds an in-memory ID map and walks ancestors, O(number of saved tasks + chain depth) per eligibility check. It adds no network request per ancestor; only the immediate predecessor history is read. Dispatch adds two serialized global-state writes (claim and execution result). Existing deduplicated five-second retries remain in use. Retained execution records grow with task count; pruning and large-queue load measurements remain future work. No browser request fanout or new cache is introduced.
