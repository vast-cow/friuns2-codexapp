### Termux install without native PTY build

#### Feature/Change Name
Open Terminal removal eliminates the native PTY dependency on all platforms.

#### Prerequisites/Setup
1. Android device or emulator with Termux, Node.js, and npm installed.
2. Network access to npm and GitHub.

#### Steps
1. After publishing a version containing this change, run `npm i -g codexapp@latest` in Termux.
2. Confirm no node-pty build or PTY postinstall hook runs.
3. Run `codexapp --no-login`, open the printed URL, and load a conversation.
4. Confirm Open Terminal is absent and conversations still load.

#### Expected Results
- Installation needs no native PTY binary.
- App startup and conversation loading work without integrated terminal controls.

#### Rollback/Cleanup
Remove the test install with `npm rm -g codexapp`.
