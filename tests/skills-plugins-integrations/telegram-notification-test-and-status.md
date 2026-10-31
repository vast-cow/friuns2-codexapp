# Telegram notification test and status

## Setup

Configure a Telegram bot and a private chat ID. Keep access to the destination chat and, for the failure case, a way to temporarily block Telegram network access. Use light and dark themes.

## Actions and expected results

1. Open Telegram settings. Confirm the current status refreshes and testing is unavailable with an explanation when the token or private chat ID is missing or an edit is unsaved.
2. Save valid settings and send a test notification. Confirm a message arrives in the private chat, the success and timestamp appear, and repeated clicks cannot start another request while it is sending. Reopen settings and restart the application; confirm the result and timestamp remain.
3. Block Telegram connectivity and retry. Confirm the failure, troubleshooting guidance, and technical details appear. Restore connectivity and retry after the rate limit. Confirm success replaces the test failure.
4. With a normal notification awaiting retry, send a successful test. Confirm the pending/retrying count remains visible. Restore normal delivery and confirm its success timestamp updates and the resolved error disappears.
5. Change the token or destination and save. Confirm the old verification result does not appear for the changed configuration. Check the same flows in both themes.

## Cleanup

Restore network access and the original bot configuration. Remove test messages from the chat if desired.
