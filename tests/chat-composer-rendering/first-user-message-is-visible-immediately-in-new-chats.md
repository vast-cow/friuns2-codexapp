### First user message is visible immediately in new chats

#### Feature/Change Name
New and existing thread sends render the submitted user message immediately and retain live replies until history catches up, even when backend reads lag behind notifications.

#### Prerequisites/Setup
1. Create a fresh isolated `CODEX_HOME`.
2. Start local Vite: `CODEX_HOME=<temp-home> npm run dev -- --host 127.0.0.1 --port 4173`.
3. Use an explicit test project folder to avoid projectless folder-name collisions from repeated `hi` tests.

#### Steps
1. In light theme, open `http://127.0.0.1:4173/?openProjectPath=<encoded-test-project-path>`.
2. Send `hi` in a new unauthenticated chat and confirm the conversation pane immediately shows the user row `hi`.
3. Copy `/Users/igor/.codex/auth.json` to `<temp-home>/auth.json`.
4. Restart the same Vite server with the same `CODEX_HOME`.
5. Open the same project path, create another new chat, and send `hi`.
6. Confirm the conversation pane immediately shows the user row `hi`, then wait for the assistant response.
7. Select `GPT-5.4-mini` in a post-auth new chat, send `hi`, and confirm the user row appears before the assistant response finishes.
8. Repeat in dark theme and confirm the user row remains visible before and after the assistant response.
9. Open an existing completed thread and send a unique marker immediately after its history loads (within two seconds). Confirm the user row appears while the send request is still pending.
10. Use a quick reply that completes within two seconds of the last history read. Confirm both user and assistant rows remain visible without a reload, then reload and compare their contents and counts.
11. With API response interception or a test bridge, delay a `thread/read` response containing only the previous completed turn. Deliver a new assistant delta before releasing that response. Confirm the visible reply and active turn controls remain present.
12. Return a history snapshot containing only a prefix of that assistant item, with the same item ID. Confirm the full streamed text remains visible in exactly one row. Deliver a matching history snapshot during streaming, then another delta; confirm the already displayed prefix is retained. Deliver the completed history and confirm it still renders once.
13. Send the same prompt as an earlier turn. Confirm both user messages remain visible and the newest optimistic row is replaced when its own persisted turn arrives.
14. During a running turn, submit one message in Queue mode and another in Steer mode. Confirm only the steering message immediately appears in the conversation and the queued message stays in the queue.
15. Repeat steps 9–14 in both light and dark themes.

#### Expected Results
- The submitted first user message appears in the conversation pane immediately after send.
- Backend refreshes that contain only the assistant item do not temporarily remove the optimistic user row.
- When the backend later returns the real user item, the optimistic row is replaced without a duplicate.
- Completion events refresh the selected thread even when it was already marked loaded by an optimistic first message.
- Delayed GPT-5.4-mini replies appear automatically when the completion notification arrives; no manual refresh is required.
- Existing-thread sends appear immediately; started/completed events bypass the two-second history reuse window.
- A completion arriving during a pending history read causes a subsequent fresh read and does not restore stale in-progress state.
- An older completed snapshot never deletes an unpersisted live reply or truncates its newer streamed text.
- Persisted and live copies of an assistant item produce exactly one row.
- Identical prompts in different turns remain separate user messages.
- Returning to an unchanged completed thread without events still reuses its cached history.
- Light and dark theme message rows remain readable.

#### Rollback/Cleanup
- Stop the temporary Vite server.
- Remove the temporary isolated `CODEX_HOME` and test project folder.

---
