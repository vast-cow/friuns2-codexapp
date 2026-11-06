# Immediate steering without deferred prompts

Evidence: `src/composables/useDesktopState.ts`, `src/api/codexGateway.ts`, `src/components/content/ThreadComposer.vue`, `src/server/codexAppServerBridge.ts`, `src/server/directoryRoutes.test.ts`, and `src/composables/useDesktopState.messages.test.ts`.

The deferred prompt queue is removed. Idle and busy composer submissions call the immediate Codex turn path. There is no queue editor, busy-send preference reader, persisted prompt recovery, queue API route, or backend prompt worker. Legacy `thread-queue-state` data remains inert and untouched. Hot reload retires cached legacy workers and blocks their old RPC path. Telegram notification delivery, event debouncing, workspace mutation serialization, pending approvals, and historical heartbeat rendering remain independent functionality.

Earlier raw sources describing queued turns are historical snapshots, not current behavior.
