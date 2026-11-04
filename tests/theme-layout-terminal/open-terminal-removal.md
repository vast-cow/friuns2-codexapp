# Open Terminal removal

## Setup
Run the app at http://127.0.0.1:4173 with an existing project and conversation. Repeat in light and dark themes.

## Actions and expected results
1. Open Home with a project selected, then an existing thread. No Open Terminal button, dropdown, panel, or terminal controls appear. Header actions remain right aligned.
2. Press Ctrl+J and Cmd+J on each route, including with the composer focused. No terminal opens. Ctrl/Cmd+B still toggles the sidebar.
3. Reload with legacy terminal-open and quick-command localStorage entries present. No terminal appears and no thread-terminal requests occur.
4. Confirm branch management controls remain absent. Open the worktree creation flow and code review: their controls remain available.
5. Send a Codex request that executes a harmless command such as pwd. Command output remains visible in the conversation. Open another saved conversation and confirm history loads.

## Cleanup
Delete only test conversations/worktrees created for this check. Remove test screenshots if no longer needed.
