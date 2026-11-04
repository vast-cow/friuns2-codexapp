# Frontend bundle audit

Measured with Vite 6.4.5, production minification, and the default 500 kB warning threshold. Sizes below are decimal kB from Vite; the baseline is the parent implementation, not the older attached build output.

## Investigation

A temporary Vite `generateBundle` plugin recorded each output chunk's `imports`, `dynamicImports`, and `modules` (`renderedLength`), without changing bundling options. The entry's largest contributors before minification were:

| Module | Rendered bytes |
| --- | ---: |
| App.vue (compiled script/template) | 247,073 |
| useDesktopState.ts | 199,688 |
| Vue runtime-core | 153,661 |
| SidebarThreadTree.vue | 144,469 |
| codexGateway.ts | 98,924 |
| ThreadComposer.vue | 70,869 |

These are Rollup's rendered module lengths before final chunk minification, not additive minified contributions. The essential application shell/state dominates the entry. The terminal, conversation, review, directory, automation, Firebase, and highlighting chunks already load asynchronously. No large third-party dependency accidentally bundled into the entry justified manual vendor splitting.

`QueuedMessages.vue` contributed 7,205 rendered bytes despite hiding its entire template for an empty queue. Its only importing component was App.vue. Moving this import behind an async component and an explicit nonempty-queue guard removes unused queue controls from startup without deferring the essential composer or restructuring routing.

## Results

| JavaScript chunk | Before minified / gzip kB | After minified / gzip kB |
| --- | ---: | ---: |
| Entry | 501.78 / 156.61 | 498.54 / 155.67 |
| QueuedMessages | included in entry | 3.57 / 1.47 |
| ThreadTerminalPanel | 342.51 / 87.94 | 342.51 / 87.94 |
| index.esm (larger Firebase chunk) | 197.69 / 39.38 | 197.69 / 39.38 |
| common | 165.06 / 54.87 | 165.06 / 54.87 |
| ThreadConversation | 71.67 / 20.52 | 71.67 / 20.52 |

The entry saves 3.24 kB minified and 0.94 kB gzip. The production build succeeds without the large-chunk warning. No warning limit, manual chunk configuration, or CLI configuration changed. Headroom is small; future growth can exceed the threshold again.

## Performance assessment

The recorded static import closure contains only the entry chunk both before and after. The emitted HTML has one module script and no queue preload. QueuedMessages is reachable through a dynamic import only, so empty-queue startup adds no requests or loading waterfall. A thread with an existing queue incurs one additional JS request on first render; Vite also loads its extracted component CSS. Subsequent mounts reuse Vue's resolved async component and browser module cache. A cold first queue display therefore has a network delay; total downloaded code for users who use queues can grow slightly from chunk overhead.

The component's inner empty guard already unmounted its DOM when the queue drained; the outer guard additionally destroys its temporary drag state. Queue data, edit/steer/delete/reorder handlers, and server requests remain in their existing owners. This introduces no API requests, blocking loops, fanout, or application cache invalidation. Content-hashed assets retain Vite's normal deployment cache behavior.

No live browser timings, light/dark screenshots, or end-to-end service checks were performed. Home/navigation, conversations/composer, terminal, review, skills/directory, automations, and settings retain their existing import and render paths; their functionality is not claimed as browser-verified by this audit.

## Validation

- `pnpm run build`: passed, including vue-tsc, Vite, and tsup.
- `pnpm run test:unit`: 261 passed, 33 failed, two unhandled errors; the unchanged HEAD version produced the same failing test names and totals. Existing failures concern gateway/model preferences and desktop state; unhandled errors report a missing `reasoningCatalog` mock export.
- `pnpm run test:unit src/composables/useDesktopState.messages.test.ts`: all 33 passed, including queue persistence, reorder, edit, and generation settings.
- CJS smoke: `node -e "const { spawnSync } = require('node:child_process'); const r = spawnSync(process.execPath, ['dist-cli/index.js', '--help'], {encoding:'utf8'}); if(r.status !== 0 || !r.stdout.includes('--port')) throw Error(r.stderr || 'Missing CLI options'); const v = require('vue'); if(typeof v.defineAsyncComponent !== 'function') throw Error('Missing async component export');"`: passed. The public CLI is ESM, so CJS launches its public entry instead of requiring it directly; Vue's CJS async-component export is also checked.

This environment used Node from `/tmp/node-v22.23.3-linux-x64/bin` and a temporary `pnpm` wrapper invoking Corepack, because Node/pnpm were absent from the default PATH. No dependency or package changes were required.

## Architectural extraction — incomplete implementation

This working-tree implementation is **not accepted against the requested targets**. It extracts Settings account/provider actions, project dialogs/operations, the sidebar automation editor/controller, and directory/review/terminal-session/Telegram API implementations. Shared desktop state, transport, workspace mutation serialization, model/bootstrap state, and realtime reducers retain their existing single owners. Optional APIs are imported directly by their consumers; the core has no runtime re-exports of those implementations.

A route guard also prevents the unresolved initial route from rendering the Thread fallback. Previously, opening Home downloaded `ThreadConversation` before the router resolved Home. ThreadGoalPanel is now asynchronous and only rendered on a resolved Thread route. The full conversion to real router views remains outstanding.

### Reproduction and measurements

Baseline: `db22d68f5dd50197a824b7b4ebfa5913c0d84592`, clean `main`. Node 22.23.3, pnpm 12.16.1, Vite 6.4.5; existing node_modules reused without dependency changes. The ignored pnpm lockfile SHA-256 is `91abec225aa571744d29add4a9dcc003af847ac82391eaaf2c778f584bc3b011`.

| Measurement | Before minified / gzip kB | Working tree minified / gzip kB |
| --- | ---: | ---: |
| Entry | 498.537 / 155.669 | 436.478 / 142.396 |
| Entry static import closure | 498.537 / 155.669 | 436.478 / 142.396 |
| Observed cold Home JavaScript | 570.216 / 176.182 | 436.478 / 142.396 |
| All emitted JavaScript chunks | 1453.174 / 409.546 | 1470.362 / 420.504 |
| Representative existing-thread cold startup | not measured | not measured |

Entry reduction is 12.5%; observed cold Home reduction is 23.5%. Neither the 300 kB entry target nor the 30% Home target has been reached. Total emitted JavaScript grows by about 17 kB from boundaries, controller/context wiring, and failure handling. These numbers must not be described as completion of the requested work.

Production checks use the built CLI/backend at `http://127.0.0.1:4173/`, a fresh Chromium context, blocked service workers, and disabled HTTP cache. The isolated backend uses `/tmp/codexapp-bundle-test-home`. The baseline frontend was rebuilt from a clean `git archive HEAD` in `/tmp`, sharing the dependency tree, and served through Playwright response interception while API requests continued to the same real backend. The archive's worktree-name build constant changes its entry by six bytes (498,543 bytes, gzip 155,661); the observed Home baseline uses that archive entry plus the 71,673-byte conversation chunk. Counts deduplicate asset URLs; gzip totals compress each emitted file separately and are not claims about negotiated wire compression. No startup latency comparison is claimed from intercepted baseline responses.

Use `pnpm run build`, then `pnpm run check:bundle`. Vite now emits `.vite/manifest.json`; the check traverses static imports with deduplication and reports final file/gzip sizes, all emitted JS, and the largest chunks. Default budgets are 300,000 entry bytes and 350,000 static-closure bytes. **The check currently fails**, preserving the unmet targets rather than silently weakening them. Environment overrides `BUNDLE_ENTRY_BUDGET` and `BUNDLE_STATIC_BUDGET` exist for explicit diagnostic use.

Use `PROFILE_BASE_URL=http://127.0.0.1:4173 pnpm run profile:bundle` for runtime evidence. `PROFILE_ROUTE='/#/thread/<id>'` selects direct-thread startup. The profiler waits for the composer and enabled model control, then observes another seven seconds; it records requests, readiness, page errors, deduplicated JS sizes, and cache conditions under `output/playwright/production-bundle.json`. An unavailable composer/model or page error fails the command. A production backend is required; Vite preview alone does not provide one. Node, Chromium, and its shared libraries may require environment setup in this container.

### Deferred costs and remaining composition

Additional static JavaScript for first feature use, excluding the already loaded entry:

| Feature | Minified / gzip kB |
| --- | ---: |
| Settings plus Telegram API | 29.284 / 8.769 |
| Project dialogs plus controller | 19.694 / 6.010 |
| Automation editor plus controller | 14.325 / 4.656 |

These are manifest-derived additional static closures, not complete runtime first-use measurements; feature-triggered requests can add further chunks. Existing terminal (~343.54 kB), Firebase (~197.69 kB), highlighting common (~165.06 kB), and conversation (~71.67 kB) remain major emitted chunks.

An intermediate module audit after extraction recorded the largest entry `renderedLength` values are desktop state 199,688; App 153,867; Vue runtime-core 153,792; sidebar 119,854; gateway 75,476; composer 70,821 bytes. These are pre-minification attribution, **not predicted savings**. Further work remains in sidebar management UI, route-specific controllers, composer advanced content, and carefully selected desktop actions. Live reducers cannot simply move behind conversation mounting without breaking Home/sidebar activity, queues, approvals, and reconnect recovery.

### Validation boundary

- Production frontend/CLI build and typecheck pass.
- Focused deferred-action and desktop-message suites: 35 passed.
- Full unit suite: 263 passed / 33 failed; failure names match the unchanged baseline (261 passed / 33 failed), with two new passing deferred-action tests.
- CJS public CLI launcher smoke passed: `node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['dist-cli/index.js','--help'],{encoding:'utf8'}); if(r.status!==0 || !r.stdout.includes('--port')) throw Error(r.stderr);"`.
- Browser checks opened Settings, reopened Settings, typed a retained composer draft, browsed folders, and navigated to Automations with no page errors. A blocked Settings chunk followed by retry recovered while retaining the draft. Settings light/dark screenshots were visually inspected at 1440×1000.
- Screenshot artifacts: `output/playwright/bundle-settings-light.png`, `bundle-settings-dark.png`, `bundle-folder-dark.png`; tested URL `http://127.0.0.1:4173/`. Runtime comparison: `output/playwright/bundle-runtime.json`. These are ignored local artifacts.
- Full streaming/send/stop/queue/thread-switch behavior, existing-thread startup, populated automation editing, project mutations, ZIP workflows, account/provider authentication, terminal/review first use, mobile layouts, normal service-worker reload behavior, and complete request/subscription comparison remain unverified. Docker is unavailable, so the required packaged provider/auth matrix was not run.

This remains an uncommitted partial implementation; additional reductions and validation are required before acceptance.

Screenshot inspection (URL `http://127.0.0.1:4173/`, viewport 1440×1000): Settings rendered in both themes without page errors; dark surfaces matched the dark page. Absolute artifacts are `/root/Projects/20261104-codexapp-dev/output/playwright/bundle-settings-light.png` and `/root/Projects/20261104-codexapp-dev/output/playwright/bundle-settings-dark.png`.

![Settings light theme](../../output/playwright/bundle-settings-light.png)
![Settings dark theme](../../output/playwright/bundle-settings-dark.png)
