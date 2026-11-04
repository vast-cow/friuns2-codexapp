# Directory integration boundary

Implementation evidence: `src/components/content/DirectoryHub.vue`, `src/App.vue`, `src/api/codexGateway.ts`, and `src/server/codexAppServerBridge.ts`.

DirectoryHub exposes Plugins, Apps, and Skills. Unknown tab values, including the removed `composio` value, fall back to Skills. Local Skills discovery, search, installation, selection and enable/disable, Codex Apps, Plugins, and MCP listing retain their independent code paths.

The application-specific Composio UI, connector ranking, six backend routes (status, connectors, connector, link, login, install), external CLI helpers, developer-specific attached Skills path, API models and gateway functions are removed. No user-owned external CLI installations, credentials or Skills files are deleted. Composio is no longer an application dependency.
