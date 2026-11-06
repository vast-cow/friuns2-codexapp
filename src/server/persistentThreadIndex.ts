import { createHash, randomUUID } from 'node:crypto'
import lockfile from 'proper-lockfile'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Row = Record<string, any>
type Rpc = (method: string, params: Row) => Promise<any>
type Entry = { thread: Row; archived: boolean; deleted: boolean; firstTurnId?: string; pending?: { token: string; text: string; previous: string[] } }
const object = (v: any): Row => v && typeof v === 'object' ? v : {}

// Recognize only the exact transport envelope produced by attachmentPrompt.
export function attachmentOnlyTitle(text: string): string | null {
  const match = /^# Files mentioned by the user:\n((?:\n## [^\n]*: [^\n]+\n)+)\n## My request for Codex:\n\n\s*$/u.exec(text)
  if (!match) return null
  return match[1]!.split('\n').filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).split(': ')[0] || 'File').join(', ').slice(0, 240) || 'Files'
}
function inputText(params: Row): string {
  return (params.input ?? []).filter((v: Row) => v.type === 'text').map((v: Row) => v.text).join('\n')
}
function turns(thread: Row): Row[] { return Array.isArray(thread.turns) ? thread.turns : [] }
function hasText(turn: Row, text: string): boolean {
  return (turn.items ?? []).some((item: Row) => item.type === 'userMessage'
    && (item.content ?? []).some((block: Row) => block.type === 'text' && block.text === text))
}

export class PersistentThreadIndex {
  private readonly started = new Map<string, Row>()
  private queue: Promise<unknown> = Promise.resolve()
  private reconcileWindow = { home: '', at: 0, count: 0 }
  private readonly retryAfter = new Map<string, number>()
  constructor(private readonly home: () => string, private readonly legacy: () => Row[] = () => []) {}
  private path() { return join(this.home(), 'codexapp-thread-index.json') }
  private async load(): Promise<Record<string, Entry>> {
    await this.queue
    try { return JSON.parse(await readFile(this.path(), 'utf8')) }
    catch (error: any) { if (error.code === 'ENOENT') return {}; throw error }
  }
  private async update(fn: (entries: Record<string, Entry>) => void): Promise<void> {
    const previous = this.queue
    const write = previous.catch(() => {}).then(async () => {
      await mkdir(this.home(), { recursive: true })
      const release = await lockfile.lock(this.path(), { realpath: false, retries: { retries: 5, minTimeout: 10, maxTimeout: 100 } })
      let temp: string | undefined
      try {
        let entries: Record<string, Entry> = {}
        try { entries = JSON.parse(await readFile(this.path(), 'utf8')) }
        catch (error: any) { if (error.code !== 'ENOENT') throw error }
        const before = JSON.stringify(entries)
        fn(entries)
        if (JSON.stringify(entries) === before) return
        temp = `${this.path()}.${randomUUID()}.tmp`
        await writeFile(temp, JSON.stringify(entries), { mode: 0o600 })
        await rename(temp, this.path())
      } finally {
        if (temp) await rm(temp, { force: true }).catch(() => {})
        await release()
      }
    })
    this.queue = write.catch(() => {})
    await write
  }
  private async bestEffort(fn: () => Promise<void>) {
    try { await fn() } catch (error) { console.warn('Failed to update application thread index; will reconcile without resending', error) }
  }
  // Pending recovery reads at most five threads per minute, never sends a turn.
  private async reconcile(rpc: Rpc) {
    if (this.reconcileWindow.home !== this.home() || Date.now() - this.reconcileWindow.at >= 60_000) {
      this.reconcileWindow = { home: this.home(), at: Date.now(), count: 0 }
    }
    const entries = await this.load()
    if (this.reconcileWindow.count >= 5) return entries
    let changed = false
    for (const entry of Object.values(entries).filter((e) => e.pending && !e.deleted && (this.retryAfter.get(`${this.home()}:${e.thread.id}`) ?? 0) < Date.now()).slice(0, 5 - this.reconcileWindow.count)) {
      this.reconcileWindow.count += 1
      this.retryAfter.set(`${this.home()}:${entry.thread.id}`, Date.now() + 60_000)
      try {
        const thread = object((await rpc('thread/read', { threadId: entry.thread.id, includeTurns: true })).thread)
        const pending = entry.pending!
        const accepted = turns(thread).find((turn) => !pending.previous.includes(turn.id) && hasText(turn, pending.text))
        if (accepted) {
          await this.confirm(entry.thread.id, pending.token, accepted.id)
          this.retryAfter.delete(`${this.home()}:${entry.thread.id}`)
          changed = true
        }
      } catch { /* Offline/missing histories remain pending, never inferred deleted. */ }
    }
    return changed ? await this.load() : entries
  }
  private confirm(id: string, token: string, turnId: string) {
    return this.update((entries) => {
      const entry = entries[id]
      if (!entry || entry.pending?.token !== token) return
      entry.firstTurnId ||= turnId
      entry.thread.updatedAt = Date.now() / 1000
      delete entry.pending
    })
  }
  async recover(thread: Row): Promise<boolean> {
    const match = turns(thread).flatMap((turn) => (turn.items ?? []).flatMap((item: Row) =>
      item.type === 'userMessage' ? (item.content ?? []).flatMap((block: Row) => {
        const title = block.type === 'text' && typeof block.text === 'string' ? attachmentOnlyTitle(block.text) : null
        return title ? [{ turnId: turn.id, title }] : []
      }) : [])).find((value) => value.turnId)
    if (!thread.id || !match) return false
    await this.update((entries) => {
      if (entries[thread.id]?.deleted) return
      entries[thread.id] = {
        thread: { ...thread, turns: [], preview: thread.preview || match.title },
        firstTurnId: entries[thread.id]?.firstTurnId || match.turnId,
        archived: typeof thread.path === 'string' && thread.path.split(/[\\/]/u).includes('archived_sessions'),
        deleted: false,
      }
    })
    return true
  }
  async call(method: string, params: Row, rpc: Rpc): Promise<any> {
    if (method === 'thread/list') return this.list(params, rpc)
    const id = params.threadId
    let token: string | undefined
    const title = method === 'turn/start' ? attachmentOnlyTitle(inputText(params)) : null
    if (id && title && !(await this.load())[id]?.firstTurnId) {
      // A durable intent is required before submission. Capture existing turn IDs
      // so repeated identical file submissions cannot confirm an earlier turn.
      const thread = this.started.get(id) ?? object((await rpc('thread/read', { threadId: id, includeTurns: true })).thread)
      token = randomUUID()
      await this.update((entries) => {
        const entry = entries[id] ?? { thread: { ...thread, id, preview: thread.preview || title, turns: [] }, archived: false, deleted: false }
        if (entry.pending) throw new Error('An attachment submission is awaiting reconciliation; reopen the thread before sending again.')
        entry.pending = { token: token!, text: inputText(params), previous: turns(thread).map((turn) => turn.id) }
        entries[id] = entry
      })
    }
    // Never catch an ambiguous submission error and replay it. Its intent survives.
    let result: any
    try { result = await rpc(method, params) }
    catch (error: any) {
      // A protocol rejection is definitive; transport failures remain ambiguous.
      if (token && typeof error?.code === 'number') await this.bestEffort(() => this.update((entries) => {
        if (entries[id]?.pending?.token === token) delete entries[id]!.pending
      }))
      throw error
    }
    if (method === 'thread/start' && result?.thread?.id) {
      this.started.set(result.thread.id, result.thread)
      if (this.started.size > 64) this.started.delete(this.started.keys().next().value!)
    }
    if (token) this.started.delete(id)
    if (token && result?.turn?.id) await this.bestEffort(() => this.confirm(id, token!, result.turn.id))
    if (id) await this.bestEffort(async () => {
      const entries = await this.load()
      if (!entries[id]) return
      await this.update((all) => {
        const entry = all[id]!
        if (method === 'thread/archive') entry.archived = true
        if (method === 'thread/unarchive') entry.archived = false
        if (method === 'thread/delete') entry.deleted = true
        if (method === 'thread/name/set') entry.thread.name = params.name
        if (method === 'turn/start') entry.thread.updatedAt = Date.now() / 1000
        const thread = object(result?.thread)
        if (thread.id) {
          entry.thread = { ...entry.thread, ...thread, preview: thread.preview || entry.thread.preview, turns: [] }
          if (thread.path) entry.archived = thread.path.split(/[\\/]/u).includes('archived_sessions')
          if (entry.pending) {
            const accepted = turns(thread).find((turn) => !entry.pending!.previous.includes(turn.id) && hasText(turn, entry.pending!.text))
            if (accepted) { entry.firstTurnId ||= accepted.id; delete entry.pending }
          }
        }
      })
    })
    return result
  }
  private async list(params: Row, rpc: Rpc): Promise<any> {
    const entries = await this.reconcile(rpc)
    // Preserve legacy imported-chat visibility through the same filtered pager.
    for (const thread of this.legacy()) {
      entries[thread.id] ??= { thread, archived: false, deleted: false, firstTurnId: 'legacy' }
    }
    const key = params.sortKey === 'updated_at' ? 'updatedAt' : 'createdAt'
    const compare = (a: Row, b: Row) => (Number(b[key]) || 0) - (Number(a[key]) || 0) || String(b.id).localeCompare(String(a.id))
    const signature = createHash('sha256').update(JSON.stringify({ ...params, cursor: null, limit: null })).digest('hex')
    type Cursor = { signature: string; native: string | null; done: boolean; buffer: Row[]; after?: Row; seen: string[] }
    let state: Cursor = { signature, native: null, done: false, buffer: [], seen: [] }
    if (params.cursor?.startsWith('app-index:')) {
      state = JSON.parse(Buffer.from(params.cursor.slice(10), 'base64url').toString())
      if (state.signature !== signature) throw new Error('Thread cursor filters have changed')
    } else if (params.cursor) state.native = params.cursor
    const matches = (entry: Entry) => entry.firstTurnId && !entry.deleted && entry.archived === !!params.archived
      && (!params.cwd || entry.thread.cwd === params.cwd)
      && (!params.modelProviders?.length || params.modelProviders.includes(entry.thread.modelProvider))
      && (!params.sourceKinds?.length || params.sourceKinds.includes(entry.thread.source))
    const available: Entry[] = []
    // Check only indexed rollout paths, sequentially: no session traversal or
    // history RPC fanout. A moved/deleted rollout must not become a ghost row.
    for (const entry of Object.values(entries).filter(matches)) {
      if (entry.thread.path) {
        try { await stat(entry.thread.path) } catch { continue }
      }
      available.push(entry)
    }
    const indexed = available.map((entry) => entry.thread)
      .filter((thread) => !state.seen.includes(thread.id) && (!state.after || compare(thread, state.after) > 0)).sort(compare)
    const preferNative = () => {
      for (const thread of state.buffer) {
        const index = indexed.findIndex((candidate) => candidate.id === thread.id)
        if (index >= 0) {
          if (!thread.preview) thread.preview = indexed[index]!.preview
          indexed.splice(index, 1)
        }
      }
    }
    preferNative()
    const limit = Math.max(1, Math.min(200, params.limit || 50))
    const data: Row[] = []
    while (data.length < limit) {
      if (!state.buffer.length && !state.done) {
        const page = await rpc('thread/list', { ...params, cursor: state.native, limit })
        state.native = page.nextCursor || null
        state.done = !state.native
        state.buffer = (page.data ?? []).filter((thread: Row) => !state.seen.includes(thread.id) && !entries[thread.id]?.deleted)
        // Native metadata wins whenever it is available in the current stream.
        preferNative()
        if (!state.buffer.length && !state.done) continue
      }
      const extra = indexed[0]
      const native = state.buffer[0]
      if (!extra && !native) break
      if (extra && (!native || compare(extra, native) <= 0)) {
        data.push(indexed.shift()!)
        state.seen.push(extra.id)
        state.after = { id: extra.id, [key]: extra[key] }
      } else {
        data.push(state.buffer.shift()!)
        if (entries[native!.id]) state.seen.push(native!.id)
      }
    }
    const nextCursor = state.buffer.length || !state.done || indexed.length
      ? `app-index:${Buffer.from(JSON.stringify(state)).toString('base64url')}` : null
    return { data, nextCursor }
  }
}
