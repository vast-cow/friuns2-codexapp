# codexapp

A browser interface for the official Codex app-server, hosted on Windows or Linux.
Desktop and mobile browsers (including Android and iOS) can connect to the host;
responsive UI is available in desktop and mobile browsers.

## Quick start

Install Node.js 18+ and pnpm for the web backend. Separately install Codex for the external server.
From the repository root, in a Linux shell or Windows PowerShell:

```sh
pnpm install
pnpm run build
# Separate terminal, same user and CODEX_HOME:
codex app-server --listen ws://127.0.0.1:4500
# Web backend:
node dist-cli/index.js --app-server-url ws://127.0.0.1:4500
```

Open the printed URL (default: `http://localhost:5900`). If the port is occupied,
the CLI tries the next available port. Authentication and runtime defaults belong
to the external server. See the [connection guide](docs/external-app-server.md).

Password protection is disabled by default. Use `--password <pass>` to enable it,
and configure a private network or external reverse proxy for remote access.

## Documentation

- [Usage, configuration, mobile access, and troubleshooting](docs/usage.md)
- [Local development and optional HTTPS](docs/development.md)
- [Maintenance and publishing](docs/maintenance-scope.md)
- [Manual tests](tests.md)

Forked from [pavel-voronin/codex-web-local](https://github.com/pavel-voronin/codex-web-local).

Optional [Telegram completion notifications](docs/usage.md#telegram-completion-notifications-optional) notify successful turns while the backend is running.
