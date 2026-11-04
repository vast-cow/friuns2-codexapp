### Explicit provider authentication; no shared API keys

#### Prerequisites
- Build and run with a disposable `CODEX_HOME`. Keep an unauthenticated home and a separate home with supported Codex authentication.
- Use only personal test credentials for provider tests; do not put credentials in logs/screenshots.

#### Steps and expected results
1. Start without Codex authentication or provider configuration. Settings stays on Codex and displays an actionable authentication error. A chat send fails with `authentication_required`; no Zen or OpenRouter configuration is synthesized or saved.
2. Sign in normally using Codex, or set a personal `OPENAI_API_KEY`; verify ordinary chat works. Explicit providers configured in Codex config remain supported.
3. Select OpenRouter without a saved personal key: Settings requests a personal key rather than enabling a shared key. Save a personal OpenRouter key and verify model selection and chat.
4. Delete that key. The selected OpenRouter configuration is disabled and its remembered key is removed. No shared key or provider is substituted. Re-enable without entering a key: receive a validation error.
5. Seed a disposable legacy OpenRouter state with `customKey: false`; confirm it is ignored and its file is not rewritten on read/startup. If a remembered key has no reliable personal-key provenance, re-enter your personal key rather than adopting it automatically.
6. Explicitly select/configure Zen and a custom endpoint; verify those configurations remain available. Keyless Zen/custom endpoints are permitted only through explicit provider configuration. Restart and verify persisted personal settings.
7. Repeat Settings checks in light/dark themes. Confirm failed configuration requests show their server error.
8. Verify `/codex-api/free-mode/rotate-key` has no handler and status has no key-count field. Requests to unconfigured provider proxies return an authentication error.

#### Cleanup
Stop disposable servers and remove test homes. Do not alter existing credentials/history/configuration or rewrite Git history. Revoke/rotate any still-valid formerly embedded credentials at the provider; code removal does not revoke them.

#### Performance audit
Absent configuration no longer creates a Zen fallback or queries OpenRouter's model catalog during status reads. Provider validation reads the existing cached/file state; the chat guard reuses cached Codex auth and cached config metadata. No polling, unbounded fanout, additional upstream requests, or new caches are introduced. Live latency was not measured.

#### Verification results and boundaries
- Production build including frontend typecheck, package creation, and public ESM CLI smoke `node dist-cli/index.js --help` pass.
- Focused provider/state/API tests pass (36 cases). Full suite: 272 passed, 32 failed, two unhandled errors. No new failure signatures against a clean pre-change archive; one obsolete free-mode failure was removed with the replaced suite.
- Server-only typecheck retains ten baseline browser-type errors in `codexRpcClient.ts`.
- Playwright Settings check: `http://127.0.0.1:4173/`, viewport 1440x1000. Codex RPC, auth-status, and model-list responses are fixture-controlled because Codex CLI is unavailable. Actual provider configuration POST validates missing OpenRouter keys. Assertions cover onboarding text, actionable error, personal-key placeholder, absent community-key messaging, and light/dark panel surfaces. Dark authentication-error styling was visually checked after correction.
- Screenshots: `output/playwright/personal-provider-light.png` and `output/playwright/personal-provider-dark.png` (ignored artifacts). Browser Use is unavailable; Playwright supplies the required request stubbing.
- Docker is unavailable, so isolated no-auth/invalid-auth/provider-switch container tests and real personal-credential chat were not executed. The verification server remains on 4173 with a disposable `/tmp/personal-auth-ui-home`; 5173 was untouched.
