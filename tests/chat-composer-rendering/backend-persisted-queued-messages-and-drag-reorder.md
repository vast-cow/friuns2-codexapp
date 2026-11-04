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

### Lazy queue controls

#### Prerequisites/Setup
- Build with `pnpm run build` and serve the production app with a working backend and authenticated provider.
- Open browser Network inspection, disable cache, and start on Home with an empty queue.

#### Steps
1. Reload Home and open an empty-queue thread. Filter requests for `QueuedMessages`; expect no queue component JS or CSS requests.
2. Start a turn and queue two messages. Confirm queue controls appear after their first asset load, while the composer remains usable.
3. Edit, reorder, Steer, and delete entries; confirm each action affects the correct message. Drain the queue, then queue another message; confirm controls return without another JS download in the same page session.
4. Refresh a thread with persisted queued messages. Confirm controls load and display the saved order.
5. Repeat in light and dark themes. Confirm queue row styling, drag indicators, and action buttons remain readable.
6. Navigate Home/projects/threads, open terminal and review, then skills/directory, automations, and settings. Confirm their existing behavior remains available.

#### Expected Results
- Queue assets load only when a nonempty queue is rendered; existing async panels retain their loading behavior.
- No queue-specific API request is added by loading the component. A cold queue display requires one JS request plus its component CSS; later mounts reuse the loaded assets.
- Production build emits no default 500 kB large-chunk warning.

#### Rollback/Cleanup
- Delete disposable queued messages, stop test turns, restore appearance, and re-enable browser cache.
