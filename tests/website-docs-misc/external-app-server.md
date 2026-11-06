# External app-server connection

Prerequisites: build with `pnpm run build`; start Codex independently with
`codex app-server --listen ws://127.0.0.1:4500`. Use matching CODEX_HOME and paths.

1. Start `node dist-cli/index.js --app-server-url ws://127.0.0.1:4500`.
2. List/read threads, create and resume a thread, send a turn, interrupt a turn,
   and accept/reject a tool approval. Expect correlated replies and one stream.
3. Stop the external server while a turn runs. Expect an actionable connection
   error; restarting it must not replay the turn.
4. POST `/codex-api/reconnect`, then inspect the thread before sending again.
   Expect a fresh handshake and restored subscriptions, without duplicate events.
5. Stop the web backend. Expect the independently started Codex process to survive.
6. Repeat using CODEXUI_APP_SERVER_URL in development; verify CLI overrides env,
   and invalid schemes fail. Verify account status reflects server authentication.
7. Check settings in light/dark themes: login errors must explain external ownership.

Cleanup: stop only test processes manually; remove test threads if desired.
Automated fixture coverage is in `appServerWebSocketClient.test.ts`.
