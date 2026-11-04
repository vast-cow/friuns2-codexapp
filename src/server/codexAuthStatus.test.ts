import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('../commandResolution.js', () => ({ getCodexCommandCandidates: () => ['codex'] }))

const originalHome = process.env.CODEX_HOME
let home: string
let child: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> }

beforeEach(async () => {
  vi.resetModules()
  mocks.spawn.mockReset()
  home = await mkdtemp(join(tmpdir(), 'codex-auth-status-'))
  process.env.CODEX_HOME = home
  child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn() })
  mocks.spawn.mockReturnValue(child)
})

afterEach(async () => {
  vi.useRealTimers()
  if (originalHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalHome
  await rm(home, { recursive: true, force: true })
})

describe('official Codex auth status', () => {
  it.each(['keyring', 'file'])('recognizes %s auth using login status and shares concurrent probes', async (store) => {
    await writeFile(join(home, 'config.toml'), `cli_auth_credentials_store = "${store}"\n`)
    if (store === 'file') await writeFile(join(home, 'auth.json'), JSON.stringify({ tokens: { access_token: 'test-token' } }))
    const auth = await import('./codexAuthStatus')
    const first = auth.checkCodexLoginStatus()
    const second = auth.checkCodexLoginStatus()
    child.stderr.emit('data', Buffer.from('Logged in using ChatGPT'))
    child.emit('close', 0)
    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    await expect(auth.checkCodexLoginStatus()).resolves.toBe(true)
    expect(mocks.spawn).toHaveBeenCalledTimes(1)
    expect(mocks.spawn.mock.calls[0]?.[1]).toEqual(['login', 'status'])
  })

  it('recognizes genuinely unauthenticated CLI responses', async () => {
    const auth = await import('./codexAuthStatus')
    const result = auth.checkCodexLoginStatus()
    child.stderr.emit('data', Buffer.from('Not logged in'))
    child.emit('close', 1)
    await expect(result).resolves.toBe(false)
  })

  it('keeps Keyring/probe failures unknown instead of forcing fallback', async () => {
    const auth = await import('./codexAuthStatus')
    const result = auth.checkCodexLoginStatus()
    child.stderr.emit('data', Buffer.from('Credential service unavailable'))
    child.emit('close', 1)
    await expect(result).resolves.toBeNull()
  })

  it('bounds a hanging probe and retries after cache expiry', async () => {
    vi.useFakeTimers()
    const auth = await import('./codexAuthStatus')
    const result = auth.checkCodexLoginStatus()
    await vi.advanceTimersByTimeAsync(3000)
    await expect(result).resolves.toBeNull()
    expect(child.kill).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_001)
    const retry = auth.checkCodexLoginStatus()
    child.emit('close', 0)
    await expect(retry).resolves.toBe(true)
    expect(mocks.spawn).toHaveBeenCalledTimes(2)
  })

  it('does not postpone external login discovery when account reads keep returning signed out', async () => {
    vi.useFakeTimers()
    const auth = await import('./codexAuthStatus')
    const first = auth.checkCodexLoginStatus()
    child.stderr.emit('data', Buffer.from('Not logged in'))
    child.emit('close', 1)
    await first
    await vi.advanceTimersByTimeAsync(20_000)
    auth.recordCodexAccountRead({ account: null })
    await vi.advanceTimersByTimeAsync(10_001)
    const refreshed = auth.checkCodexLoginStatus()
    child.emit('close', 0)
    await expect(refreshed).resolves.toBe(true)
    expect(mocks.spawn).toHaveBeenCalledTimes(2)
  })

  it('uses account/read as authoritative even when an older CLI probe finishes later', async () => {
    const auth = await import('./codexAuthStatus')
    const result = auth.checkCodexLoginStatus()
    auth.recordCodexAccountRead({ account: { type: 'chatgpt', email: 'test@example.com' }, requiresOpenaiAuth: true })
    child.stderr.emit('data', Buffer.from('Not logged in'))
    child.emit('close', 1)
    await expect(result).resolves.toBe(true)
    auth.recordCodexAccountRead({ account: null, requiresOpenaiAuth: true })
    expect(auth.getCachedCodexAuthStatus()).toBe(false)
    auth.recordCodexAccountRead({ account: { type: 'apiKey' }, requiresOpenaiAuth: true })
    expect(auth.getCachedCodexAuthStatus()).toBe(true)
  })
})
