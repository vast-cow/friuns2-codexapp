### Thread selection keeps sidebar list stable during refresh

#### Feature/Change Name
Selecting a thread does not briefly hide older/sidebar threads while thread list refresh and background pagination run.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. More than one page of threads available in the sidebar
3. Background pagination has loaded older threads

#### Steps
1. Open the app and wait until older thread pages appear in the sidebar
2. Select a different thread
3. Watch the sidebar while the selected thread loads and any thread list refresh occurs
4. Repeat selection between recent and older threads

#### Expected Results
- The sidebar does not collapse to only the first page of recent threads
- Previously loaded older threads remain visible during refresh
- The selected thread stays highlighted and messages load normally
- Background pagination can still add newly loaded older threads without hiding existing ones

#### Rollback/Cleanup
- None

---

### Newly created chats awaiting server indexing

#### Prerequisites/Setup
- Use a development backend or response stub that can omit selected IDs from thread-list pages while allowing thread start, turn events, and detail requests.
- Keep at least two projects and more than one page of server threads available.
- Run each visible-sidebar scenario in light and dark themes.

#### Steps
1. Create a chat and omit its ID from thread-list responses. Refresh the list during the turn.
2. Complete the turn while continuing to omit the ID. Refresh again.
3. Allow the ID to appear on a subsequent list page. Wait at least five seconds.
4. Repeat with three chats created close together, two in the same project. Load older history pages and select another chat.
5. Create a chat with a first turn lasting over two minutes. Complete it while its ID remains omitted.
6. Reject thread creation, then separately allow creation but reject the first turn. Keep the latter ID omitted for over two minutes after failure.
7. Archive an unconfirmed chat. Remove another unconfirmed chat's registered project while its turn is active. Refresh the list.
8. Keep a completed unconfirmed chat omitted for over two minutes, without generating further notifications.

#### Expected Results
- New chats stay visible during active turns and for a two-minute indexing grace period after completion, including long first turns.
- Pending chats use one shared five-second reconciliation timer through the existing list loader. Confirmed chats stop needing this retention state.
- Concurrent chats remain in their workspace groups, sorted by update time; older paginated history and selection remain intact.
- Failed creation inserts no sidebar row. An unindexed failed first turn expires after the grace period.
- Archiving and project filtering remove rows immediately and reconciliation does not resurrect them.
- A completed chat never returned by the server expires on reconciliation within roughly two minutes plus one timer interval. Failed list requests do not renew its grace period.
- Previously confirmed chats keep the existing server-list cache and pagination behavior.

#### Rollback/Cleanup
- Remove response stubs, restore workspace registration, and archive test chats that were persisted.
- These scenarios and the automated regression cases were added without execution for this task, as requested.
