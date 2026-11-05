### Skills and MCP directory

Prerequisites: run the current dev server; configure a local skill and MCP server (OAuth optional).

1. Open `#/skills`, including stale `?tab=plugins` and `?tab=apps` links.
2. Verify Skills & MCPs appears with no catalog tabs, plugin cards, or app controls.
3. Search Skills, inspect a result, install it, toggle the local skill and remove the test installation.
4. Expand an MCP server and inspect tools/resources. Authenticate if required, then Refresh.
5. Repeat at 1440x1000, 375x812 and 768x1024 in light and dark themes.
6. Inspect network traffic: no `plugin/*`, `app/list`, or connector-logo requests; Skills and MCP requests remain.

Expected: local Skills and MCP inspection/reload work; controls fit each viewport and surfaces follow the selected theme. Generic RPC and account settings remain available.

Cleanup: remove test skills and restore MCP configuration changed during setup.

Verification for catalog removal:

- Production build passes. DirectoryHub JS: 37.14 → 19.58 kB (gzip 10.78 → 6.46); CSS: 62.68 → 41.34 kB (gzip 5.86 → 4.32). Shared CSS: 288.94 → 289.05 kB.
- Playwright mounts the real DirectoryHub at `http://127.0.0.1:4173/skills-check` with controlled API fixtures, at 1440x1000, 375x812 and 768x1024 in both themes. MCP expansion, tool inspection, refresh, local skill visibility, no catalog tabs, no horizontal overflow, theme backgrounds and zero page errors pass. Screenshots: `output/playwright/skills-mcp-{width}-{theme}.png`.
- Initial requests: one Skills list, one method catalog, one MCP status. Refresh adds one reload and one status request. No plugin, app or connector-logo requests. No polling, new cache, blocking filesystem work, or request fanout is introduced; existing MCP pagination remains. Live network latency and authenticated OAuth were not measured.
- The full unit suite has one existing failure in `useDesktopState.test.ts` (`refreshes a loaded optimistic thread when completion events arrive`), also reproduced against an untouched HEAD snapshot. Directory and gateway regression tests pass.
