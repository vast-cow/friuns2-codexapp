import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { getCodexCommandCandidates } from '../commandResolution.js'
import { getSpawnInvocation } from '../utils/commandInvocation.js'

export type CodexAuthStatus = boolean | null
const CACHE_TTL_MS = 30_000
let cached: { key: string; value: CodexAuthStatus } | null = null
let lastProbe: { key: string; expiresAt: number } | null = null
let pending: { key: string; promise: Promise<CodexAuthStatus> } | null = null

function contextKey(): string {
  return JSON.stringify([resolve(process.env.CODEX_HOME || resolve(homedir(), '.codex')), process.env.CODEXUI_CODEX_COMMAND ?? ''])
}

export function getCachedCodexAuthStatus(): CodexAuthStatus {
  return cached?.key === contextKey() ? cached.value : null
}

export function recordCodexAuthStatus(value: CodexAuthStatus): void {
  cached = { key: contextKey(), value }
}

/** Bootstrap only: Codex itself resolves file/keyring storage. Never read or export credentials. */
export function checkCodexLoginStatus(): Promise<CodexAuthStatus> {
  const key = contextKey()
  if (cached?.key === key && lastProbe?.key === key && lastProbe.expiresAt > Date.now()) return Promise.resolve(cached.value)
  if (pending?.key === key) return pending.promise
  const previous = cached
  const promise = (async (): Promise<CodexAuthStatus> => {
    for (const command of getCodexCommandCandidates()) {
      const value = await new Promise<CodexAuthStatus | undefined>((resolveStatus) => {
        const invocation = getSpawnInvocation(command, ['login', 'status'])
        const child = spawn(invocation.command, invocation.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
        let output = ''
        let settled = false
        const finish = (status: CodexAuthStatus | undefined): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolveStatus(status)
        }
        const timer = setTimeout(() => { finish(null); child.kill() }, 3000)
        const collect = (chunk: Buffer): void => { output = (output + chunk.toString()).slice(-4096) }
        child.stdout.on('data', collect)
        child.stderr.on('data', collect)
        child.on('error', () => finish(undefined))
        child.on('close', (code) => finish(code === 0 ? true : /not logged in/i.test(output) ? false : null))
      })
      if (value !== undefined) return value
    }
    return null
  })().then((value) => {
    lastProbe = { key, expiresAt: Date.now() + CACHE_TTL_MS }
    // A newer account/read or account/updated result wins over an older CLI probe.
    if (contextKey() === key && cached === previous) recordCodexAuthStatus(value)
    return contextKey() === key ? getCachedCodexAuthStatus() : value
  }).finally(() => {
    if (pending?.promise === promise) pending = null
  })
  pending = { key, promise }
  return promise
}

export function recordCodexAccountRead(result: unknown): void {
  if (typeof result !== 'object' || result === null || !('account' in result)) return
  if (result.account === null) recordCodexAuthStatus(false)
  else if (typeof result.account === 'object') recordCodexAuthStatus(true)
}
