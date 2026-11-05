# Maintenance scope

The application is a Node.js CLI server and browser UI for Codex app-server. Supported hosts are Windows and Linux; mobile browsers can connect to those hosts.

## Supported workflows

- `package.json` defines frontend/CLI builds, unit tests, and development commands.
- `publish.sh` publishes the package named in `package.json`.
- From the repository root, run `bash scripts/run-codex-unpacked-debug.sh`. The parity skill still contains older machine-specific command examples; its `.agents/` source is read-only in this workspace.
- `scripts/run-codex-unpacked-debug.sh` supports the explicitly invoked Codex.app parity workflow documented under `.agents/skills/codex-app-parity/`.

## Retired material

`ProxySpec.md` described removed OpenRouter, Zen, and custom proxy modules. Current authentication/model behavior is covered by `tests/providers-models/codex-only-models-and-auth.md`. Legacy provider fixtures that test history and preference migration remain relevant.

The Codex.app thread-filter and worktree-button patch scripts, their macOS launcher, and their manual procedures were removed. They patched a separate Electron application using version-specific internals and were not used by the application, package scripts, or CI. The unpacked debug launcher remains available for inspection without retaining these patches.

The old CLI auto-star procedure was removed because the current CLI has no repository-star behavior. The documentation website now describes this repository instead of a separate OpenClaw Android APK product.

Historical source material under `llm-wiki/raw/` and generated upstream protocol documentation remain intact. They serve as evidence and protocol references, rather than current setup instructions.
