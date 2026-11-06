# Telegram completion notifications

Prerequisites: running backend, a bot token and destination chat ID, and a backup of
`<CODEX_HOME>/telegram-bridge.json` and `telegram-notification-outbox.json`.

1. Open Settings → Telegram in light and dark themes. Check only notification
   enablement, token, destination, optional URL, test, save, and delivery feedback appear.
2. Save a token, destination and URL; send a test. Expect one message with no startup message.
3. Complete a browser turn, then start another browser turn and close the browser while it runs. Expect one alert per successful turn with title, completed status and link.
4. Fail or interrupt a turn. Expect no alert. Send bot commands or text to Telegram;
   expect no conversation activity and no incoming Telegram API requests.
5. Disable alerts and finish a turn. Expect no Telegram requests. Explicit tests still work.
6. Restart the backend. Reopen settings; expect saved values and pending completion
   deliveries to survive. Load a legacy configuration with completion settings;
   expect the same destination and enabled state, no allowlist control, and no loss
   of legacy fields on disk when saving.
7. Replay a completion event; expect no duplicate. Simulate a temporary send failure;
   expect a retry with backoff. Permanent failures surface in settings.

Cleanup: restore the backed-up files with the backend stopped. Remove test messages.
