### ChatGPT auth tokens refresh for external auth

#### Feature/Change Name
Codex app-server `account/chatgptAuthTokens/refresh` requests are handled from `auth.json` only after confirming file credential storage. Native Codex-managed refresh uses Codex interfaces, including for Keyring.

#### Prerequisites/Setup
1. App server is running from this repository
2. Effective `cli_auth_credentials_store` is `file`, and `$CODEX_HOME/auth.json` contains ChatGPT auth with a valid `refresh_token`
3. The current ChatGPT `access_token` is expired or close enough to expiry that Codex app-server asks for token refresh

#### Steps
1. Open the app with the ChatGPT-authenticated account selected
2. Trigger an account operation such as loading account rate limits or starting a normal Codex turn
3. Watch the server logs for an `account/chatgptAuthTokens/refresh` server request
4. Reopen `$CODEX_HOME/auth.json`
5. Repeat the same account operation after the refresh completes

#### Expected Results
- The refresh request is answered automatically and does not appear as a manual pending request in the UI
- `auth.json` is updated with the fresh `access_token` and any rotated `refresh_token` or `id_token`
- The account operation succeeds without showing `token_expired`
- If no refresh token is available, the operation fails with a sign-in-again message instead of silently looping

#### Rollback/Cleanup
- None, unless a test-only `$CODEX_HOME` was used

---

### Keyring feature credentials and refresh boundaries

#### Prerequisites/Setup
- Use isolated file and Keyring Codex profiles with valid ChatGPT logins. Keyring must be available to the server process; confirm the login through `codex login status` without exporting credentials.
- Review the [credential dependency inventory and limitations](../../documentation/keyring-auth-compatibility.md).

#### Steps
1. Start the app under Keyring with no `auth.json`. Confirm Accounts, quotas, and chat work; restart and confirm the account remains available.
2. Request transcription and a private connector logo. If Codex releases a token through its supported legacy interface, confirm the feature works without creating a credential file. Otherwise expect a clear HTTP 501 feature limitation, not a signed-out message.
3. Request browser RPC `getAuthStatus` with `includeToken: true`. Confirm the forwarded request disables token inclusion and the HTTP response contains metadata with `authToken: null` and no extra credential fields.
4. Exercise a legacy external-host token-refresh request with Keyring configured, including a leftover stale file. Confirm no file token is used, no refresh endpoint is called, and the unsupported-operation response explains that Codex owns the credentials.
5. Repeat file-backed external refresh. Confirm refreshed tokens persist only while file storage remains selected and the original file has not changed concurrently.
6. Exercise an old Codex version without `getAuthStatus`. File-backed feature access may use its existing token file; Keyring must report unsupported access without reading a leftover credential file.
7. Sign out using Codex in the isolated profile. Confirm a genuine missing account is reported correctly. Repeat with an API-key/custom provider and confirm chat still works while ChatGPT-only features identify their account requirement.
8. Compare profile configuration before and after these operations. Confirm neither credential-store setting changes, and inspect responses/logs for accidental credential disclosure.

#### Expected Results
- The app follows Codex's credential manager and respects token refusal. No OS Keyring extraction or plaintext Keyring credential file is introduced.
- Native Keyring refresh remains Codex-managed. External-host file refresh is explicitly guarded and never treats missing plaintext tokens as proof that a Keyring account is signed out.
- Credential errors omit raw upstream RPC details. Tokens requested internally never appear in browser RPC responses, notifications, or logs.
- Concurrent feature credential reads share requests, and timeouts give bounded errors. No extra Codex CLI process is launched for feature-token reads.

#### Rollback/Cleanup
- Stop the temporary app and discard only isolated profiles and test audio. Leave the user's real credential configuration and Keyring entries unchanged.
