### Official Codex models and authentication

#### Setup
- Use a disposable home and a supported Codex CLI. Keep a copy of any legacy `webui-custom-providers.json` and Codex config for byte-for-byte preservation checks.
- Test signed-out, file-authenticated, and Keyring-authenticated states without placing real tokens in reports.

#### Actions and expected results
1. Start the app, open Settings in both themes, and refresh. Only Codex authentication is shown; no provider picker, API format controls, or OpenRouter/Zen/custom endpoint key fields remain. Sign in with Codex or a personal official `OPENAI_API_KEY`.
2. Load and search the model picker. Models and reasoning capabilities must come only from paginated Codex `model/list`; no external model endpoint or provider proxy is contacted. Pick two models, choose supported reasoning efforts, reload, and verify their saved Codex choices remain available.
3. Start a normal and Plan turn, exercise a tool approval, and observe streamed output. Send a second message during generation and verify immediate submission with the selected model/reasoning settings.
4. Legacy persisted prompt entries, including entries marked with an alternative provider, must remain inert after reload and backend restart.
5. Existing conversation history remains readable, including historical provider metadata. New/resumed/forked runtime threads use official `openai` configuration. Application startup does not read, rewrite or delete old alternative-provider config files. Those files must remain unchanged.
6. Requests to removed free-mode, provider-model catalog and alternative proxy paths fall through without handling. Missing credentials show actionable Codex authentication errors.

#### Cleanup
Remove disposable fixtures only. Do not delete user config files, conversation logs, credentials, or legacy preferences.

#### Performance audit
All external provider catalog fetches, provider proxy streaming/format conversion, key state reads, and provider-scoped refresh branches are removed. Models use only Codex app-server RPC. Existing pagination/capability handling and race guards remain; no upstream HTTP fanout or replacement polling/cache is added. Live latency was not measured.

#### Validation and remaining limits
- Production build including frontend typecheck, package creation and public ESM CLI smoke `node dist-cli/index.js --help` pass.
- Focused model/reasoning/queue/route/auth/history suites: 138 passed. Full suite: 298 passed, one failed, no unhandled errors. The remaining `refreshes a loaded optimistic thread when completion events arrive` duplicate-user-row failure reproduces in a clean pre-change archive with the same updated test fixtures. It is not introduced by this removal and remains a separate follow-up.
- Server-only typecheck retains ten pre-existing browser-type errors in `codexRpcClient.ts`.
- Playwright URL `http://127.0.0.1:4173/#/thread/codex-only-fixture`, 1440x1000: validates Codex-only Settings, historical message rendering, selection and post-refresh persistence of model/reasoning, and the submitted `turn/start` model/effort. Controlled Codex RPC/catalog fixtures are used because the live CLI is unavailable. Browser Use is unavailable; Playwright supplies request interception. Exactly two `model/list` calls occur across initial load and reload, with zero retired-provider API requests.
- Screenshots: `output/playwright/codex-only-light.png` and `output/playwright/codex-only-dark.png`. The initial model-label reactivity issue found in this check was fixed and covered by a focused regression test.
- Build comparison: main frontend JS decreases from 483.06 kB to 470.60 kB; CLI bundle from 467.45 KB to 409.52 KB. No exclusive package dependency remained; `undici` is still used by Telegram.
- The app-server singleton version changes so hot reload cannot retain a retired provider-enabled runtime. Legacy config files are never read, rewritten or removed by this client.
- Docker is unavailable. Isolated live-auth containers, real Keyring/Codex calls, and live tool/stream execution were not validated. Unit coverage preserves authentication, immediate turns, messages and approval payloads; live behavior still needs a Codex-capable host.
