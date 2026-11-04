### Feature: Production bundle defers conditional panels

#### Prerequisites/Setup
- Install dependencies and run `pnpm run build`, then `pnpm run preview --host 127.0.0.1 --port 4173` on an available verification port.
- Use the production preview for asset checks; the development server does not use production chunks. Use a live app server with a Git project and a thread capable of requesting approval for interaction checks.
- Open browser Network tools with cache disabled. Repeat interaction checks in light and dark themes.

#### Steps
1. Confirm the build emits no chunk-size warning at the default 500 kB threshold. Inspect `dist/assets/`: every JavaScript chunk must be below 500 kB.
2. Open the production home route without a selected Git folder and with Settings closed. Confirm `RateLimitStatus`, `HeaderGitBranchDropdown`, and `ThreadPendingRequestPanel` JavaScript/CSS chunks are not fetched.
3. Open Settings. Confirm the rate-limit chunk loads and available usage snapshots render; close and reopen Settings and confirm the module is reused.
4. Select a Git project or open an existing thread. Confirm the branch dropdown chunk loads and branch selection, commit inspection, and closing/reopening the dropdown still work.
5. Trigger a thread approval or user-input request. Confirm the pending-request chunk loads, choices and inputs render, and submitting a response resumes the thread. Confirm the composer returns after the request resolves.
6. Navigate to Skills and Automations, open a conversation with a code block, and open Terminal and Review. Confirm existing lazy features load without missing assets or module initialization errors.
7. Repeat the checks after a page refresh and in the other theme. Check the console and Network tools for failed assets or duplicate API requests.

#### Expected Results
- Conditional panel code and styles load on first use. Core layout, state, composer, and routing remain in the entry chunk.
- Panel props, events, and appearance remain unchanged. Vite fetches each panel and its CSS in parallel; revisiting a panel reuses its loaded module.
- No new startup API calls, missing chunk files, or circular module initialization errors occur.
- Build warnings and CLI build configuration remain unchanged.

#### Rollback/Cleanup
- Close any verification preview server started for these checks and restore the preferred theme/project.
- Resolve test approvals and remove any test thread created for the check.

#### Bundle and performance audit
- Root cause: the eagerly imported `App.vue` graph included conditional approval/user-input, Git branch, and Settings usage panels. Terminal, syntax highlighting, Firebase auth, Skills, Review, and Automations already had lazy boundaries. Module contribution analysis identified application components/state as the main entry contributors, so a generic vendor `manualChunks` split would move required startup bytes without avoiding their download.
- Optimization: reuse the existing `defineAsyncComponent` pattern for the three panels, preserving their guards, props, and events. Vite configuration, warning threshold, and CLI build configuration are unchanged.
- Production build comparison (decimal kB, same installed dependencies):

  | Asset | Before | After |
  | --- | ---: | ---: |
  | Entry JS | 531.33 | 497.92 |
  | Entry JS gzip (Vite) | 164.30 | 155.14 |
  | Terminal JS | 342.51 | 342.51 |
  | Firebase auth JS | 197.69 | 197.69 |
  | Highlight.js common JS | 165.06 | 165.06 |
  | Conversation JS | 71.41 | 71.41 |
  | All JS, uncompressed | 1,448.53 | 1,448.73 |
  | Entry CSS | 399.47 | 353.78 |

- Newly deferred JS: pending requests 18.78 kB, Git dropdown 11.66 kB, rate limits 3.17 kB. A home route without a Git folder avoids about 33.41 kB of initial JS and 45.69 kB of initial CSS. Routes that immediately show a branch selector still load its chunk; the remaining panels stay deferred.
- Code-path audit: core mounting, routing, state initialization, and API calls remain synchronous with the existing entry graph. The imports add no API calls, loops, unbounded fanout, or new shared caches. Each mounted panel adds one bounded JS/CSS load; Vite preloads its CSS alongside JS, and Vue/ESM reuse the resolved component/module. A visible branch selector can appear slightly later on a cold load. Existing content-hashed assets and service-worker cache policy are unchanged; old deployment/cache invalidation risks still apply.
- Verification: `pnpm run build` passes typechecking, frontend bundling (no size warning), and CLI bundling. Static production module linking validates import/export resolution for all 13 JS chunks, and the three deferred CSS assets exist. This checks linking, not browser evaluation or panel interaction.
- CJS-hosted smoke command for the public ESM CLI: `node -e "require('node:child_process').execFileSync(process.execPath,['dist-cli/index.js','--help'],{stdio:'inherit'})"`. Help output loads successfully; the CLI has no library exports.
- `pnpm run test:unit`: 166 passed, 23 failed across four files, with two unhandled errors. An unchanged-HEAD `App.vue` run reproduces the identical failing tests and error count (gateway, desktop state/preferences, and free-mode fixtures/mocks). No test failure was introduced by the import changes.
- No live browser timing, interaction, or theme measurement was performed. The manual steps above remain to be exercised. Entry size is only 2.08 kB below the warning threshold, so later entry growth can trigger the warning again.

### Architectural extraction regression cases (implementation incomplete)

Prerequisites: build with `pnpm run build`; serve `dist` through the built CLI with a working backend on port 4173. Use an isolated CODEX_HOME with a representative existing thread and project. Keep port 5173 untouched. Use a fresh browser context with service workers blocked and HTTP cache disabled for size measurements; separately verify normal service-worker reload behavior.

1. Open Home, type a draft, and use navigation/model controls. Run `pnpm run profile:bundle`; no conversation, Settings, project-dialog, automation-editor, directory-management, review, or terminal-session implementation should download without its route/action. Run `pnpm run check:bundle`; it must report the manifest-derived entry/static closure. The current implementation still exceeds its budgets and must not pass acceptance.
2. Open and reopen Settings in light and dark themes. Account/provider status must already be initialized before opening it. Change a preference, close, reopen, and refresh; it must persist. Closing Settings during an in-flight account/login action must not reset its shared state.
3. Block the Settings chunk before first opening it, type a draft, and open Settings. Expect an actionable load error. Restore requests and use Retry loading; expect Settings to open with the original composer draft intact. Repeat with throttled project/editor downloads and verify the original target/action survives.
4. Open folder selection and Create Project for the first time and again. Expect correct input focus after the actual component mount, preserved validation, and no duplicate mutations. Exercise import selection from a real user click, then ZIP export/download/share; picker and share activation must still work.
5. From both sidebar and Automations, create/edit/run/delete a temporary automation, including when the sidebar starts collapsed. Expect consistent shared maps and no second state/subscription owner. Reopen the editor and verify saved changes remain visible.
6. Start a terminal quick command with its chunk throttled beyond 500 ms. Expect the command to execute once when the panel is ready. Navigate away while loading and confirm the command is not sent to another thread/project.
7. Direct-load an existing thread and exercise streaming, stop, queued messages, drafts, thread switching, approvals, and reconnect while Home or another route is visible. Compare initial JS and API/subscription counts with the unchanged baseline.

Expected results: required navigation/composer controls remain usable, optional code loads only for its feature, retries retain intent, and no new duplicate requests/subscriptions occur. These cases are not all verified by the current partial implementation; consult `docs/performance/frontend-bundle.md` for exact evidence and gaps.

Cleanup: remove only test-created threads/projects/automations and isolated state, restore modified preferences/network interception, and retain the reusable 4173 server unless explicitly asked to stop it.
