import { getNpmGlobalBinDir, getUserNpmPrefix, prependPathEntry, resolveCodexCommand } from '../commandResolution.js'
import { spawnSyncCommand } from '../utils/commandInvocation.js'

export function ensureCodexInstalled(): string {
  const existing = resolveCodexCommand()
  if (existing) return existing

  console.log('\nCodex CLI not found. Installing official Codex CLI from npm...\n')
  const install = spawnSyncCommand('npm', ['install', '-g', '@openai/codex'], { stdio: 'inherit' })
  if (install.status !== 0) {
    const userPrefix = getUserNpmPrefix()
    console.log(`\nGlobal npm install failed. Retrying with --prefix ${userPrefix}...\n`)
    const retry = spawnSyncCommand('npm', ['install', '-g', '--prefix', userPrefix, '@openai/codex'], { stdio: 'inherit' })
    if (retry.status !== 0) {
      throw new Error(`Codex CLI install (user prefix) failed with exit code ${String(retry.status ?? -1)}`)
    }
    process.env.PATH = prependPathEntry(process.env.PATH ?? '', getNpmGlobalBinDir(userPrefix))
  }

  const command = resolveCodexCommand()
  if (!command) throw new Error('Official Codex CLI install completed but binary is still not available in PATH')
  console.log('\nCodex CLI installed.\n')
  return command
}
