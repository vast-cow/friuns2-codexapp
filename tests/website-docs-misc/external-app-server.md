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

## Disconnect recovery and subscription retirement

Prerequisites: build with `pnpm run build`; install dependencies. For deterministic
coverage without Codex, run `node scripts/test-external-app-server.cjs` (ports
4198 and 4199 must be free), then
`pnpm exec vitest run src/server/appServerClient.test.ts src/server/appServerWebSocketClient.test.ts`.

Actions: start a real external server and the web backend as described in
[the deployment guide](../../docs/external-app-server.md). Start a streaming
turn, stop the external server, then restart it and explicitly reconnect.
Archive a subscribed thread, reconnect again, and reopen another thread.

Expected: the disconnected browser stops showing the turn as running, clears
approvals and warns to inspect the thread before resending. No turn is replayed.
Archived/unsubscribed threads are not resumed; remaining subscriptions resume
once. Connected-server account status is read again after disconnect.
The controlled integration script checks both built and dev entry points,
CLI/environment endpoint precedence, HTTP RPC, browser WebSocket readiness,
bundled method metadata, one upstream connection/initialize per backend,
and fixture listener survival after backend shutdown.

Cleanup: the script terminates only its own backend process groups and fixture.
Real-server checks require stopping the independently launched server separately.
A fixture result does not establish real Codex process survival or authenticated
streaming/approval behavior.
