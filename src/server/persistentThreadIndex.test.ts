import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PersistentThreadIndex } from './persistentThreadIndex'
import { buildTextWithAttachments } from '../utils/attachmentPrompt'

let home: string
let index: PersistentThreadIndex
const text = buildTextWithAttachments('', [{ label: 'notes.txt', path: '/uploads/notes.txt' }])
const thread = { id: 'file', cwd: '/project', modelProvider: 'openai', source: 'cli', createdAt: 300, updatedAt: 300, preview: '', turns: [] }
beforeEach(async () => { home = await mkdtemp(join(tmpdir(), 'thread-index-')); index = new PersistentThreadIndex(() => home) })
afterEach(async () => { await rm(home, { recursive: true, force: true }) })
const params = { threadId: 'file', input: [{ type: 'text', text }] }

it('persists accepted files independently and can read, resume and continue by canonical ID after restart', async () => {
  const rpc = vi.fn(async (method: string) => method === 'thread/read' || method === 'thread/resume' ? { thread } : method === 'turn/start' ? { turn: { id: 'turn1' } } : { data: [], nextCursor: null })
  await index.call('turn/start', params, rpc)
  expect(rpc.mock.calls.filter(([m]) => m === 'turn/start')).toHaveLength(1)
  expect(text.split('## My request for Codex:\n\n')[1]).toBe('\n')
  index = new PersistentThreadIndex(() => home)
  expect((await index.call('thread/list', {}, rpc)).data[0]).toMatchObject({ id: 'file', preview: 'notes.txt', cwd: '/project' })
  for (const method of ['thread/read', 'thread/resume', 'turn/start']) await index.call(method, params, rpc)
  expect(rpc.mock.calls.filter(([m]) => m === 'turn/start')).toHaveLength(2)
})

it('reconciles an accepted but lost response without resending', async () => {
  const rpc = vi.fn<(method: string) => Promise<any>>(async (method: string) => {
    if (method === 'turn/start') throw new Error('transport disconnected')
    if (method === 'thread/read') return { thread }
    return { data: [] }
  })
  await expect(index.call('turn/start', params, rpc)).rejects.toThrow('disconnected')
  rpc.mockImplementation(async (method: string) => method === 'thread/read' ? { thread: { ...thread, turns: [{ id: 'accepted', items: [{ type: 'userMessage', content: params.input }] }] } } : { data: [] })
  index = new PersistentThreadIndex(() => home)
  expect((await index.call('thread/list', {}, rpc)).data).toHaveLength(1)
  expect(rpc.mock.calls.filter(([m]) => m === 'turn/start')).toHaveLength(1)
})

it('does not retain unused or definitively rejected threads', async () => {
  const rpc = vi.fn<(method: string) => Promise<any>>(async (method: string) => {
    if (method === 'turn/start') throw Object.assign(new Error('rejected'), { code: -32602 })
    return method === 'thread/read' ? { thread } : { data: [] }
  })
  await expect(index.call('turn/start', params, rpc)).rejects.toThrow('rejected')
  expect((await index.call('thread/list', {}, rpc)).data).toEqual([])
})

it('paginates more than 200 native and indexed threads without duplicates and applies filters', async () => {
  const entries = Object.fromEntries(Array.from({ length: 250 }, (_, n) => [`f${n}`, { thread: { ...thread, id: `f${n}`, createdAt: n * 2, preview: 'file' }, firstTurnId: `turn${n}`, archived: false, deleted: false }]))
  await writeFile(join(home, 'codexapp-thread-index.json'), JSON.stringify(entries))
  const native = Array.from({ length: 250 }, (_, n) => ({ ...thread, id: `n${n}`, createdAt: n * 2 + 1 })).reverse()
  const rpc = vi.fn(async (_method: string, p: any) => {
    const offset = Number(p.cursor || 0)
    return { data: native.slice(offset, offset + p.limit), nextCursor: offset + p.limit < native.length ? String(offset + p.limit) : null }
  })
  const startedAt = performance.now()
  const all = []
  let cursor = null
  do {
    const page = await index.call('thread/list', { limit: 17, cursor }, rpc)
    all.push(...page.data)
    cursor = page.nextCursor
  } while (cursor)
  console.info(`thread-index pagination: ${all.length} rows, ${rpc.mock.calls.length} native pages, ${(performance.now() - startedAt).toFixed(1)}ms`)
  expect(rpc).toHaveBeenCalledTimes(15)
  expect(all).toHaveLength(500)
  expect(new Set(all.map((t) => t.id)).size).toBe(500)
  expect(all.map((t) => t.createdAt)).toEqual(Array.from({ length: 500 }, (_, n) => 499 - n))
  const emptyRpc = async () => ({ data: [] })
  for (const filter of [{ cwd: '/other' }, { archived: true }, { modelProviders: ['other'] }, { sourceKinds: ['exec'] }]) {
    expect((await index.call('thread/list', filter, emptyRpc)).data).toEqual([])
  }
})

it('keeps archive, rename and deletion state across restart', async () => {
  const rpc = async (m: string) => m === 'thread/read' ? { thread } : m === 'turn/start' ? { turn: { id: 'turn1' } } : { data: [] }
  await index.call('turn/start', params, rpc)
  await index.call('thread/name/set', { threadId: 'file', name: 'Named' }, rpc)
  await index.call('thread/archive', { threadId: 'file' }, rpc)
  index = new PersistentThreadIndex(() => home)
  expect((await index.call('thread/list', {}, rpc)).data).toEqual([])
  expect((await index.call('thread/list', { archived: true }, rpc)).data[0].name).toBe('Named')
  await index.call('thread/unarchive', { threadId: 'file' }, rpc)
  await index.call('thread/delete', { threadId: 'file' }, rpc)
  expect((await index.call('thread/list', {}, rpc)).data).toEqual([])
})

it('keeps the pending intent when confirmation persistence fails, without rejecting an accepted send', async () => {
  const rpc = async (method: string) => {
    if (method === 'thread/read') return { thread }
    await writeFile(join(home, 'codexapp-thread-index.json'), 'invalid JSON')
    return { turn: { id: 'accepted' } }
  }
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(index.call('turn/start', params, rpc)).resolves.toMatchObject({ turn: { id: 'accepted' } })
  expect(warning).toHaveBeenCalled()
  warning.mockRestore()
})

it('recovers old accepted file history without altering conversation content', async () => {
  const accepted = { ...thread, turns: [{ id: 'old', items: [{ type: 'userMessage', content: params.input }] }] }
  const original = JSON.stringify(accepted)
  expect(await index.recover({ ...thread })).toBe(false)
  expect(await index.recover(accepted)).toBe(true)
  expect(JSON.stringify(accepted)).toBe(original)
  expect((await new PersistentThreadIndex(() => home).call('thread/list', {}, async () => ({ data: [] }))).data[0].id).toBe('file')
})

it('does not send when the initial durable intent cannot be written', async () => {
  await writeFile(join(home, 'codexapp-thread-index.json'), 'invalid')
  const rpc = vi.fn(async () => ({ thread }))
  await expect(index.call('turn/start', params, rpc)).rejects.toThrow()
  expect(rpc.mock.calls).toHaveLength(0)
})

it('does not mistake an earlier identical turn for a new accepted submission', async () => {
  const old = { id: 'old', items: [{ type: 'userMessage', content: params.input }] }
  const rpc = vi.fn<(method: string) => Promise<any>>(async (method: string) => {
    if (method === 'thread/read') return { thread: { ...thread, turns: [old] } }
    if (method === 'turn/start') throw new Error('disconnected')
    return { data: [] }
  })
  await expect(index.call('turn/start', params, rpc)).rejects.toThrow('disconnected')
  index = new PersistentThreadIndex(() => home)
  expect((await index.call('thread/list', {}, rpc)).data).toEqual([])
  expect(JSON.parse(await readFile(join(home, 'codexapp-thread-index.json'), 'utf8')).file.firstTurnId).toBeUndefined()
})

it('uses native metadata and avoids duplicates across page boundaries', async () => {
  await index.recover({ ...thread, turns: [{ id: 'old', items: [{ type: 'userMessage', content: params.input }] }] })
  const rpc = async (_method: string, p: any) => p.cursor ? { data: [], nextCursor: null } : {
    data: [{ ...thread, preview: 'Canonical preview' }], nextCursor: 'native-next',
  }
  const first = await index.call('thread/list', { limit: 1 }, rpc)
  expect(first.data).toHaveLength(1)
  expect(first.data[0].preview).toBe('Canonical preview')
  const second = await index.call('thread/list', { limit: 1, cursor: first.nextCursor }, rpc)
  expect(second.data).toHaveLength(0)
})

it('uses fresh thread/start metadata when an unused thread is not readable yet', async () => {
  const rpc = vi.fn(async (method: string) => {
    if (method === 'thread/start') return { thread }
    if (method === 'thread/read') throw new Error('not materialized')
    return { turn: { id: 'accepted' } }
  })
  await index.call('thread/start', {}, rpc)
  await index.call('turn/start', params, rpc)
  expect(rpc.mock.calls.some(([method]) => method === 'thread/read')).toBe(false)
})

it('deduplicates indexed rows against native rows buffered in a continuation cursor', async () => {
  const entries = Object.fromEntries([['a', 1000], ['b', 300]].map(([id, createdAt]) => [id, {
    thread: { ...thread, id, createdAt }, firstTurnId: 'accepted', archived: false, deleted: false,
  }]))
  await writeFile(join(home, 'codexapp-thread-index.json'), JSON.stringify(entries))
  const rpc = async () => ({ data: [{ ...thread, id: 'n', createdAt: 400 }, { ...thread, id: 'b', createdAt: 300 }], nextCursor: null })
  const first = await index.call('thread/list', { limit: 2 }, rpc)
  const second = await index.call('thread/list', { limit: 2, cursor: first.nextCursor }, rpc)
  expect([...first.data, ...second.data].map((row) => row.id)).toEqual(['a', 'n', 'b'])
})

it('does not resurrect a deleted or externally archived rollout path', async () => {
  await index.recover({ ...thread, path: join(home, 'missing.jsonl'), turns: [{ id: 'old', items: [{ type: 'userMessage', content: params.input }] }] })
  expect((await index.call('thread/list', {}, async () => ({ data: [] }))).data).toEqual([])
})
