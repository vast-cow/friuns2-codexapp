import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { readChatgptFeatureAuth, readPublicAuthStatus, type CredentialRpc } from './codexCredentials'

const originalHome = process.env.CODEX_HOME
let home: string
let store: string
let methodSupported: boolean
let account: Record<string, unknown> | null
let token: string | null
let appServer: { rpc: Mock<CredentialRpc['rpc']> }

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'codex-feature-auth-'))
  process.env.CODEX_HOME = home
  store = 'keyring'
  methodSupported = true
  account = { type: 'chatgpt', email: 'test@example.com' }
  token = `header.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-test' } })).toString('base64url')}.signature`
  appServer = {
    rpc: vi.fn<CredentialRpc['rpc']>(async (method) => {
      if (method === 'account/read') return { account, requiresOpenaiAuth: true }
      if (method === 'config/read') return { config: { cli_auth_credentials_store: store, mcp_oauth_credentials_store: 'keyring' } }
      if (method === 'getAuthStatus') {
        if (!methodSupported) throw new Error('Method not found: getAuthStatus')
        return { authMethod: 'chatgpt', authToken: token, requiresOpenaiAuth: true }
      }
      throw new Error('Unexpected method')
    }),
  }
})

afterEach(async () => {
  vi.useRealTimers()
  if (originalHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalHome
  await rm(home, { recursive: true, force: true })
})

describe('server-internal ChatGPT feature credentials', () => {
  it.each(['file', 'keyring'])('uses Codex-managed credentials under %s storage', async (backend) => {
    store = backend
    if (backend === 'file') await writeFile(join(home, 'auth.json'), JSON.stringify({ tokens: { access_token: 'old-file-token' } }))
    const auth = await readChatgptFeatureAuth(appServer)
    expect(auth).toEqual({ accessToken: token, accountId: 'acct-test' })
    expect(appServer.rpc).toHaveBeenCalledWith('getAuthStatus', { includeToken: true, refreshToken: false })
    if (backend === 'keyring') await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
    else expect(await readFile(join(home, 'auth.json'), 'utf8')).toContain('old-file-token')
    expect(appServer.rpc.mock.calls.every(([method]) => !method.includes('write'))).toBe(true)
  })

  it('works after restart without persisting a token cache', async () => {
    await readChatgptFeatureAuth(appServer)
    const restarted = { rpc: vi.fn(appServer.rpc) }
    expect((await readChatgptFeatureAuth(restarted)).accessToken).toBe(token)
    await expect(stat(join(home, 'auth.json'))).rejects.toThrow()
  })

  it('shares only concurrent reads so later requests can observe new credentials', async () => {
    await Promise.all([readChatgptFeatureAuth(appServer), readChatgptFeatureAuth(appServer)])
    expect(appServer.rpc.mock.calls.filter(([method]) => method === 'getAuthStatus')).toHaveLength(1)
    token = 'new-opaque-token'
    expect((await readChatgptFeatureAuth(appServer)).accessToken).toBe(token)
  })

  it('supports legacy file tokens only when the official method is unavailable and file storage is confirmed', async () => {
    methodSupported = false
    store = 'file'
    await writeFile(join(home, 'auth.json'), JSON.stringify({ tokens: { access_token: 'file-token', account_id: 'file-account' } }))
    expect(await readChatgptFeatureAuth(appServer)).toEqual({ accessToken: 'file-token', accountId: 'file-account' })
  })

  it.each(['keyring', 'auto', 'ephemeral'])('never uses a leftover auth.json under %s storage', async (backend) => {
    store = backend
    methodSupported = false
    const stale = JSON.stringify({ tokens: { access_token: 'must-not-use' } })
    await writeFile(join(home, 'auth.json'), stale)
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 501, code: 'chatgpt_feature_credentials_unsupported' })
    expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe(stale)
  })

  it('respects an explicit token refusal even if file storage has a token', async () => {
    store = 'file'
    token = null
    await writeFile(join(home, 'auth.json'), JSON.stringify({ tokens: { access_token: 'must-not-use' } }))
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 501 })
    expect(appServer.rpc.mock.calls.some(([method]) => method === 'config/read')).toBe(false)
  })

  it('uses official account status for missing credentials', async () => {
    account = null
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 401, code: 'codex_not_signed_in' })
    expect(appServer.rpc.mock.calls.some(([method]) => method === 'getAuthStatus')).toBe(false)
  })

  it('does not send an API provider key to ChatGPT feature endpoints', async () => {
    account = { type: 'apiKey' }
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 422, code: 'chatgpt_account_required' })
  })

  it('does not expose raw RPC error content', async () => {
    appServer.rpc.mockRejectedValue(new Error('backend accidentally included SECRET-TOKEN'))
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 503 })
    await expect(readChatgptFeatureAuth(appServer)).rejects.not.toThrow('SECRET-TOKEN')
  })

  it('leaves CLI and MCP OAuth credential-storage configuration unchanged', async () => {
    const config = 'cli_auth_credentials_store = "keyring"\nmcp_oauth_credentials_store = "keyring"\n'
    await writeFile(join(home, 'config.toml'), config)
    await readChatgptFeatureAuth(appServer)
    expect(await readFile(join(home, 'config.toml'), 'utf8')).toBe(config)
    expect(appServer.rpc.mock.calls.some(([method]) => method === 'config/value/write' || method === 'config/batchWrite')).toBe(false)
  })

  it('does not mistake an unavailable storage configuration for file storage', async () => {
    methodSupported = false
    const rpc = appServer.rpc.getMockImplementation()!
    appServer.rpc.mockImplementation(async (method, params) => {
      if (method === 'config/read') throw new Error('SECRET in config error')
      return rpc(method, params)
    })
    await expect(readChatgptFeatureAuth(appServer)).rejects.toMatchObject({ statusCode: 503, code: 'credential_store_unavailable' })
  })

  it('bounds unavailable credential RPCs without claiming the account signed out', async () => {
    vi.useFakeTimers()
    appServer.rpc.mockImplementation(() => new Promise(() => {}))
    const result = readChatgptFeatureAuth(appServer)
    const assertion = expect(result).rejects.toMatchObject({ statusCode: 503, code: 'codex_account_unavailable' })
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })
})

describe('public authentication status', () => {
  it('forces token-free parameters and strips credential fields even if Codex returns them', async () => {
    appServer.rpc.mockResolvedValue({ authMethod: 'chatgpt', authToken: 'SECRET', auth_token: 'SECRET', extra: { refreshToken: 'SECRET' }, requiresOpenaiAuth: true })
    const result = await readPublicAuthStatus(appServer, { includeToken: true, refreshToken: true })
    expect(appServer.rpc).toHaveBeenCalledWith('getAuthStatus', { includeToken: false, refreshToken: true })
    expect(result).toEqual({ authMethod: 'chatgpt', authToken: null, requiresOpenaiAuth: true })
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })
})
