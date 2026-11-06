import { mkdtemp, mkdir, writeFile, readFile, lstat, readlink, symlink, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { handleSkillsRoutes } from './skillsRoutes'
import { createCodexBridgeMiddleware } from './codexAppServerBridge'

let home: string
const spawn = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', async (original) => ({ ...await original<object>(), spawn }))
let originalShared: unknown
const shared = globalThis as typeof globalThis & { __codexRemoteSharedBridge__?: unknown }
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'skills-local-only-'))
  vi.stubEnv('CODEX_HOME', home)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request') }))
  originalShared = shared.__codexRemoteSharedBridge__
  spawn.mockReset()
  spawn.mockImplementation(() => { throw new Error('Unexpected subprocess') })
})
afterEach(async () => {
  shared.__codexRemoteSharedBridge__ = originalShared
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(home, { recursive: true, force: true })
})

it.each(['file', 'symlink', 'missing'].flatMap((kind) => [false, true].map((authenticated) => ({ kind, authenticated }))))('startup preserves $kind AGENTS with authenticated=$authenticated and does not sync', async ({ kind, authenticated }) => {
  await mkdir(join(home, 'skills'))
  await writeFile(join(home, 'skills', 'AGENTS.md'), 'skills instructions')
  const agents = join(home, 'AGENTS.md')
  if (kind === 'file') await writeFile(agents, 'user instructions')
  if (kind === 'symlink') await symlink('skills/AGENTS.md', agents)
  const syncConfig = JSON.stringify(authenticated ? { githubToken: 'test-only', repoOwner: 'test', repoName: 'skills' } : {})
  await writeFile(join(home, 'skills-sync.json'), syncConfig)
  const rpc = vi.fn()
  shared.__codexRemoteSharedBridge__ = {
    version: 'immediate-steer-v1', appServer: { rpc },
    telegramBridge: {},  methodCatalog: {},
  }
  createCodexBridgeMiddleware()
  createCodexBridgeMiddleware()
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(spawn).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
  expect(await readFile(join(home, 'skills-sync.json'), 'utf8')).toBe(syncConfig)
  expect(await readFile(join(home, 'skills', 'AGENTS.md'), 'utf8')).toBe('skills instructions')
  expect(await readdir(join(home, 'skills'))).toEqual(['AGENTS.md'])
  if (kind === 'missing') await expect(lstat(agents)).rejects.toMatchObject({ code: 'ENOENT' })
  if (kind === 'file') {
    expect((await lstat(agents)).isFile()).toBe(true)
    expect(await readFile(agents, 'utf8')).toBe('user instructions')
  }
  if (kind === 'symlink') expect(await readlink(agents)).toBe('skills/AGENTS.md')
})

it('uninstalls locally and reloads discovery without starting a GitHub push', async () => {
  const path = join(home, 'skills', 'sample')
  await mkdir(path, { recursive: true })
  await writeFile(join(path, 'SKILL.md'), 'sample')
  const savedCredentials = JSON.stringify({ githubToken: 'test-only', repoOwner: 'test', repoName: 'skills', installedOwners: { sample: 'test' } })
  await writeFile(join(home, 'skills-sync.json'), savedCredentials)
  const rpc = vi.fn(async () => ({ data: [] }))
  const end = vi.fn()
  const res = { setHeader: vi.fn(), end } as unknown as ServerResponse
  expect(await handleSkillsRoutes({ method: 'POST' } as IncomingMessage, res,
    new URL('http://localhost/codex-api/skills-hub/uninstall'),
    { appServer: { rpc }, readJsonBody: async () => ({ name: 'sample', path }) })).toBe(true)
  expect(res.statusCode).toBe(200)
  await expect(lstat(path)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(home, 'skills-sync.json'), 'utf8')).toBe(savedCredentials)
  expect(rpc).toHaveBeenCalledExactlyOnceWith('skills/list', { forceReload: true })
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(spawn).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([false, true])('installs locally without GitHub authentication or sync (legacy credentials=%s)', async (configured) => {
  const skillPath = join(home, 'skills', 'sample', 'SKILL.md')
  await mkdir(join(home, 'skills', 'sample'), { recursive: true })
  await writeFile(skillPath, '---\nname: sample\ndescription: Local sample\n---\nSample')
  if (configured) await writeFile(join(home, 'skills-sync.json'), JSON.stringify({ githubToken: 'test-only', repoOwner: 'test', repoName: 'skills' }))
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn() })
    queueMicrotask(() => child.emit('close', 0))
    return child
  })
  const rpc = vi.fn(async () => ({ data: [{ skills: [{ name: 'sample', path: skillPath, enabled: true }] }] }))
  const res = { setHeader: vi.fn(), end: vi.fn() } as unknown as ServerResponse
  expect(await handleSkillsRoutes({ method: 'POST' } as IncomingMessage, res,
    new URL('http://localhost/codex-api/skills-hub/install'),
    { appServer: { rpc }, readJsonBody: async () => ({ source: 'example/skills@sample', name: 'sample' }) })).toBe(true)
  expect(res.statusCode).toBe(200)
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(spawn).toHaveBeenCalledOnce()
  expect(spawn.mock.calls[0]?.[0]).toBe('npx')
  if (!configured) await expect(lstat(join(home, 'skills-sync.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(fetch).not.toHaveBeenCalled()
})

it('returns all registry search results without GitHub metadata requests', async () => {
  const skillPath = join(home, 'skills', 'sample', 'SKILL.md')
  const rpc = vi.fn(async () => ({ data: [{ skills: [{ name: 'sample', path: skillPath, enabled: true }] }] }))
  const rows = Array.from({ length: 22 }, (_, index) => index === 0
    ? 'example/skills@sample 1.2K installs\n└ https://skills.sh/example/skills/sample'
    : `example/skills@sample-${index} 5 installs`)
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn() })
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(rows.join('\n')))
      child.emit('close', 0)
    })
    return child
  })
  const end = vi.fn()
  const res = { setHeader: vi.fn(), end } as unknown as ServerResponse
  expect(await handleSkillsRoutes({ method: 'GET' } as IncomingMessage, res,
    new URL('http://localhost/codex-api/skills-hub/search?q=sample'),
    { appServer: { rpc }, readJsonBody: async () => ({}) })).toBe(true)
  expect(res.statusCode).toBe(200)
  const { results } = JSON.parse(end.mock.calls[0]![0])
  expect(results).toHaveLength(22)
  expect(results[0]).toMatchObject({
    name: 'sample', source: 'example/skills@sample', description: '1.2K installs',
    installCountLabel: '1.2K installs', avatarUrl: '', installed: true, path: skillPath,
    url: 'https://skills.sh/example/skills/sample',
  })
  expect(results[21]).toMatchObject({ name: 'sample-21', url: '', installed: false })
  expect(spawn).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})

it('reads installed SKILL.md content locally without metadata requests', async () => {
  const path = join(home, 'skills', 'sample', 'SKILL.md')
  const content = '---\nname: sample\ndescription: Local description\n---\nLocal instructions'
  await mkdir(join(home, 'skills', 'sample'), { recursive: true })
  await writeFile(path, content)
  const end = vi.fn()
  const res = { setHeader: vi.fn(), end } as unknown as ServerResponse
  expect(await handleSkillsRoutes({ method: 'GET' } as IncomingMessage, res,
    new URL('http://localhost/codex-api/skills-hub/readme?owner=example/skills&name=sample&installed=true'),
    { appServer: { rpc: vi.fn() }, readJsonBody: async () => ({}) })).toBe(true)
  expect(res.statusCode).toBe(200)
  expect(JSON.parse(end.mock.calls[0]![0])).toMatchObject({ content, description: 'Local description', source: 'local' })
  expect(fetch).not.toHaveBeenCalled()
  expect(spawn).not.toHaveBeenCalled()
})
