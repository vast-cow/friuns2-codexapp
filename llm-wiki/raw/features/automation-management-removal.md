# Application automation management removal

The application no longer manages thread heartbeat or project cron automation records. Its Automations route/panel, sidebar actions/badges/dialogs, schedule/status controls, bridge CRUD/list/run routes, TOML parsing/writing, manual heartbeat enqueue helper, and thread/project removal side effects are removed. Existing `$CODEX_HOME/automations` data and external schedulers are not modified.

There was no application schedule-tick worker in these paths. Normal queue drain scheduling, Telegram processing, SSE keepalive, Codex thread/resume and turn streaming remain independent and retained. Read-only heartbeat envelope parsing/rendering remains for historical conversation readability. Automated route regressions verify retired endpoints fall through without touching existing TOML/memory files.
