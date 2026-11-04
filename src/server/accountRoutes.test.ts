import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { handleAccountRoutes, readAccountsForRuntime } from './accountRoutes'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))

const originalHome = process.env.CODEX_HOME
let home: string
let backend: string
let account: Record<string, unknown> | null
type Rpc = (method: string, params: unknown) => Promise<unknown>
let appServer: { rpc: Mock<Rpc>; dispose: Mock<() => void>; listPendingServerRequests: () => unknown[] }

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'codex-runtime-account-'))
  process.env.CODEX_HOME = home
  backend = 'keyring'
  account = { type: 'chatgpt', email: 'person@example.com', planType: 'plus' }
  mocks.spawn.mockReset()
  mocks.spawn.mockImplementation(() => {
    const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
    const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
    return Object.assign(new EventEmitter(), {
      stdout, stderr, kill: vi.fn(),
      stdin: {
        end: vi.fn(),
        write: (raw: string) => {
          const request = JSON.parse(raw)
          if (request.id === undefined) return
          void (request.method === 'initialize' ? Promise.resolve({}) : appServer.rpc(request.method, request.params))
            .then((result) => stdout.emit('data', JSON.stringify({ id: request.id, result }) + '\n'))
        },
      },
    })
  })
  appServer = {
    rpc: vi.fn<Rpc>(async (method) => {
      if (method === 'account/read') return { account, requiresOpenaiAuth: true }
      if (method === 'config/read') return { config: { cli_auth_credentials_store: backend } }
      if (method === 'account/rateLimits/read') return { rateLimits: { primary: { usedPercent: 12, windowDurationMins: 300 } } }
      throw new Error(`Unexpected RPC: ${method}`)
    }),
    dispose: vi.fn<() => void>(),
    listPendingServerRequests: () => [],
  }
})

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalHome
  await rm(home, { recursive: true, force: true })
})

async function route(path: string, body?: unknown) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as IncomingMessage
  req.method = body === undefined ? 'GET' : 'POST'
  let payload: any
  const res = { statusCode: 0, setHeader: vi.fn(), end: (raw: string) => { payload = JSON.parse(raw) } }
  await handleAccountRoutes(req, res as unknown as ServerResponse, new URL(path, 'http://localhost'), { appServer })
  return { status: res.statusCode, payload }
}

function authRaw(id: string, email = 'person@example.com') {
  const token = `header.${Buffer.from(JSON.stringify({ 'https://api.openai.com/profile': { email } })).toString('base64url')}.signature`
  return JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: id, access_token: token } })
}

async function saveAccount(id: string, email: string) {
  // Let the existing file import path produce its real hashed snapshot identifier.
  await writeFile(join(home, 'auth.json'), authRaw(id, email))
  backend = 'file'
  account = { type: 'chatgpt', email, planType: 'plus' }
  const result = await route('/codex-api/accounts/refresh', {})
  expect(result.status).toBe(200)
  return result.payload.data.activeStorageId as string
}

describe('runtime account discovery', () => {
  it('discovers an external Keyring login on startup and after application restart without creating credentials', async () => {
    const first = await route('/codex-api/accounts')
    expect(first.payload.data.accounts).toHaveLength(1)
    expect(first.payload.data.accounts[0]).toMatchObject({ email: 'person@example.com', isActive: true, credentialSource: 'runtime', canRemove: false })
    expect(first.payload.data.accounts[0].quotaSnapshot.primary.usedPercent).toBe(12)
    const restarted = { ...appServer, rpc: vi.fn(appServer.rpc) }
    expect((await readAccountsForRuntime(restarted)).accounts[0]?.email).toBe('person@example.com')
    await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
    await expect(stat(join(home, 'accounts', 'codex-runtime-active'))).rejects.toThrow()
  })

  it('refreshes a Keyring login and rejects switching/removal of its runtime identity', async () => {
    const refreshed = await route('/codex-api/accounts/refresh', {})
    expect(refreshed.status).toBe(200)
    const storageId = refreshed.payload.data.activeStorageId
    for (const action of ['switch', 'remove']) {
      expect((await route(`/codex-api/accounts/${action}`, { storageId })).status).toBe(409)
    }
    await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
  })

  it('ignores leftover plaintext auth when Keyring is configured', async () => {
    const stale = authRaw('old-account', 'old@example.com')
    await writeFile(join(home, 'auth.json'), stale)
    const result = await route('/codex-api/accounts/refresh', {})
    expect(result.payload.data.accounts).toHaveLength(1)
    expect(result.payload.data.accounts[0].email).toBe('person@example.com')
    expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe(stale)
    await expect(stat(join(home, 'accounts'))).rejects.toThrow()
  })

  it('handles missing metadata without inventing a Codex workspace ID', async () => {
    account = { type: 'chatgpt' }
    const state = await readAccountsForRuntime(appServer)
    expect(state.accounts[0]).toMatchObject({ accountId: 'codex-runtime-active', email: null, planType: null, credentialSource: 'runtime' })
    account = null
    expect((await readAccountsForRuntime(appServer, true)).activeAccountId).toBeNull()
  })

  it('shares cached runtime reads across account endpoints', async () => {
    await Promise.all([route('/codex-api/accounts'), route('/codex-api/accounts/active')])
    expect(appServer.rpc.mock.calls.filter(([method]) => method === 'account/read')).toHaveLength(1)
    expect(appServer.rpc.mock.calls.filter(([method]) => method === 'account/rateLimits/read')).toHaveLength(1)
  })

  it('deduplicates a unique file snapshot match but blocks Keyring snapshot switching', async () => {
    const storageId = await saveAccount('file-account', 'person@example.com')
    backend = 'keyring'
    await rm(join(home, 'auth.json'))
    const state = await readAccountsForRuntime(appServer, true)
    expect(state.accounts).toHaveLength(1)
    expect(state.accounts[0]).toMatchObject({ storageId, credentialSource: 'runtime', canRemove: false })
    expect((await route('/codex-api/accounts/switch', { storageId })).status).toBe(409)
    expect((await route('/codex-api/accounts/remove', { storageId })).status).toBe(409)
    await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
  })

  it('preserves file-backed multi-account switching', async () => {
    const first = await saveAccount('first-account', 'first@example.com')
    const second = await saveAccount('second-account', 'second@example.com')
    account = { type: 'chatgpt', email: 'first@example.com', planType: 'plus' }
    const result = await route('/codex-api/accounts/switch', { storageId: first })
    expect(result.status).toBe(200)
    expect(result.payload.data.activeStorageId).toBe(first)
    expect(JSON.parse(await readFile(join(home, 'auth.json'), 'utf8')).tokens.account_id).toBe('first-account')
    expect(await readFile(join(home, 'accounts', second, 'auth.json'), 'utf8')).toContain('second-account')
    await vi.waitFor(async () => {
      expect(mocks.spawn).toHaveBeenCalled()
      const state = JSON.parse(await readFile(join(home, 'accounts.json'), 'utf8'))
      expect(state.accounts.find((entry: { storageId: string }) => entry.storageId === second).quotaStatus).toBe('ready')
    })
  })

  it('discovers an external file login with incomplete snapshot metadata', async () => {
    backend = 'file'
    await writeFile(join(home, 'auth.json'), JSON.stringify({ OPENAI_API_KEY: 'test-only' }))
    account = { type: 'apiKey' }
    const result = await route('/codex-api/accounts/refresh', {})
    expect(result.status).toBe(200)
    expect(result.payload.data.accounts[0]).toMatchObject({ authMode: 'apiKey', credentialSource: 'runtime', isActive: true })
  })

  it('refuses snapshot switching when effective credential storage cannot be determined', async () => {
    const storageId = await saveAccount('file-account', 'person@example.com')
    const original = await readFile(join(home, 'auth.json'), 'utf8')
    const rpc = appServer.rpc.getMockImplementation()!
    appServer.rpc.mockImplementation(async (method, params) => {
      if (method === 'config/read') throw new Error('Configuration unavailable')
      return rpc(method, params)
    })
    expect((await route('/codex-api/accounts/switch', { storageId })).status).toBe(409)
    expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe(original)
  })

  it('keeps the active account visible when quota retrieval fails', async () => {
    const rpc = appServer.rpc.getMockImplementation()!
    appServer.rpc.mockImplementation(async (method, params) => {
      if (method === 'account/rateLimits/read') throw new Error('quota unavailable')
      return rpc(method, params)
    })
    const state = await readAccountsForRuntime(appServer)
    expect(state.accounts[0]).toMatchObject({ isActive: true, quotaStatus: 'error', quotaError: 'quota unavailable' })
  })
})

describe('login completion', () => {
  it.each(['keyring', 'file'])('uses successful CLI exit for %s OAuth login rather than auth.json mtime', async (store) => {
    vi.useFakeTimers()
    backend = store
    const proc = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: { end: vi.fn() }, kill: vi.fn(),
    })
    mocks.spawn.mockImplementation(() => {
      queueMicrotask(() => proc.stdout.emit('data', 'https://auth.openai.com/oauth/authorize?test=1'))
      return proc
    })
    const starting = route('/codex-api/accounts/login/start', {})
    await vi.advanceTimersByTimeAsync(100)
    expect((await starting).status).toBe(200)
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (store === 'file') await writeFile(join(home, 'auth.json'), authRaw('logged-in'))
      proc.emit('exit', 0, null)
      return new Response(null, { status: 302 })
    }))
    const completed = await route('/codex-api/accounts/login/complete', { callbackUrl: 'http://localhost:1455/auth/callback?code=test' })
    expect(completed.status).toBe(200)
    expect(completed.payload.data.accounts[0]).toMatchObject({ isActive: true, email: 'person@example.com' })
    if (store === 'keyring') await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
  })
})
