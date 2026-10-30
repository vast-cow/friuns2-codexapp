### Thread message cache skips unchanged refetches

#### Feature/Change Name
Loaded thread messages are reused when the thread list version has not changed and the thread is not in progress.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Browser dev tools Network panel open
3. An existing completed thread

#### Steps
1. Open the completed thread and wait for messages to render
2. Switch to another thread or home
3. Return to the same completed thread without new turn or thread update events
4. Inspect network/RPC calls during the return
5. Within two seconds of loading the thread, send a new message and let it complete quickly
6. Confirm the completion is reflected without reloading the page
7. If possible, delay an in-flight history response, complete the new turn, and then release the delayed response
8. Repeat with a changed thread list timestamp within two seconds of the initial load

#### Expected Results
- The first open loads messages normally
- Returning to the unchanged completed thread reuses cached messages
- No additional `thread/read` or `thread/resume` call is made for that unchanged return
- If the thread version changes or the thread is in progress, messages still refresh from the server
- Explicit send/start/completion updates bypass recent-message reuse, even if the thread timestamp is unchanged
- A notification received during a history request is followed by a fresh read after the pending request finishes
- Start/completion bursts remain serialized by the existing notification debounce and in-flight sync guard; unchanged navigation adds no reads

#### Rollback/Cleanup
- None

---
