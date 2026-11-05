import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createCodexBridgeMiddleware } from './codexAppServerBridge'
let home: string
let previous: unknown
const scope = globalThis as typeof globalThis & { __codexRemoteSharedBridge__?: unknown }
const rpc = vi.fn(async () => ({ data: [] }))
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'directory-removal-'))
  vi.stubEnv('CODEX_HOME', home)
  previous = scope.__codexRemoteSharedBridge__
  rpc.mockReset().mockResolvedValue({ data: [] })
  scope.__codexRemoteSharedBridge__ = { version: 'project-history-api-v1', appServer: { rpc }, telegramBridge: {}, backendQueueProcessor: {}, methodCatalog: {} }
})
afterEach(async () => { scope.__codexRemoteSharedBridge__ = previous; vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }) })
async function request(path: string, method = 'GET') {
  const req = Object.assign(Readable.from([]), { method, url: path, headers: {}, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage
  let body = ''
  const res = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: vi.fn(), write: vi.fn(), end: (chunk: unknown) => { body += chunk ?? '' } }) as unknown as ServerResponse
  const next = vi.fn()
  await createCodexBridgeMiddleware()(req, res, next)
  return { res, next, body }
}
it.each([['GET', 'status'], ['GET', 'connectors'], ['GET', 'connector'], ['POST', 'link'], ['POST', 'login'], ['POST', 'install']])('does not handle removed %s Composio %s route', async (method, suffix) => {
  const { next, body } = await request(`/codex-api/composio/${suffix}`, method)
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
})
it('still discovers a local installed skill without any Composio dependency', async () => {
  await mkdir(join(home, 'skills', 'sample'), { recursive: true })
  await writeFile(join(home, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\ndescription: Local example\n---\nInstructions')
  const { res, body, next } = await request('/codex-api/skills-hub')
  expect(res.statusCode).toBe(200)
  expect(next).not.toHaveBeenCalled()
  expect(JSON.parse(body).installed).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'sample', installed: true })]))
})

it.each([
  ['GET', 'status'], ['POST', 'github/start-login'], ['POST', 'github/token-login'],
  ['POST', 'github/complete-login'], ['POST', 'github/logout'], ['POST', 'pull'],
  ['POST', 'push'], ['POST', 'startup-sync'],
])('does not handle removed Skills sync %s %s route', async (method, suffix) => {
  const legacyCredentials = JSON.stringify({ githubToken: 'test-only', installedOwners: { sample: 'local' } })
  await writeFile(join(home, 'skills-sync.json'), legacyCredentials)
  const { next, body } = await request(`/codex-api/skills-sync/${suffix}`, method)
  expect(await readFile(join(home, 'skills-sync.json'), 'utf8')).toBe(legacyCredentials)
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
})

it.each([
  ['GET', '/codex-api/free-mode/status'], ['POST', '/codex-api/free-mode'],
  ['POST', '/codex-api/free-mode/custom-key'], ['POST', '/codex-api/free-mode/custom-provider'],
  ['GET', '/codex-api/provider-models'], ['POST', '/codex-api/openrouter-proxy/v1/responses'],
  ['POST', '/codex-api/zen-proxy/v1/responses'], ['POST', '/codex-api/custom-proxy/v1/responses'],
])('does not handle retired provider route %s %s or mutate legacy configuration', async (method, path) => {
  const contents = JSON.stringify({ enabled: true, apiKey: 'test-only', provider: 'custom', customBaseUrl: 'https://unused.example' })
  await writeFile(join(home, 'webui-custom-providers.json'), contents)
  const { next, body } = await request(path, method)
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
  expect(await readFile(join(home, 'webui-custom-providers.json'), 'utf8')).toBe(contents)
})

it.each([
  ['GET', 'thread-automations'], ['GET', 'project-automations'],
  ['GET', 'thread-automation'], ['GET', 'project-automation'],
  ['PUT', 'thread-automation'], ['PUT', 'project-automation'],
  ['DELETE', 'thread-automation'], ['DELETE', 'project-automation'],
  ['POST', 'thread-automation/run'],
])('does not handle retired automation route %s %s or touch existing automation data', async (method, suffix) => {
  const root = join(home, 'automations', 'saved-example')
  await mkdir(root, { recursive: true })
  const contents = 'id = "saved-example"\nkind = "heartbeat"\nstatus = "ACTIVE"\nprompt = "Keep my data"\n'
  await writeFile(join(root, 'automation.toml'), contents)
  await writeFile(join(root, 'memory.md'), 'Existing automation memory')
  const { next, body } = await request(`/codex-api/${suffix}?threadId=example&projectName=/tmp/example&automationId=saved-example`, method)
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
  expect(await readFile(join(root, 'automation.toml'), 'utf8')).toBe(contents)
  expect(await readFile(join(root, 'memory.md'), 'utf8')).toBe('Existing automation memory')
})

it('does not handle retired speech transcription requests or acquire credentials', async () => {
  const { next, body } = await request('/codex-api/transcribe', 'POST')
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
})

it('does not proxy retired connector logos or request credentials', async () => {
  const { next, body } = await request('/codex-api/connector-logo?src=connectors://sample')
  expect(next).toHaveBeenCalledOnce()
  expect(body).toBe('')
  expect(rpc).not.toHaveBeenCalled()
})
