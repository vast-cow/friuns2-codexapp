# 🔥 codexapp

### 🚀 Run Codex App UI Anywhere: Linux, Windows, or Termux on Android 🚀

[![platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20Android-blue?style=for-the-badge)](#-quick-start)
[![node](https://img.shields.io/badge/Node-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![license](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

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

## 🤯 What Is This?
**`codexapp`** is a lightweight bridge that gives you a browser-accessible UI for Codex app-server workflows.

You run one command. It starts a local web server. You open it from your machine, your LAN, or wherever your setup allows.  

**TL;DR 🧠: Codex app UI, unlocked for Linux, Windows, and Termux-powered Android setups.**

---

## ⚡ Quick Start
> **The main event.**

```bash
# 🔓 Build and run locally (recommended)
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel

# 🌐 Then open in browser
# http://localhost:18923
```

The following commands start `codexapp` without a tunnel:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

To enable a cloudflared tunnel, replace `--no-tunnel` with `--tunnel`.
When enabled, it prints the tunnel URL and terminal QR code without exposing the password.

Password protection is disabled by default (`--no-password`). To enable it, pass
`--password <pass>`. When enabled, all connections require login, including localhost
and Tailscale; no IP address bypasses authentication.

If you are using a provider or AI gateway that is already authenticated and do not want `codexapp` to force `codex login` during startup, use:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel --no-login
```

By default, `codexapp` leaves the sandbox mode to Codex's configuration.
Use `--sandbox-mode` to override it explicitly:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel --sandbox-mode workspace-write
```

Supported modes are `read-only`, `workspace-write`, and `danger-full-access`.
You can also set `CODEXUI_SANDBOX_MODE`; the CLI option takes precedence.

### Linux 🐧
```bash
node -v   # should be 18+
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

### Windows 🪟 (PowerShell)
```powershell
node -v   # 18+
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

### Termux (Android) 🤖
```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

Android background requirements:

1. Keep `codexapp` running in the current Termux session (do not close it).
2. In Android settings, disable battery optimization for `Termux`.
3. Keep the persistent Termux notification enabled so Android is less likely to kill it.
4. Optional but recommended in Termux:
```bash
termux-wake-lock
```
5. Open the shown URL in your Android browser. If the app is killed, return to Termux and run these commands again:

```bash
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

---

## iPhone / iPad via Tailscale Serve

If you want to use codexUI from iPhone or iPad Safari, serving it over HTTPS is recommended.

A practical private setup is to run codexUI locally and publish it inside your tailnet with Tailscale Serve:

```powershell
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel --port 5900
tailscale serve --bg 5900
```

Then open:

```text
https://<your-machine>.<your-tailnet>.ts.net
```

This setup worked well in practice for:

- iPhone Safari access
- Add to Home Screen
- the built-in dictation / transcription feature in the app
- viewing the same projects and conversations from the Windows host

Notes:

- Tailscale Serve keeps access private to your tailnet
- on iOS, HTTPS / secure context appears to be important for mobile browser access and dictation
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
  node dist-cli/index.js --no-tunnel
  ```

- 🌍 Cross-platform support for Linux, Windows, and Termux on Android
- 🖥️ Browser-first Codex UI flow on `http://localhost:18923`
- 🌐 LAN-friendly access from other devices on the same network
- 🧪 Remote/headless-friendly setup for server-based Codex usage
- 🔌 Works with reverse proxies and tunneling setups
- ⚡ No global install required for quick experimentation
- 🎙️ Built-in hold-to-dictate voice input with transcription to composer draft
- 🤖 Optional Telegram bot bridge: send messages to bot, forward into mapped thread, send assistant reply back to Telegram
- 💾 Project portability: export a project as a ZIP from project or thread menus, including matching Codex chat JSONL history under `.codex-project/chats/`
- 📦 Project import: restore exported project ZIPs from the browser via `Import Project`
- 🔁 Imported chats are rewritten for the destination `CODEX_HOME`, project path, and currently selected provider/model so they can be resumed in the new environment
- ⚙️ Project ZIP performance: exports stream ZIP bytes with response backpressure handling and skip generated/git-ignored folders; imports still buffer the selected ZIP once because the browser upload arrives as a single file

### Telegram Bot Bridge (Optional)

Telegram requests use a dedicated connection pool with a 3-second IPv4/IPv6
connection-attempt delay by default; this does not change other network requests.
Explicit Node.js network family auto-selection flags (including those in
`NODE_OPTIONS`) take precedence. Node.js 18.18 or newer is required for the
connection-attempt setting; earlier supported Node.js 18 releases ignore it.
The existing Telegram API request timeout and notification retry policy are unchanged.
Connection failure logs include available error codes and IP/port details without
request URLs or bot tokens.

In Settings → Telegram, save your bot token and allowed user IDs. To receive alerts
for all successful runs, send `/notify on` in a private chat with the bot, or enable
**All completed tasks** and enter that private chat ID in settings. `/notify off`
unsubscribes that chat. This supports one private notification destination; enabling
another replaces it. Selecting a conversation with `/thread` does not change the
subscription. Set **App URL reachable from your phone** to include conversation links
(use your reachable private app URL, not your phone's localhost).

“Run finished” means one successful Codex turn observed by this running backend,
including browser and queued turns. It does not certify that the entire requested
job succeeded. The browser can be closed; the backend must stay running. Other CLI,
desktop, or machine instances are not covered. Failed/interrupted turns do not
produce all-run alerts; existing mapped-thread replies remain separate behavior.

Subscriptions are saved in `<CODEX_HOME>/telegram-bridge.json`. Pending deliveries
survive restart in `telegram-notification-outbox.json`, retry temporary failures
with timeout/backoff and Telegram's retry-after delay, and expose the last delivery
error in Telegram settings (reopen settings to refresh). Permanent API failures
stop retrying. Overlapping subscriptions and thread mappings produce one combined
message, using the exact completed turn for the excerpt. Completion alerts still
send without an excerpt when the thread cannot be read.

The outbox holds up to 1,000 pending messages and remembers the last 2,000 settled
delivery keys. A full queue is reported as a notification error. Very old replayed
events outside that deduplication window can notify again. If Telegram accepts a
message but its response is lost, a retry can also duplicate it. Disabling a
subscription cancels its pending alerts when the queue next processes them.


Set these environment variables before starting `codexapp`:

```bash
export TELEGRAM_BOT_TOKEN="<your-telegram-bot-token>"
export TELEGRAM_ALLOWED_USER_IDS="<your-telegram-user-id>,<optional-second-id>"
export TELEGRAM_DEFAULT_CWD="$PWD" # optional, defaults to current working directory
pnpm install
pnpm run build
node dist-cli/index.js --no-tunnel
```

`TELEGRAM_ALLOWED_USER_IDS` is required for safe access. Only allowlisted Telegram user IDs can use the bridge. If no allowed user IDs are configured, incoming Telegram messages are rejected.

To find your Telegram user ID:

1. Send a message to your bot.
2. Run `curl "https://api.telegram.org/bot<your-telegram-bot-token>/getUpdates"`.
3. Read `message.from.id` from the returned update payload.

Bot commands:

- `/start` show quick help and thread picker
- `/threads` list recent threads and pick one
- `/newthread` create and map a new Codex thread for this Telegram chat
- `/thread <threadId>` map current Telegram chat to an existing thread
- `/current` show currently connected thread for this chat
- `/history` show recent history for current thread
- `/status` show bridge/mapping status
- `/whoami` show your Telegram user/chat IDs and authorization state
- `/help` show command reference

Outgoing assistant messages are sent with Telegram `parse_mode=HTML` for formatting, with automatic plain-text fallback for HTML formatting errors.

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
- 🎙️ Voice dictation flow in composer (`hold to dictate` -> transcribe -> append text)

---

## 🌍 What Can You Do With This?

| 🔥 Use Case | 💥 What You Get |
|---|---|
| 💻 Linux workstation | Run Codex UI in browser without depending on desktop shell |
| 🪟 Windows machine | Launch web UI and access from Chrome/Edge quickly |
| 📱 Termux on Android | Start service in Termux and control from mobile browser |
| 🧪 Remote dev box | Keep Codex process on server, view UI from client device |
| 🌐 LAN sharing | Open UI from another device on same network |
| 🧰 Headless workflows | Keep terminal + browser split for productivity |
| 🔌 Custom routing | Put behind reverse proxy/tunnel if needed |
| ⚡ Fast experiments | `npx` run without full global setup |

---

## 🖼️ Screenshots

### Skills Hub
![Skills Hub](docs/screenshots/skills-hub.png)

### Chat
![Chat](docs/screenshots/chat.png)

### Mobile UI
![Skills Hub Mobile](docs/screenshots/skills-hub-mobile.png)
![Chat Mobile](docs/screenshots/chat-mobile.png)

---

The new-thread and existing-thread composers use the App Server's
`model/list` capabilities for reasoning effort choices. They preserve
`supportedReasoningEfforts` order and resolve incompatible selections to
`defaultReasoningEffort` when supported, or the first supported option.
Missing or empty capability metadata disables the selector and leaves effort
selection to the server. Custom-provider model IDs alone do not imply reasoning
support, and capabilities are scoped to the provider. Direct and queued turns
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
- ✅ Microphone permission (only for voice dictation)

---

## 🐛 Troubleshooting

| ❌ Problem | ✅ Fix |
|---|---|
| Port already in use | Run on a free port or stop old process |
| `npx` fails | Update npm/node, then retry |
| Termux install fails | `pkg update && pkg upgrade` then reinstall `nodejs` |
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
