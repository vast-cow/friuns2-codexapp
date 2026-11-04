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
