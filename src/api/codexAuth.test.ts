import { afterEach, expect, it, vi } from 'vitest'
import { completeCodexLogin, logoutCodex, startCodexLogin } from './codexGateway'
afterEach(() => vi.unstubAllGlobals())
it('starts the normal Codex login flow', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { loginUrl: 'https://auth.openai.com/oauth/authorize?test=1' } })))
  vi.stubGlobal('fetch', fetch)
  expect(await startCodexLogin()).toContain('https://auth.openai.com/')
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/codex-api/accounts/login/start', { method: 'POST' })
})
it('accepts login completion without registering a stored account', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true })))
  vi.stubGlobal('fetch', fetch)
  await expect(completeCodexLogin('http://localhost:1455/auth/callback?code=test')).resolves.toBeUndefined()
  expect(fetch).toHaveBeenCalledOnce()
})
it('logs out only through normal Codex RPC', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ result: {} })))
  vi.stubGlobal('fetch', fetch)
  await logoutCodex()
  expect(fetch).toHaveBeenCalledOnce()
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
  expect(JSON.parse(init.body as string)).toEqual({ method: 'account/logout', params: {} })
})
