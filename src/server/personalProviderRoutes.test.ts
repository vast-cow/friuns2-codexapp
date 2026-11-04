import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createCodexBridgeMiddleware } from './codexAppServerBridge'
import { recordCodexAuthStatus } from './codexAuthStatus'
vi.mock('./codexAuthStatus', async (original) => ({ ...await original<object>(), checkCodexLoginStatus: vi.fn(async () => false) }))
let home: string
let previous: unknown
const scope = globalThis as typeof globalThis & { __codexRemoteSharedBridge__?: unknown }
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'provider-routes-'))
  vi.stubEnv('CODEX_HOME', home)
  vi.stubEnv('OPENAI_API_KEY', '')
  recordCodexAuthStatus(false)
  previous = scope.__codexRemoteSharedBridge__
  scope.__codexRemoteSharedBridge__ = { version: 'experimental-api-v3', appServer: { rpc: vi.fn(async () => ({})), dispose: vi.fn() }, telegramBridge: {}, backendQueueProcessor: {}, methodCatalog: {} }
})
afterEach(async () => { scope.__codexRemoteSharedBridge__ = previous; vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }) })
async function request(path: string, body?: unknown) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
    method: body === undefined ? 'GET' : 'POST', url: path, headers: {}, socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage
  let output = ''
  const res = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: vi.fn(), write: vi.fn(), end: (chunk: unknown) => { output += chunk ?? '' } }) as unknown as ServerResponse
  const next = vi.fn()
  await createCodexBridgeMiddleware()(req, res, next)
  return { status: res.statusCode, data: output ? JSON.parse(output) : null, next }
}
it('reports missing authentication without selecting a provider or creating a config', async () => {
  const { data } = await request('/codex-api/free-mode/status')
  expect(data.enabled).toBe(false)
  expect(data.authenticationError).toContain('Sign in with Codex')
  expect(data).not.toHaveProperty('keyCount')
  await expect(readFile(join(home, 'webui-custom-providers.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})
it('rejects OpenRouter enable and remembered legacy keys without a personal key', async () => {
  await writeFile(join(home, 'webui-custom-providers.json'), JSON.stringify({ enabled: true, provider: 'openrouter', apiKey: 'legacy-shared', customKey: false, providerKeys: { openrouter: 'legacy-shared' } }))
  expect((await request('/codex-api/free-mode', { enable: true })).status).toBe(400)
  expect((await request('/codex-api/free-mode/custom-provider', { provider: 'openrouter', apiKey: '' })).status).toBe(400)
})
it('deletes the personal key without restoring any remembered key', async () => {
  const path = join(home, 'webui-custom-providers.json')
  await writeFile(path, JSON.stringify({ enabled: true, provider: 'openrouter', apiKey: 'personal-test', customKey: true, providerKeys: { openrouter: 'stale-test' } }))
  expect((await request('/codex-api/free-mode/custom-key', { key: '' })).status).toBe(200)
  const saved = JSON.parse(await readFile(path, 'utf8'))
  expect(saved.enabled).toBe(false)
  expect(saved.apiKey).toBeNull()
  expect(saved.providerKeys).not.toHaveProperty('openrouter')
  expect((await request('/codex-api/openrouter-proxy/v1/responses', {})).status).toBe(401)
})
it('saves explicit personal OpenRouter and explicitly chosen keyless Zen', async () => {
  expect((await request('/codex-api/free-mode/custom-provider', { provider: 'openrouter', apiKey: 'personal-test' })).status).toBe(200)
  let saved = JSON.parse(await readFile(join(home, 'webui-custom-providers.json'), 'utf8'))
  expect(saved.apiKey).toBe('personal-test')
  expect(saved.customKey).toBe(true)
  expect((await request('/codex-api/free-mode/custom-provider', { provider: 'opencode-zen', apiKey: '' })).status).toBe(200)
  saved = JSON.parse(await readFile(join(home, 'webui-custom-providers.json'), 'utf8'))
  expect(saved.provider).toBe('opencode-zen')
  expect((await request('/codex-api/free-mode/custom-provider', { provider: 'openrouter', apiKey: '' })).status).toBe(200)
  saved = JSON.parse(await readFile(join(home, 'webui-custom-providers.json'), 'utf8'))
  expect(saved.apiKey).toBe('personal-test')
})
it('does not expose a rotation handler or permit unconfigured proxies', async () => {
  expect((await request('/codex-api/free-mode/rotate-key', {})).next).toHaveBeenCalledOnce()
  for (const provider of ['zen', 'openrouter', 'custom']) expect((await request(`/codex-api/${provider}-proxy/v1/responses`, {})).status).toBe(401)
})
it('rejects a chat turn with an actionable authentication error before starting Codex', async () => {
  scope.__codexRemoteSharedBridge__ = undefined
  const middleware = createCodexBridgeMiddleware()
  try {
    const response = await request('/codex-api/rpc', { method: 'turn/start', params: { threadId: 'test' } })
    expect(response.status).toBe(401)
    expect(response.data.code).toBe('authentication_required')
    expect(response.data.error).toContain('configure your own provider in Settings')
  } finally { middleware.dispose() }
})
