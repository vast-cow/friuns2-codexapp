import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshChatgptAuthTokensForExternalAuth } from './codexAppServerBridge'

const originalCodexHome = process.env.CODEX_HOME
const originalRefreshUrlOverride = process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE
const tempDirs: string[] = []

function restoreEnvValue(key: string, value: string | undefined): void {
  if (typeof value === 'string') {
    process.env[key] = value
    return
  }
  delete process.env[key]
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
}

function unsignedJwt(payload: unknown): string {
  return `${base64UrlJson({ alg: 'none', typ: 'JWT' })}.${base64UrlJson(payload)}.signature`
}

async function createCodexHome(auth: unknown): Promise<string> {
  const codexHome = await mkdtemp(join(tmpdir(), 'codexui-auth-refresh-'))
  tempDirs.push(codexHome)
  await writeFile(join(codexHome, 'auth.json'), JSON.stringify(auth, null, 2), 'utf8')
  process.env.CODEX_HOME = codexHome
  return codexHome
}

afterEach(async () => {
  restoreEnvValue('CODEX_HOME', originalCodexHome)
  restoreEnvValue('CODEX_REFRESH_TOKEN_URL_OVERRIDE', originalRefreshUrlOverride)
  vi.unstubAllGlobals()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ChatGPT auth token refresh', () => {
  it('refreshes external ChatGPT auth tokens and persists auth.json', async () => {
    const codexHome = await createCodexHome({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'expired-access-token',
        refresh_token: 'refresh-old',
        id_token: 'id-old',
        account_id: 'acct-old',
      },
    })
    process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE = 'https://example.test/oauth/token'
    const accessToken = unsignedJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct-new',
        chatgpt_plan_type: 'pro',
      },
    })
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh-new',
      id_token: 'id-new',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await refreshChatgptAuthTokensForExternalAuth({
      reason: 'unauthorized',
      previousAccountId: 'acct-old',
    }, async () => 'file')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://example.test/oauth/token')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    const body = new URLSearchParams(String(init?.body ?? ''))
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('refresh-old')
    expect(body.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann')
    expect(result).toEqual({
      accessToken,
      chatgptAccountId: 'acct-new',
      chatgptPlanType: 'pro',
    })

    const updatedAuth = JSON.parse(await readFile(join(codexHome, 'auth.json'), 'utf8')) as {
      auth_mode?: string
      last_refresh?: number
      tokens?: Record<string, string>
    }
    expect(updatedAuth.auth_mode).toBe('chatgpt')
    expect(typeof updatedAuth.last_refresh).toBe('number')
    expect(updatedAuth.tokens?.access_token).toBe(accessToken)
    expect(updatedAuth.tokens?.refresh_token).toBe('refresh-new')
    expect(updatedAuth.tokens?.id_token).toBe('id-new')
    expect(updatedAuth.tokens?.account_id).toBe('acct-new')
  })

  it('asks for sign-in when auth.json has no ChatGPT refresh token', async () => {
    await createCodexHome({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'expired-access-token',
        account_id: 'acct-old',
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(refreshChatgptAuthTokensForExternalAuth({}, async () => 'file')).rejects.toThrow(
      'No ChatGPT refresh token is available. Please sign in again.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['keyring', 'auto', 'ephemeral', 'unknown'])('refuses file-token refresh under %s storage without reading or changing a stale file', async (store) => {
    const codexHome = await createCodexHome({ tokens: { access_token: 'stale', refresh_token: 'must-not-send' } })
    const original = await readFile(join(codexHome, 'auth.json'), 'utf8')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(refreshChatgptAuthTokensForExternalAuth({}, async () => store)).rejects.toMatchObject({
      code: 'external_auth_refresh_unsupported', statusCode: 501,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await readFile(join(codexHome, 'auth.json'), 'utf8')).toBe(original)
  })

  it('does not persist a refreshed token if storage changes to Keyring during the request', async () => {
    const codexHome = await createCodexHome({ tokens: { access_token: 'old', refresh_token: 'old-refresh', account_id: 'acct-old' } })
    const original = await readFile(join(codexHome, 'auth.json'), 'utf8')
    const readStore = vi.fn().mockResolvedValueOnce('file').mockResolvedValue('keyring')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'new', refresh_token: 'new-refresh' }))))
    await expect(refreshChatgptAuthTokensForExternalAuth({}, readStore)).rejects.toMatchObject({ code: 'external_auth_refresh_unsupported' })
    expect(await readFile(join(codexHome, 'auth.json'), 'utf8')).toBe(original)
  })

  it('preserves a login changed concurrently with file-token refresh', async () => {
    const codexHome = await createCodexHome({ tokens: { refresh_token: 'old-refresh', account_id: 'acct-old' } })
    const replacement = JSON.stringify({ tokens: { access_token: 'another-login' } })
    vi.stubGlobal('fetch', vi.fn(async () => {
      await writeFile(join(codexHome, 'auth.json'), replacement)
      return new Response(JSON.stringify({ access_token: 'new' }))
    }))
    await expect(refreshChatgptAuthTokensForExternalAuth({}, async () => 'file')).rejects.toThrow('credentials changed during refresh')
    expect(await readFile(join(codexHome, 'auth.json'), 'utf8')).toBe(replacement)
  })
})
