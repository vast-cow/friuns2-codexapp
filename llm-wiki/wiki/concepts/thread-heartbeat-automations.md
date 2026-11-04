# Thread Heartbeat Automations

Application-specific automation management is removed. There is no Automations panel, sidebar creation/editor action, scheduling/status control, manual run route, or automation TOML read/write service in the client. Existing automation data and external scheduling services remain untouched, including when a thread is archived or a project is removed.

Normal conversation queues, streaming, resumption, and shared background processing remain. Historical heartbeat messages retain read-only instruction rendering.

Source: [automation management removal](../../raw/features/automation-management-removal.md). Earlier implementation details remain archived in [the historical source](../../raw/features/thread-heartbeat-automations.md).
