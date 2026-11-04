import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { handleAccountRoutes } from './accountRoutes'
import { getCachedCodexAuthStatus, recordCodexAuthStatus } from './codexAuthStatus'
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
let home: string
const appServer = { dispose: vi.fn() }
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'codex-single-account-'))
  vi.stubEnv('CODEX_HOME', home)
  mocks.spawn.mockReset()
  appServer.dispose.mockReset()
})
afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }) })
async function route(path: string, body?: unknown) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as IncomingMessage
  req.method = body === undefined ? 'GET' : 'POST'
  let payload: any
  const res = { statusCode: 0, setHeader: vi.fn(), end: (raw: string) => { payload = JSON.parse(raw) } }
  const handled = await handleAccountRoutes(req, res as unknown as ServerResponse, new URL(path, 'http://localhost'), { appServer })
  return { status: res.statusCode, payload, handled }
}
it.each([['GET', ''], ['GET', '/active'], ['POST', '/refresh'], ['POST', '/switch'], ['POST', '/remove']])('removes stored-account %s %s without changing credentials or snapshots', async (method, suffix) => {
  await mkdir(join(home, 'accounts'))
  for (const file of ['auth.json', 'accounts.json', 'accounts/saved.json']) await writeFile(join(home, file), 'existing user bytes')
  const result = await route(`/codex-api/accounts${suffix}`, method === 'POST' ? {} : undefined)
  expect(result.handled).toBe(false)
  expect(mocks.spawn).not.toHaveBeenCalled()
  expect(appServer.dispose).not.toHaveBeenCalled()
  for (const file of ['auth.json', 'accounts.json', 'accounts/saved.json']) expect(await readFile(join(home, file), 'utf8')).toBe('existing user bytes')
})
it.each(['keyring', 'file'])('completes normal %s login using CLI exit without account registration', async (store) => {
  vi.useFakeTimers()
  await writeFile(join(home, 'config.toml'), `cli_auth_credentials_store = "${store}"`)
  const proc = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: { end: vi.fn() }, kill: vi.fn() })
  mocks.spawn.mockImplementation(() => { queueMicrotask(() => proc.stdout.emit('data', 'https://auth.openai.com/oauth/authorize?test=1')); return proc })
  const starting = route('/codex-api/accounts/login/start', {})
  await vi.advanceTimersByTimeAsync(100)
  expect((await starting).status).toBe(200)
  expect(mocks.spawn).toHaveBeenCalledWith('codex', ['login'], expect.objectContaining({ env: process.env }))
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (store === 'file') await writeFile(join(home, 'auth.json'), 'written by Codex CLI')
    proc.emit('exit', 0, null)
    return new Response(null, { status: 302 })
  }))
  const completed = await route('/codex-api/accounts/login/complete', { callbackUrl: 'http://localhost:1455/auth/callback?code=test' })
  expect(completed.payload).toEqual({ ok: true })
  expect(getCachedCodexAuthStatus()).toBe(true)
  expect(appServer.dispose).toHaveBeenCalledOnce()
  if (store === 'keyring') await expect(stat(join(home, 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  for (const path of ['accounts', 'accounts.json']) await expect(stat(join(home, path))).rejects.toMatchObject({ code: 'ENOENT' })
})
it('rejects invalid or uninitiated callbacks without invalidating the active login', async () => {
  recordCodexAuthStatus(true)
  expect((await route('/codex-api/accounts/login/complete', { callbackUrl: 'https://remote.example/callback' })).status).toBe(400)
  expect((await route('/codex-api/accounts/login/complete', { callbackUrl: 'http://localhost:1455/auth/callback' })).status).toBe(409)
  expect(getCachedCodexAuthStatus()).toBe(true)
  expect(appServer.dispose).not.toHaveBeenCalled()
})
it('preserves the active credential file when an explicit login attempt fails', async () => {
  vi.useFakeTimers()
  recordCodexAuthStatus(true)
  await writeFile(join(home, 'auth.json'), 'existing active credential bytes')
  const proc = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: { end: vi.fn() }, kill: vi.fn() })
  mocks.spawn.mockImplementation(() => { queueMicrotask(() => proc.stdout.emit('data', 'https://auth.openai.com/oauth/authorize?test=1')); return proc })
  const starting = route('/codex-api/accounts/login/start', {})
  await vi.advanceTimersByTimeAsync(100)
  await starting
  proc.emit('exit', 1, null)
  expect((await route('/codex-api/accounts/login/complete', { callbackUrl: 'http://localhost:1455/auth/callback?code=test' })).status).toBe(409)
  expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe('existing active credential bytes')
  expect(getCachedCodexAuthStatus()).toBe(true)
  expect(appServer.dispose).not.toHaveBeenCalled()
})
