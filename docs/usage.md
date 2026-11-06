# 🔥 codexapp

### 🚀 Run Codex App UI Anywhere: Linux and Windows 🚀

[![platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-blue?style=for-the-badge)](#-quick-start)
[![node](https://img.shields.io/badge/Node-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![license](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](../LICENSE)

> **Codex UI in your browser. No drama. One command.**
>  
> **Yes, that is your Codex desktop app experience exposed over web UI. Yes, it runs cross-platform.**

```text
 ██████╗ ██████╗ ██████╗ ███████╗██╗  ██╗██╗   ██╗██╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝╚██╗██╔╝██║   ██║██║
██║     ██║   ██║██║  ██║█████╗   ╚███╔╝ ██║   ██║██║
██║     ██║   ██║██║  ██║██╔══╝   ██╔██╗ ██║   ██║██║
╚██████╗╚██████╔╝██████╔╝███████╗██╔╝ ██╗╚██████╔╝██║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝
```

---


Messages submitted while a turn is running are sent immediately using Steer. There is no deferred prompt queue. Legacy queue data and the former busy-send preference are ignored. Stop remains available during generation.

## 🤯 What Is This?
**`codexapp`** is a lightweight bridge that gives you a browser-accessible UI for Codex app-server workflows.

You run one command. It starts a local web server. You open it from your machine, your LAN, or wherever your setup allows.  

**TL;DR 🧠: Codex app UI, unlocked for Linux and Windows.**

---

## ⚡ Quick Start
> **The main event.**

```bash
# 🔓 Build and run locally (recommended)
pnpm install
pnpm run build
node dist-cli/index.js

# 🌐 Then open in browser
# http://localhost:5900
```

Start the local server with:

```bash
pnpm install
pnpm run build
node dist-cli/index.js
```

For remote access, configure an external reverse proxy or private network connection.

Password protection is disabled by default (`--no-password`). To enable it, pass
`--password <pass>`. When enabled, all connections require login, including localhost
and Tailscale; no IP address bypasses authentication.

To start the web UI before signing in to Codex, use:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --no-login
```

By default, `codexapp` leaves the sandbox mode to Codex's configuration.
Use `--sandbox-mode` to override it explicitly:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --sandbox-mode workspace-write
```

Supported modes are `read-only`, `workspace-write`, and `danger-full-access`.
You can also set `CODEXUI_SANDBOX_MODE`; the CLI option takes precedence.

### Linux 🐧
```bash
node -v   # should be 18+
pnpm install
pnpm run build
node dist-cli/index.js
```

### Windows 🪟 (PowerShell)
```powershell
node -v   # 18+
pnpm install
pnpm run build
node dist-cli/index.js
```

---

## iPhone / iPad via Tailscale Serve

If you want to use codexUI from iPhone or iPad Safari, serving it over HTTPS is recommended.

A practical private setup is to run codexUI locally and publish it inside your tailnet with Tailscale Serve:

```powershell
pnpm install
pnpm run build
node dist-cli/index.js --port 5900
tailscale serve --bg 5900
```

Then open:

```text
https://<your-machine>.<your-tailnet>.ts.net
```

This setup worked well in practice for:

- iPhone Safari access
- Add to Home Screen
- viewing the same projects and conversations from the Windows host

Notes:

- Tailscale Serve keeps access private to your tailnet
- on iOS, HTTPS / secure context appears to be important for mobile browser access
- some minor mobile Safari CSS issues may still exist, but they do not prevent normal use
- depending on proxying details, authentication behavior may differ from direct remote access
- if conversations created in the web UI do not immediately appear in the Windows app, restarting the Windows app may refresh them

---

## ✨ Features
> **The payload.**

- 🚀 Build and launch locally:

  ```bash
  pnpm install
  pnpm run build
  node dist-cli/index.js
  ```

- 🌍 Cross-platform support for Linux and Windows
- 🖥️ Browser-first Codex UI flow on `http://localhost:5900`
- 🌐 LAN-friendly access from other devices on the same network
- 🧪 Remote/headless-friendly setup for server-based Codex usage
- 🔌 Works with reverse proxies and tunneling setups
- ⚡ No global install required for quick experimentation
- 🤖 Optional [Telegram completion notifications](#telegram-completion-notifications-optional)

### Telegram Completion Notifications (Optional)

In Settings → Telegram, enter a bot token and one destination chat ID, enable
completion notifications, and save. Use **Send Test Notification** to check delivery.
The optional application URL adds a conversation link; use an address reachable
from your phone. Negative group chat IDs are also supported.

The running backend observes successful `turn/completed` events, including turns
submitted from the browser, even after the browser closes. A completed turn does not
guarantee the whole requested task succeeded. Failed and interrupted turns do not
notify. Telegram cannot create, select, read, or modify conversations, and incoming
messages and bot commands are not processed.

Existing tokens and completion settings remain in `<CODEX_HOME>/telegram-bridge.json`.
Legacy fields are ignored and preserved on disk when saving; stored files are not
deleted. Existing notification destinations and enabled state are retained. Legacy
chat lists and allowlists do not automatically become notification subscriptions.
Only the first explicitly configured notification destination is used.

The persistent `telegram-notification-outbox.json` retains pending completion alerts
and the last 2,000 settled delivery keys across restarts. Legacy conversation-forwarding
jobs are ineligible and never sent. Requests time out after 15 seconds; temporary
failures retry with exponential backoff and Telegram retry-after delays, up to ten
attempts within 24 hours. Permanent API failures stop retrying. The queue holds up
to 1,000 pending alerts and exposes delivery errors in settings.

Duplicate events are suppressed within the receipt window. Telegram can still
receive a duplicate if it accepts a message but its response is lost before the
backend records delivery. Disabling notifications stops the worker and all
background Telegram requests; pending alerts are rechecked when enabled again.
A test notification is an explicit request and works while completion alerts are disabled.
No events are monitored while the backend is stopped.

Telegram uses a dedicated connection pool with a 3-second IPv4/IPv6 connection
attempt delay (Node.js 18.18+). Explicit Node network family flags take precedence.
Connection logs redact bot tokens.

---

## 🧩 Recent Product Features (from main commits)
> **Not just launch. Actual UX upgrades.**

- 🗂️ Searchable project picker in new-thread flow
- ➕ "Create Project" button next to "Select folder" with browser prompt
- 📌 New projects get pinned to top automatically
- 🧠 Smart default new-project name suggestion via server-side free-directory scan (`New Project (N)`)
- 🔄 Project order persisted globally to workspace roots state
- 🧵 Optimistic in-progress threads preserved during refresh/poll cycles
- 📱 Mobile drawer sidebar in desktop layout (teleported overlay + swipe-friendly structure)
- 🎛️ Skills Hub mobile-friendly spacing/toolbar layout improvements
- 🪟 Skill detail modal tuned for mobile sheet-style behavior
- 🧪 Skills Hub event typing fix for `SkillCard` select emit compatibility

---

## 🌍 What Can You Do With This?

| 🔥 Use Case | 💥 What You Get |
|---|---|
| 💻 Linux workstation | Run Codex UI in browser without depending on desktop shell |
| 🪟 Windows machine | Launch web UI and access from Chrome/Edge quickly |
| 🧪 Remote dev box | Keep Codex process on server, view UI from client device |
| 🌐 LAN sharing | Open UI from another device on same network |
| 🧰 Headless workflows | Keep terminal + browser split for productivity |
| 🔌 Custom routing | Put behind reverse proxy/tunnel if needed |
| ⚡ Fast experiments | `npx` run without full global setup |

---

## 🖼️ Screenshots

### Skills Hub
![Skills Hub](screenshots/skills-hub.png)

### Chat
![Chat](screenshots/chat.png)

### Mobile UI
![Skills Hub Mobile](screenshots/skills-hub-mobile.png)
![Chat Mobile](screenshots/chat-mobile.png)

---

The new-thread and existing-thread composers use the App Server's
`model/list` capabilities for reasoning effort choices. They preserve
`supportedReasoningEfforts` order and resolve incompatible selections to
`defaultReasoningEffort` when supported, or the first supported option.
Missing or empty capability metadata disables the selector and leaves effort
selection to the Codex app-server. Reasoning capabilities come from its model catalog. Turns
validate explicit efforts before submission.

## 🏗️ Architecture

```text
┌─────────────────────────────┐
│  Browser (Desktop/Mobile)   │
└──────────────┬──────────────┘
               │ HTTP/WebSocket
┌──────────────▼──────────────┐
│         codexapp            │
│  (Express + Vue UI bridge)  │
└──────────────┬──────────────┘
               │ RPC/Bridge calls
┌──────────────▼──────────────┐
│      Codex App Server       │
└─────────────────────────────┘
```

---

## 🎯 Requirements
- ✅ Node.js `18+`
- ✅ Codex app-server environment available
- ✅ Browser access to host/port

---

## 🐛 Troubleshooting

| ❌ Problem | ✅ Fix |
|---|---|
| Port already in use | Run on a free port or stop old process |
| `npx` fails | Update npm/node, then retry |
| Can’t open from other device | Check firewall, bind address, and LAN routing |

---

## 🤝 Contributing
Issues and PRs are welcome.  
Bring bug reports, platform notes, and setup improvements.

---

## ⭐ Star This Repo
If you believe Codex UI should be accessible from **any machine, any OS, any screen**, star this project and share it. ⭐

<div align="center">
Built for speed, portability, and a little bit of chaos 😏
</div>

---

Forked from [pavel-voronin/codex-web-local](https://github.com/pavel-voronin/codex-web-local) by Pavel Voronin.
