# npm provider discovery and Zen compatibility

## Feature / Change

Port npm 0.1.91 custom-endpoint model discovery and Zen defaults, headers, and Responses normalization while preserving local Composio and skills-sync functionality.

## Prerequisites / Setup

- Configure a custom endpoint exposing `/models`, with and without a bearer token.
- Prepare an isolated Zen configuration; keep the user's original provider settings for cleanup.

## Actions and Expected Results

1. Select the custom provider and open its model menu: the configured upstream `/models` is fetched directly with the configured token. No Codex `config/read` model lookup is required for this path.
2. Return a non-2xx response, malformed JSON, or delay longer than five seconds: discovery returns an empty list, and the application remains usable.
3. Select Zen in a new configuration: frontend/backend defaults agree on `muse-spark-1.3-contributor-free`. Offline lists use the four model IDs from npm 0.1.91.
4. Send a Responses request: `/responses` receives the original input with `store: false`, `stream: true`, and `tool_choice: auto`. Existing tools remain; missing `bash` and `read` definitions are appended once.
5. Inspect headers: the npm OpenCode client identity, SSE Accept header, and generated request/session identifiers are present. Completions continues using the chat conversion path.

## Performance Audit

Static code-path analysis: custom discovery performs one asynchronous upstream fetch with a five-second timeout and no retry/fanout, bypassing the previous config RPC path. No cache is added, so provider/key switches read current state. Response size remains controlled by the upstream catalog (no new size cap). Zen normalizes tools in O(n) with a Set and appends at most two small definitions. It adds no requests or blocking I/O; header generation uses 40 random bytes per inbound request. No polling or new cache invalidation is introduced. Live performance and runtime correctness were not tested at the user's request; Node is unavailable in this environment.

## Rollback / Cleanup

Restore the original provider, key, model, and API format; remove isolated test state.
