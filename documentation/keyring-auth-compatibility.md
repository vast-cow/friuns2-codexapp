# Codex credential storage compatibility

Authentication, account discovery, and quotas use Codex interfaces. The application does not read the OS Keyring, change `cli_auth_credentials_store` or `mcp_oauth_credentials_store`, or export Keyring secrets into credential files.

## Protocol evidence and supported operations

The bundled [`account/read` schema](app-server-schemas/typescript/v2/GetAccountResponse.ts) exposes account metadata without tokens or a stable account ID. The bundled [`getAuthStatus` request](app-server-schemas/typescript/GetAuthStatusParams.ts) and [response](app-server-schemas/typescript/GetAuthStatusResponse.ts) include an optional token.

The official [Codex request definitions](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/common.rs) mark `getAuthStatus` as deprecated. Its [account processor](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/account_processor.rs) obtains credentials through Codex's auth manager and can withhold tokens, including for host-managed credentials and permanent refresh failures. Availability depends on the installed Codex version and auth mode; a schema alone does not guarantee token release. Effective backend selection comes from the official [configuration reader](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/config_manager_service.rs).

Transcription and private connector logos now request ChatGPT feature credentials through that official interface inside the server. Tokens remain in memory and are used only for the existing ChatGPT upstream requests. The browser RPC proxy forces `includeToken: false` and returns an explicit metadata-only response. An optional ChatGPT account header is derived from token claims when available; no workspace ID is invented. Native token refresh remains owned by Codex; clients can request it through `account/read` with `refreshToken: true`.

## Dependency inventory

| Code path | Classification | Behavior and remaining file dependency |
| --- | --- | --- |
| `src/cli/index.ts` startup check; `src/server/codexAuthStatus.ts` | Authentication-state detection | Asynchronous `codex login status` bootstrap; running `account/read` results and account-change notifications update auth state. No credential-file test. |
| Bridge `account/rateLimits/read` proxy for the active account | Account metadata retrieval | Always ask Codex; no missing-file suppression. Genuine unauthenticated errors remain graceful. |
| `src/server/accountRoutes.ts`: login start and completion | Account metadata retrieval | The normal CLI login and callback are preserved; successful CLI exit confirms completion independently of file timestamps. No registry, snapshot, switch or removal layer remains. |
| `src/server/codexCredentials.ts`: `readChatgptFeatureAuth`, used by `/codex-api/transcribe` and `fetchConnectorLogo` | Direct token access | Official `getAuthStatus` first. Only a confirmed missing-method response permits the legacy file fallback, and only after `config/read` confirms file storage. Missing files never establish sign-out. Explicit token refusal is respected even with file storage. The former bridge `readCodexAuth` file-only helper is removed. |
| Bridge `refreshChatgptAuthTokensForExternalAuth` and `account/chatgptAuthTokens/refresh` server request | Token refresh | Legacy external-host mode only. Effective storage is checked before reading file refresh tokens and again before persisting rotated tokens. A concurrent credential-file change aborts persistence. Non-file storage produces an explicit unsupported-operation error. Normal Codex-managed Keyring refresh needs no host token export. |
| Tests and existing documentation/wiki examples | Fixtures and historical instructions | File-auth fixtures and examples remain valid for that storage mode. They do not imply that absent `auth.json` means signed out. Immutable wiki raw sources are unchanged. |


## Limitations and errors

- If Codex supports the legacy token interface and releases a ChatGPT token, both file and Keyring users can use transcription and private connector logos without creating credentials on disk.
- If that interface is unavailable under non-file storage, or Codex refuses to release a token, the feature returns HTTP 501 with `chatgpt_feature_credentials_unsupported`. Chat, account discovery, and quotas remain independent. A future supported server-side transcription/logo operation would remove this dependency on the deprecated token interface; no equivalent standalone operation exists in the bundled [client request union](app-server-schemas/typescript/ClientRequest.ts). The bundled [`app/list` metadata](app-server-schemas/typescript/v2/AppInfo.ts) supplies logo URLs, not authenticated logo bytes.
- HTTP 401 with `codex_not_signed_in` is reserved for Codex actually reporting no account. API-key accounts receive HTTP 422 for ChatGPT-only features; custom-provider chat behavior is unchanged. A provider that does not expose ChatGPT credentials reports a feature limitation rather than sign-out.
- Unavailable account/config/token RPCs return sanitized HTTP 503 errors. Missing file tokens under an authenticated legacy runtime produce a feature limitation, not a login failure. Raw RPC errors are not forwarded by the credential helper.
- Host-managed external-token refresh is unsupported under Keyring/auto/ephemeral/unknown storage. The app does not ask the same host refresh operation recursively or convert managed credentials to plaintext. Use Codex-managed authentication; an upstream host-refresh interface would be needed to support that separate mode securely.

## Request cost and verification boundary

Feature credential reads use the existing app-server: one account read and one token request, with at most one additional config request for the legacy file fallback. Concurrent feature reads share their pending promise. There is no persistent token cache; later requests observe changed credentials. Each credential RPC has a five-second response deadline. Connector image HTTP caching remains in place. Legacy file refresh adds two configuration checks and uses asynchronous file operations.

Regression tests cover official file/Keyring feature credentials, restart behavior, concurrent reads, unsupported methods, token refusal, public-response redaction, missing credentials, and guarded external refresh. Single-account regression tests cover file/Keyring login completion and preservation of legacy account/credential files. Current single-account validation and remaining live-environment limits are recorded in the [single-account manual test](../tests/accounts-feedback-observability/accounts-panel-codex-login-callback-modal.md).
