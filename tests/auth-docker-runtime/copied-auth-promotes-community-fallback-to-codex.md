### Copied auth promotes community fallback to Codex

#### Feature/Change Name
Runtime auth detection after starting without auth.

#### Prerequisites/Setup
1. Run `pnpm run build`.
2. Run `pnpm pack --pack-destination /tmp`.
3. Build a Docker image from the packed `codexapp` tarball with `@openai/codex` installed.
4. Start a fresh no-auth container with an empty mounted `CODEX_HOME`.
5. Keep a valid host `auth.json` available to copy into that mounted `CODEX_HOME`.

#### Steps
1. Open the no-auth container and confirm the provider is OpenCode Zen with `big-pickle`.
2. Switch the Settings provider selector to OpenRouter while still unauthenticated.
3. Copy a valid `auth.json` into the mounted `CODEX_HOME`.
4. Reload the page.
5. Confirm the provider has moved to Codex, the composer shows a concrete Codex model instead of a generic `Model` placeholder, and Settings shows the active Codex login without importing a stored account.
6. Confirm the sidebar does not show a feedback row when there is no current visible error.
7. Send `hi` on the Codex provider and wait for an assistant reply.

#### Expected Results
- Community fallback providers are suppressed once usable Codex auth appears.
- User-configured providers with a custom key or custom endpoint remain available and are not suppressed.
- The app refreshes model metadata after provider promotion so the composer does not stay on a generic `Model` label.
- The copied auth file stays under Codex management; Settings recognizes active authentication without creating account snapshots or a registry.
- Invalid or expired copied auth is not imported during startup before a successful quota read, so the first failed send still renders a chat error instead of leaving the thread empty.
- Settings never shows a feedback row; active errors remain visible after provider/account recovery when applicable.
- The Codex provider can send a message successfully after auth promotion.

#### Rollback/Cleanup
- Stop the temporary container and remove its mounted `CODEX_HOME` directory.

---

### File and Keyring authentication detection

#### Prerequisites/Setup
- Use an isolated Codex profile with a working credential backend. Configure `cli_auth_credentials_store = "keyring"` and sign in using Codex. Confirm `codex login status` succeeds while `auth.json` is absent. Do not export credentials.
- Prepare a separate file-storage profile and a genuinely signed-out profile.

#### Steps
1. Start the app with the Keyring profile and open Settings. Confirm Codex is selected and available, including when an old community fallback state exists.
2. Read account rate limits, reload, and send a Codex message. Confirm the account and quotas are available without creating `auth.json`.
3. Repeat with file-based authentication.
4. Start with the signed-out profile. Confirm the existing community fallback is selected and unauthenticated rate-limit responses are handled gracefully.
5. Sign in or out through the app, then reload Settings. Confirm provider selection follows the updated account state. Explicit custom provider selections must remain intact.
6. Simulate an unavailable credential service. Confirm startup continues, no interactive login starts, and an unknown auth check alone does not enable fallback.

#### Expected Results
- Official CLI/app-server account status determines authentication for both credential stores; the absence of a file never suppresses rate-limit RPCs.
- Concurrent bootstrap checks share one bounded asynchronous process and cached results. Account reads and account-change notifications update the cache immediately; external changes are rechecked after its 30-second TTL.
- Keyring credentials stay managed by Codex. Transcription/logo requests use the official token interface when available; [remaining limitations](../../documentation/keyring-auth-compatibility.md) are reported separately from authentication. File snapshots remain specific to file credential storage.

#### Rollback/Cleanup
- Stop the temporary app and remove only the isolated test profiles. Restore the original profile environment; leave the user's credential storage configuration unchanged.
