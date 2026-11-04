### Codex.app-style Plugins Directory

#### Feature/Change Name
The `#/skills` route shows a full Skills & Apps directory with Plugins, Apps, and a Skills tab where an `MCPs(count)` section appears just before `Installed skills (count)`.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`
2. Codex CLI available in `PATH`
3. Optional: a Codex CLI version with `plugin/list`, `app/list`, and `mcpServerStatus/list` app-server APIs

#### Steps
4. Open `http://127.0.0.1:4173/#/skills`
5. Verify the page title is `Skills & Apps` and the tab row contains `Plugins`, `Apps`, and `Skills`
6. On `Plugins`, verify plugin cards load, the default sort is `Popular`, and `A-Z`, `Date`, and search controls work
7. Open a plugin card when one is available and verify description, capabilities, included apps/skills/MCPs, and install/uninstall or enable/disable actions are visible
8. For an installed plugin with bundled MCP servers, such as Cloudflare, verify each MCP row shows auth status (`Logged in`, `Bearer token`, `Login required`, `Auth unsupported`, or `Status unknown`)
9. If a bundled MCP server shows `Login required`, click `Authenticate` and verify the browser opens the returned MCP OAuth authorization URL
10. Switch to `Apps` and verify app cards load, or the unavailable/empty state appears without breaking the page
11. On `Apps`, verify the default sort control is `Popular`, app icons render, connected apps show `Manage`, and disconnected apps show `Login`
12. Click a disconnected app `Login` button and verify it opens the app login/manage URL
13. Click `Try it!` for a connected and enabled app and verify a new thread opens with an auto-submitted prompt asking what the app can do
14. While the app `Try it!` request is starting, click the button repeatedly and verify only one new thread is created
15. Open an installed/enabled plugin detail, click `Try it!`, and verify a new thread opens with an auto-submitted plugin test prompt
16. Open an installed/enabled skill detail, click `Try it!`, and verify a new thread opens with an auto-submitted skill test prompt and the skill attached
17. Install a plugin whose install response includes `appsNeedingAuth`, and verify the first required app login/manage URL opens automatically
18. Open a plugin whose detail lists a required app that is absent from the Apps catalog for the current account, such as Gmail on an account without Gmail app access, and verify the footer shows a disabled `ChatGPT Plus` action instead of `Install`
19. Switch Apps sorting to `A-Z` and verify apps reorder alphabetically; switch to `Date` and verify app-server catalog order is restored; switch back to `Popular` and verify casual-user relevant apps are prioritized and capped to 100 when no search is active
20. Search Apps and verify matching results are not capped to the Popular top 100 list
21. Switch to `Skills` and verify the view shows an `MCPs(count)` collapsible section immediately before the `Installed skills (count)` section
22. Expand `MCPs(count)` and verify server cards show auth status and tool/resource counts, or the unavailable/empty state appears without breaking the page
23. Click header `Refresh` while on `Skills` and verify MCP state reloads (it should perform MCP reload behavior on this tab instead of using a separate `Reload MCPs` button)
24. Verify no separate `Reload MCPs` button is shown in the header or inside the MCP section body
25. Verify the `MCPs(count)` section does not show its own search or sort controls
26. Verify MCP cards use the same visual card/grid layout pattern as Installed skills cards (avatar circle, title row, badge, secondary text)
27. Verify the `Installed skills (count)` section below MCPs still supports the existing Skills Hub behavior
28. In dark mode, verify MCP cards use the same dark card surface styling as Installed skills cards (not a light/white card)

#### Expected Results
- The directory tabs render without a full-page error
- Plugin/app API failures are isolated to their tab
- Existing Skills Hub behavior remains available under the `Skills` tab, with MCPs presented just before Installed skills
- App and plugin enable/disable actions update their local card state after a successful config write
- Plugin detail shows bundled MCP login state and can launch MCP OAuth for `notLoggedIn` servers
- Disconnected apps are labeled `Login`; connected apps are labeled `Manage`
- Plugin install opens the first required app login/manage page before falling back to bundled MCP OAuth login
- Plugin install is blocked with `ChatGPT Plus` when the plugin requires an app that is absent from the Apps catalog for the current account
- Connected and enabled apps, plus installed/enabled plugins/skills, expose `Try it!`, creating a new chat with an auto-submitted test prompt
- Repeated `Try it!` clicks during startup are ignored until the first request resolves, so duplicate threads are not created
- Plugins, Apps, and the Skills-tab MCP section default to local popularity-style ordering because app-server does not expose numeric popularity fields
- The Skills tab presents MCPs in the same section style as Installed skills, just above Installed skills, instead of using a separate top-level MCP tab
- `Date` uses the app-server/catalog order as the available freshness proxy because app/plugin/MCP APIs do not expose created or published timestamps
- Popular views show only the top 100 when no search is active; search results can show all matches

#### Rollback/Cleanup
- Re-enable any app or plugin disabled during testing
- Uninstall any plugin installed only for this test

---

#### Removed integration regression
- Open `#/skills?tab=composio`: Skills remains usable as the fallback, with only Plugins, Apps, and Skills tabs and no empty connector panel.
- Navigate all remaining tabs, search their catalogs, and verify local Skills selection/enable/disable and MCP listing still work.
- Assert no `/codex-api/composio/*` requests, onboarding actions, external CLI probes, or developer-specific automatic skill attachments occur.
- Removed endpoints fall through to unmatched-route handling. Existing external CLI installations, credentials, and user-owned skills are not deleted.

#### Performance audit
Removed Composio list/status/detail requests, pagination, search timers, CLI subprocesses and install/login actions. Other tabs retain their existing request paths and bounded local sorting. No new requests, caches, payloads, blocking work, or fanout are introduced. Live latency was not measured.

#### Verification boundary
- Production build including frontend typecheck and public ESM CLI smoke `node dist-cli/index.js --help` pass.
- Focused navigation, endpoint-removal, local discovery, local Skills toggle, and normalizer tests: 38 passed. Full suite: 277 passed, 32 failed, two unhandled errors; failure signatures match the pre-change run. Three Composio-only tests were removed and fourteen navigation/route regression cases added.
- Server-only typecheck retains ten baseline browser-type errors in `codexRpcClient.ts`.
- Playwright checks `http://127.0.0.1:4173/#/skills?tab=composio` and navigation through the remaining tabs at 1440x1000. Codex RPC, method catalog and Skills responses are controlled fixtures because live Codex CLI is unavailable. Assertions confirm stale-tab fallback, exactly three tabs, Apps/Plugins catalogs, MCP listing, local skill selection and disable/enable in both themes, and zero Composio or automatic sync requests. Browser Use is unavailable; Playwright supplies request interception.
- Screenshots (ignored artifacts): `output/playwright/composio-removal-light.png` and `output/playwright/composio-removal-dark.png`; screenshots show the Skills tab after navigating the other sections. Dark Skills toast and MCP status surfaces were corrected during visual verification.
- Live Codex catalogs, real external-app/plugin actions, and actual skill installation were not exercised. External CLI installations, Composio credentials and user Skills files were not modified.
