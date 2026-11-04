# Codex-only client boundary

Evidence: `src/server/appServerRuntimeConfig.ts`, `src/server/codexAppServerBridge.ts`, `src/api/codexGateway.ts`, `src/composables/useDesktopState.ts`, `src/queuedGenerationSettings.ts`, `src/App.vue`.

OpenRouter, Zen and custom endpoint UI, configuration readers/writers, proxies, external model discovery and provider selection state are removed. App-server runtime selects official `openai`; new/resumed/forked thread requests do the same. Models and reasoning capabilities use only `model/list`. Codex login/logout, Keyring, token refresh, approval and streaming remain independent.

Existing provider config files are not deleted or migrated. Historical provider metadata stays in conversation data. Existing Codex model/reasoning preference keys remain readable; inert legacy provider preference entries are retained without selecting those providers. Explicitly non-Codex legacy queued settings are marked and blocked with an actionable error; queue text remains available.
