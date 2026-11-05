### Legacy feedback removed; errors remain visible

#### Prerequisites
- Run the current app with a disposable home and a browser capable of request interception.
- Use failed-request fixtures rather than live credentials.

#### Actions and expected results
1. Open Settings in light/dark themes with missing authentication. Confirm the actionable provider error remains visible but there is no Send feedback row, link, button, or upstream mailto recipient.
2. Trigger a provider configuration validation failure and a Skills Hub load failure. Their error messages remain visible and ordinary request rejection/catch behavior is preserved.
3. Open a failed chat turn and a thread-loading error. The saved error text and live failure overlay remain visible without feedback links. Reload to confirm stored turn errors remain available.
4. Capture the identity of `window.fetch` before app boot and compare it after boot/error handling: the app does not replace it. No dedicated feedback window-error/unhandled-rejection listeners, diagnostic buffer, storage snapshot, or page-text collection is installed.
5. Verify browser console errors and normal application logging still work. No Service Worker is registered.

#### Cleanup
Close test pages and remove disposable fixtures only. No user data migration or cleanup is needed.

#### Performance audit
Removed the global fetch wrapper, response/error buffering, visible-error watchers, and mailto snapshot generation. Normal fetch and error handling remain direct. No replacement telemetry, requests, polling, buffers, or caches are introduced. Live latency was not measured.

#### Verification
- Production build including frontend typecheck passes. Full unit suite: 266 passed, 32 failed, two unhandled errors; remaining failure signatures match the pre-change suite. Removed seven feedback-only tests and added one startup regression test covering fetch identity, absence of feedback listeners, mounting, and absence of service-worker registration.
- Server-only typecheck retains ten pre-existing browser-type errors in `codexRpcClient.ts`. Public ESM CLI smoke `node dist-cli/index.js --help` passes.
- Playwright at `http://127.0.0.1:4173/`, viewport 1440x1000: asserts unchanged fetch identity after startup and provider validation failure, no feedback controls/mailto anchors, and preserved actionable error text in light/dark themes. Codex RPC/auth/model responses use fixtures because Codex CLI is unavailable; provider validation uses the real backend. Browser Use is unavailable; Playwright supports the required request interception.
- Screenshot artifacts: `output/playwright/feedback-removal-light.png` and `output/playwright/feedback-removal-dark.png`.
- Chat error, Docker, and live Codex checks were not rerun. No provider/auth backend behavior changed.
