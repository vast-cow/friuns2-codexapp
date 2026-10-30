### Feature: Telegram chatIds persisted for bot DM sending

#### Prerequisites
- App server is running from this repository.
- Telegram bot already configured in the app.
- Access to `~/.codex/telegram-bridge.json`.

#### Steps
1. Send `/start` to the Telegram bot from your DM.
2. Wait for the app to process the update, then open `~/.codex/telegram-bridge.json`.
3. Confirm `chatIds` contains your DM chat id as the first element.
4. In the app, reconnect Telegram bot with the same token.
5. Re-open `~/.codex/telegram-bridge.json` and confirm `chatIds` remains present.

#### Expected Results
- `chatIds` is written after Telegram DM activity.
- `chatIds` persists across bot reconfiguration.
- `botToken`, `chatIds`, and `allowedUserIds` are all present in `~/.codex/telegram-bridge.json`.

#### Rollback/Cleanup
- Remove `chatIds` or delete `~/.codex/telegram-bridge.json` to clear persisted chat targets.

### Feature: All successful turn notifications

#### Prerequisites
- Running backend, configured bot and allowlisted user, and a private bot chat.
- A reachable app URL saved in Telegram settings. Preserve existing Telegram configuration before changing it.

#### Steps
1. Send `/notify on` in the private chat. Reopen Telegram settings and confirm the enabled subscription and chat ID.
2. Complete successful turns in two unrelated browser threads; select another thread using `/thread` between them.
3. Queue successive turns with distinct replies. Close the browser while they run, then inspect Telegram.
4. Follow a thread in Telegram and complete another turn in that thread. Complete a turn with no assistant text, then fail or interrupt another turn.
5. In an isolated development setup, replay the same `turn/completed` event twice concurrently, then restart the backend and replay it again.
6. With outbound Telegram temporarily unavailable, complete a turn, restart the backend, restore connectivity, and wait for retry. Simulate HTTP 429 with `retry_after`, then a permanent 403 response.
7. Reopen settings in light and dark themes. Inspect the last notification error. Disable notifications using `/notify off` and complete another unmapped turn.

#### Expected Results
- Successful turns observed by this backend notify the subscribed chat independently of conversation selection and browser presence.
- Combined alerts are sent once when mapping and subscription overlap. Excerpts belong to the exact completed turn, with title/project and reachable conversation link.
- A successful turn without text still alerts. Failed/interrupted turns do not generate all-run alerts.
- Duplicate events within the retained 2,000 receipt window reserve one job per bot/chat/thread/turn. Queued turns remain distinct.
- Pending jobs survive restart, temporary failures back off, 429 respects retry-after, and permanent errors stop retries and remain visible in settings.
- Notification controls are readable in both themes. Unsubscribing cancels queued subscription alerts and prevents new ones; mapped-thread replies continue.
- Stop/start does not accumulate event listeners or polling loops. Unauthorized senders and group chats cannot subscribe using `/notify`.

#### Rollback/Cleanup
- Send `/notify off`, restore prior settings, and remove test threads. Stop the backend before restoring backed-up Telegram files or deleting the test outbox; deleting it also removes deduplication receipts.
