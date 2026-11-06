import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCodexBridgeMiddleware } from './codexAppServerBridge'

const { sqlite } = vi.hoisted(() => ({
  sqlite: vi.fn<(command: string, args: string[], options: unknown) => { status: number; stdout: string; stderr: string }>(),
}))
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(), spawnSync: sqlite,
}))
const scope = globalThis as typeof globalThis & { __codexRemoteSharedBridge__?: unknown }
const rpc = vi.fn<(method: string, params: unknown) => Promise<unknown>>()
const storeSnapshot = vi.fn<(threadId: string, result: unknown) => void>()
let previous: unknown
let home: string
let project: string
let sessionPath: string
let sessionRaw: string
const archiveBytes = Buffer.from('PK\x05\x06' + '\0'.repeat(18), 'binary')

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'project-history-'))
  project = join(home, 'existing-project')
  sessionPath = join(home, 'sessions', 'rollout-existing.jsonl')
  await mkdir(project)
  await mkdir(join(project, '.codex-project'))
  await writeFile(join(project, '.codex-project', 'manifest.json'), '{"projectName":"Existing project"}')
  await mkdir(join(home, 'sessions'))
  await writeFile(join(project, 'notes.txt'), 'Existing project data')
  await writeFile(join(project, 'previous-export.zip'), archiveBytes)
  sessionRaw = JSON.stringify({ type: 'session_meta', payload: { id: 'historical-thread', cwd: project } }) + '\n'
  await writeFile(sessionPath, sessionRaw)
  vi.stubEnv('CODEX_HOME', home)
  previous = scope.__codexRemoteSharedBridge__
  rpc.mockReset().mockResolvedValue({ data: [] })
  storeSnapshot.mockReset()
  sqlite.mockReset().mockReturnValue({ status: 0, stdout: '[]', stderr: '' })
  scope.__codexRemoteSharedBridge__ = {
    version: 'immediate-steer-v1', appServer: { rpc, storeThreadReadSnapshot: storeSnapshot, getStreamEvents: () => [] },
    telegramBridge: {},  methodCatalog: {},
  }
})
afterEach(async () => {
  scope.__codexRemoteSharedBridge__ = previous
  vi.unstubAllEnvs()
  await rm(home, { recursive: true, force: true })
})
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
async function expectPreservedFiles() {
  expect(await readFile(join(project, 'notes.txt'), 'utf8')).toBe('Existing project data')
  expect(await readFile(join(project, '.codex-project', 'manifest.json'), 'utf8')).toBe('{"projectName":"Existing project"}')
  expect(await readFile(join(project, 'previous-export.zip'))).toEqual(archiveBytes)
  expect(await readFile(sessionPath, 'utf8')).toBe(sessionRaw)
}

it.each([['GET', 'project-zip'], ['HEAD', 'project-zip'], ['POST', 'project-import']])(
  'leaves retired ZIP route %s %s unhandled without changing existing files or history', async (method, path) => {
    const response = await request(`/codex-api/${path}?cwd=${encodeURIComponent(project)}&parent=${encodeURIComponent(home)}`, method)
    expect(response.next).toHaveBeenCalledOnce()
    expect(response.body).toBe('')
    expect(rpc).not.toHaveBeenCalled()
    expect(sqlite).not.toHaveBeenCalled()
    await expectPreservedFiles()
  },
)

it('opens and lists an existing project without importing or changing its files', async () => {
  const opened = await request('/codex-api/project-root', 'POST', { path: project, label: 'Existing project' })
  expect(opened.res.statusCode).toBe(200)
  expect(opened.json.data.path).toBe(project)
  const listing = await request('/codex-api/workspace-roots-state')
  expect(listing.json.data.order).toContain(project)
  expect(listing.json.data.labels[project]).toBe('Existing project')
  expect(sqlite).not.toHaveBeenCalled()
  await expectPreservedFiles()
})

it('retains historical SQLite sessions in ordinary thread listing with titles, order and deduplication', async () => {
  await writeFile(join(home, 'state_5.sqlite'), 'Existing database sentinel')
  sqlite.mockReturnValue({ status: 0, stderr: '', stdout: JSON.stringify([
    { id: 'historical-thread', rollout_path: sessionPath, cwd: project, title: 'Previously imported conversation', created_at: 100, updated_at: 300 },
    { id: 'already-listed', rollout_path: sessionPath, cwd: project, title: 'Saved title', created_at: 100, updated_at: 200 },
    { id: 'incomplete-row' },
  ]) })
  rpc.mockResolvedValue({ data: [{ id: 'already-listed', preview: '', cwd: project, updatedAt: 200 },
    { id: 'normal-thread', preview: 'Normal Codex chat', cwd: project, updatedAt: 150 }], nextCursor: 'next-page' })
  const response = await request('/codex-api/rpc', 'POST', { method: 'thread/list', params: {} })
  expect(response.res.statusCode).toBe(200)
  expect(response.json.result.data.map((row: { id: string }) => row.id)).toEqual(['historical-thread', 'already-listed', 'normal-thread'])
  expect(response.json.result.data[0]).toMatchObject({ preview: 'Previously imported conversation', cwd: project, path: sessionPath })
  expect(response.json.result.data[1].preview).toBe('Saved title')
  expect(response.json.result.nextCursor).toBe('next-page')
  expect(sqlite).toHaveBeenCalledOnce()
  expect(sqlite.mock.calls[0]?.[0]).toBe('sqlite3')
  expect(sqlite.mock.calls[0]?.[1][2]).toMatch(/^\s*SELECT /)
  expect(await readFile(join(home, 'state_5.sqlite'), 'utf8')).toBe('Existing database sentinel')
  await expectPreservedFiles()
})

it('resumes and reloads historical messages with attachments through fresh middleware instances', async () => {
  const content = [{ type: 'text', text: 'Historical prompt' }, { type: 'localImage', path: join(project, 'attachment.png') }]
  const thread = { id: 'historical-thread', cwd: project, path: sessionPath, turns: [
    { id: 'old-turn', status: 'completed', items: [{ id: 'old-user', type: 'userMessage', content },
      { id: 'old-answer', type: 'agentMessage', text: 'Historical answer' }] },
  ] }
  rpc.mockResolvedValue({ thread })
  for (const method of ['thread/resume', 'thread/read']) {
    const response = await request('/codex-api/rpc', 'POST', { method, params: { threadId: thread.id, includeTurns: true } })
    expect(response.res.statusCode).toBe(200)
    expect(response.json.result.thread.turns[0].items[0].content).toEqual(content)
    expect(response.json.result.thread.turns[0].items[1].text).toBe('Historical answer')
  }
  expect(storeSnapshot).toHaveBeenCalledTimes(2)
  await expectPreservedFiles()
})

it('keeps the app-server thread list usable when SQLite history supplementation is unavailable', async () => {
  await writeFile(join(home, 'state_5.sqlite'), 'Existing database sentinel')
  sqlite.mockReturnValue({ status: 1, stdout: '', stderr: 'sqlite unavailable' })
  const listed = { data: [{ id: 'normal-thread', cwd: project, preview: 'Existing conversation' }], nextCursor: null }
  rpc.mockResolvedValue(listed)
  const response = await request('/codex-api/rpc', 'POST', { method: 'thread/list', params: {} })
  expect(response.res.statusCode).toBe(200)
  expect(response.json.result).toEqual(listed)
  expect(await readFile(join(home, 'state_5.sqlite'), 'utf8')).toBe('Existing database sentinel')
  await expectPreservedFiles()
})
