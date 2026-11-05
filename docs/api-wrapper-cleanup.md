# API wrapper cleanup

The application loads thread lists through `getThreadGroupsPage` and conversation history through `getThreadDetail` and its windowed history helpers. The unused `getThreadGroups` and `getThreadMessages` frontend wrappers and their exclusive helpers have been removed.

The unused `getThreadReviewResult` and `startThreadReview` wrappers, private review text parsers, and UI review result types have been removed. Generic RPC transport remains available for `review/start`; upstream protocol schemas and documentation remain unchanged.

The unused `getNotificationCatalog` and `fetchRpcNotificationCatalog` frontend wrappers have been removed. `getMethodCatalog` and its server schema generation remain available for capability detection. Notification subscriptions and handling are unchanged.

The following HTTP APIs are retained because repository searches cannot establish whether external clients rely on them:

- `/codex-api/meta/notifications`, including its catalog generation and cache.
- GET/PUT `/codex-api/preferences/first-launch-plugins-card`, including the persisted dismissal key. The current UI does not fetch this preference.
- `/codex-local-file`, in development and production, including service-worker bypass behavior.

The active `/codex-local-browse` and `/codex-local-edit` routes remain unchanged. No persisted preference data is deleted.
