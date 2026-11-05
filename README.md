# codexapp

A browser interface for the official Codex app-server, hosted on Windows or Linux.
Desktop and mobile browsers (including Android and iOS) can connect to the host;
responsive UI and PWA functionality are available.

## Quick start

Install Node.js 18+, pnpm, and the official Codex CLI (`npm install -g @openai/codex`).
From the repository root, in a Linux shell or Windows PowerShell:

```sh
pnpm install
pnpm run build
node dist-cli/index.js
```

Open the printed URL (default: `http://localhost:5900`). If the port is occupied,
the CLI tries the next available port. Sign in to Codex when prompted, or use
`--no-login` to open the UI before signing in.

Password protection is disabled by default. Use `--password <pass>` to enable it,
and configure a private network or external reverse proxy for remote access.

## Documentation

- [Usage, configuration, mobile access, and troubleshooting](docs/usage.md)
- [Local development and optional HTTPS](docs/development.md)
- [Maintenance and publishing](docs/maintenance-scope.md)
- [Manual tests](tests.md)

Forked from [pavel-voronin/codex-web-local](https://github.com/pavel-voronin/codex-web-local).

Optional [Telegram completion notifications](docs/usage.md#telegram-completion-notifications-optional) notify successful turns while the backend is running.
