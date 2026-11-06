import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { expect, it, vi } from 'vitest'
import { createCodexBridgeMiddleware } from './codexAppServerBridge'
async function request(path: string, method = 'GET', payload?: unknown) {
  const req = Object.assign(Readable.from(payload === undefined ? [] : [JSON.stringify(payload)]), {
    method, url: path, headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage
  let body = ''
  const res = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: vi.fn(), write: vi.fn(),
    end: (chunk: unknown) => { body += chunk ?? '' },
  }) as unknown as ServerResponse
  const next = vi.fn()
  await createCodexBridgeMiddleware()(req, res, next)
  return { res, next, body, json: body ? JSON.parse(body) : null }
}
it('retains legacy notification configuration through save and a fresh middleware', async () => {
  const home = await mkdtemp(join(tmpdir(), 'telegram-config-'))
  const scope = globalThis as typeof globalThis & { __codexRemoteSharedBridge__?: unknown }
  const previous = scope.__codexRemoteSharedBridge__
  vi.stubEnv('CODEX_HOME', home)
  scope.__codexRemoteSharedBridge__ = {
    version: 'external-websocket-v1', appServer: {},  methodCatalog: {},
    telegramBridge: { stop() {}, start() {}, configureToken() {}, configureCompletionNotifications() {} },
  }
  try {
    const path = join(home, 'telegram-bridge.json')
    const legacy = { botToken: '123:secret', allowedUserIds: [9], chatIds: [8], completionNotifications: { enabled: true, chatIds: [7], statuses: ['completed'], appUrl: 'https://example.com' } }
    await writeFile(path, JSON.stringify(legacy))
    const config = (await request('/codex-api/telegram/config')).json.data
    expect(config.botToken).toBe(legacy.botToken)
    expect(config.completionNotifications).toEqual({ enabled: true, chatIds: [7], appUrl: 'https://example.com' })
    expect(config.allowedUserIds).toBeUndefined()
    expect((await request('/codex-api/telegram/configure-bot', 'POST', config)).res.statusCode).toBe(200)
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ allowedUserIds: [9], chatIds: [8] })
    expect((await request('/codex-api/telegram/config')).json.data).toEqual(config)
  } finally {
    scope.__codexRemoteSharedBridge__ = previous
    vi.unstubAllEnvs()
    await rm(home, { recursive: true, force: true })
  }
})
