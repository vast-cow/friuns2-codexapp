# External ownership of memories

Prerequisites: build CLI with `pnpm run build:cli` and start an external Codex
app-server with the desired memories configuration and matching CODEX_HOME.

1. Run `node dist-cli/index.js --no-memories --no-open`.
2. Expect an error explaining that memories must be configured on the external
   server. No internal app-server should start.
3. Start without `--no-memories`; send a turn and verify the external server's
   configured memories behavior is preserved.
4. Repeat using `--memories`, `--sandbox-mode read-only`, and
   `--approval-policy never`; expect the same explicit deprecation error.

Cleanup: stop test web backends and externally managed test servers manually.
See [external connection cases](external-app-server.md) for lifecycle validation.
