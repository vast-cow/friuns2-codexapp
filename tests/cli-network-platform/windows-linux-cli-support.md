### Windows and Linux CLI support

#### Prerequisites / setup
- Windows PowerShell or Linux shell, Node.js 18+, pnpm, and this repository's dependencies.
- Official Codex CLI available, or an isolated disposable account allowing npm installation.

#### Actions
1. Run `pnpm exec vitest run src/cli/ensureCodexInstalled.test.ts src/utils/commandInvocation.test.ts`.
2. Run `pnpm run build`, then `node dist-cli/index.js --help`.
3. Run `node dist-cli/index.js --port 4198 --no-open --no-login --no-password`.
4. Request `http://127.0.0.1:4198/` and connect from a mobile browser using the host's reachable address.
5. Stop the CLI. Run `pnpm run dev --host 127.0.0.1 --port 4173` and check that Vite starts.
6. In a disposable account without Codex, start the CLI and verify it installs `@openai/codex`. Repeat with a non-writable global npm prefix to exercise the user-prefix retry.

#### Expected results
- Official Codex is resolved; existing installations cause no npm install.
- Installation failures surface clearly; no third-party CLI package is installed.
- CLI help reports default port 5900; explicit ports are honored.
- Windows command wrappers and Linux executable resolution work.
- Mobile browser access, responsive layout, and PWA behavior remain available.

#### Cleanup
Stop only the test processes. Remove disposable npm installations/accounts and restore PATH if manually changed. Leave the persistent 5173 development server running.
