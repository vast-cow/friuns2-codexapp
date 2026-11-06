# Project Cron Automations

Application-specific automation management is removed. There is no Automations panel, sidebar creation/editor action, scheduling/status control, manual run route, or automation TOML read/write service in the client. Existing automation data and external scheduling services remain untouched, including when a thread is archived or a project is removed.

Normal conversation streaming, resumption, and Telegram notification delivery remain. Deferred prompt queues and their workers are removed. Historical heartbeat messages retain read-only instruction rendering.

Source: [automation management removal](../../raw/features/automation-management-removal.md). Earlier implementation details remain archived in [the historical source](../../raw/features/project-cron-automations.md).

Current prompt behavior: [immediate steering](../../raw/features/immediate-steering.md).
