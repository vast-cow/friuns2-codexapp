# External Codex app-server

Start these independently with the same user, working paths, and `CODEX_HOME`:

```sh
codex app-server --listen ws://127.0.0.1:4500
# Another terminal:
node dist-cli/index.js --app-server-url ws://127.0.0.1:4500
# Or development:
CODEXUI_APP_SERVER_URL=ws://127.0.0.1:4500 pnpm run dev --host 127.0.0.1 --port 4173
```

Endpoint precedence is CLI `--app-server-url`, then `CODEXUI_APP_SERVER_URL`,
then `ws://127.0.0.1:4500`. Both `ws` and `wss` are supported. URL credentials
and fragments are rejected. The browser's `/codex-api/ws` is a separate socket.
The backend requires no Codex installation and never launches or kills app-server.

Authentication and provider, sandbox, approval, and memories defaults belong to
Codex. Manage authentication in the server environment (for example `codex login`).
The old web login endpoints return an explanation instead of launching a CLI.
Account reads and logout use server RPCs. Legacy process configuration flags are
rejected; explicit per-thread RPC settings are preserved. `--login`/`--no-login`
are compatibility no-ops; the `login` command explains external authentication.

After a disconnect, pending operations fail and approval requests are discarded.
Retrying an operation opens a fresh connection and handshake; requests are never
replayed automatically. Before resending a turn, read its thread to check whether
the server accepted it. To explicitly reconnect and resume known thread subscriptions
without restarting the web backend:

```sh
curl -X POST http://localhost:5900/codex-api/reconnect
```

With password protection, authenticate the HTTP request first. Resuming threads
can fail if the server no longer has a thread; inspect the error and reopen it.
Connection plus initialization has a ten-second deadline. Check the listener,
URL, TLS trust, and server logs on failures. Shutdown closes the connection only.

Filesystem browsing, uploads, session recovery/indexing, git, skills, and credential
refresh assume shared local files. Merely specifying a remote WebSocket URL does
not support a split-host deployment; paths, credentials and `CODEX_HOME` must match.

Method-picker metadata is packaged in `src/server/appServerMethods.json`, extracted
from the checked-in `documentation/app-server-schemas/json` snapshot. It is advisory,
not feature negotiation. Update it with protocol schema changes; no runtime schema
command is executed. The snapshot's originating Codex version is not recorded.

Validation uses a local `ws` protocol fixture. No Codex executable or Docker is
available in this environment, so no real Codex version, authenticated turns,
provider Docker matrix, or external Codex process survival has been validated.

Performance audit: the regression fixture asserts three concurrent connection
requests produce one socket and one initialize exchange; the bridge fixture
asserts concurrent reconnects produce one replacement socket and one thread resume.
Notifications are delivered once per server frame, and there is no retry timer or
request replay loop. Resume restoration is sequential (one request per known
thread), avoiding concurrent fanout. Method metadata is bundled, removing process
startup and schema filesystem work. Browser payloads and browser notification
transport are unchanged; disconnect invalidates live thread caches. No browser
profile or real-server latency measurements were collected.
