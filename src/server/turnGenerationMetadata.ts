import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readGenerationMetadata, type TurnGenerationMetadata } from '../turnGenerationMetadata.js'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

// Only a turn context with its own ID is evidence. Never inherit thread defaults
// or carry the previous turn's settings across a missing/older context record.
export function buildSessionGenerationMetadataByTurn(raw: string, previous?: Map<string, TurnGenerationMetadata>): Map<string, TurnGenerationMetadata> {
  const result = new Map(previous)
  for (const line of raw.split('\n')) {
    if (!line.includes('"turn_context"')) continue
    try {
      const row = record(JSON.parse(line))
      const context = record(row?.payload)
      if (row?.type !== 'turn_context' || typeof context?.turn_id !== 'string' || !context.turn_id.trim()) continue
      const effort = 'effort' in context ? context.effort : context.reasoning_effort
      const metadata = readGenerationMetadata({
        model: context.model,
        modelSource: 'execution',
        effort,
        effortSource: 'execution',
      })
      if (metadata) result.set(context.turn_id.trim(), { ...result.get(context.turn_id.trim()), ...metadata })
    } catch { /* Ignore malformed or partially written JSONL rows. */ }
  }
  return result
}

// Session logs append during streaming. Keep only parsed metadata and a short
// boundary anchor, never whole logs, and parse only newly completed lines.
export class SessionGenerationMetadataCache {
  private readonly entries = new Map<string, {
    identity: string; signature: string; length: number; offset: number; anchor: string
    data: Map<string, TurnGenerationMetadata>
  }>()

  readRaw(path: string, raw: string, identity: string, signature: string): Map<string, TurnGenerationMetadata> {
    const cached = this.entries.get(path)
    if (cached?.identity === identity && cached.signature === signature) return cached.data
    const append = cached && cached.identity === identity && raw.length > cached.length
      && raw.slice(Math.max(0, cached.offset - 256), cached.offset) === cached.anchor
    const offset = raw.lastIndexOf('\n') + 1
    const data = buildSessionGenerationMetadataByTurn(raw.slice(append ? cached.offset : 0, offset), append ? cached.data : undefined)
    this.entries.set(path, {
      identity, signature, length: raw.length, offset,
      anchor: raw.slice(Math.max(0, offset - 256), offset), data,
    })
    if (this.entries.size > 64) this.entries.delete(this.entries.keys().next().value!)
    return data
  }
}

type CacheEntry = { signature: string; data: Map<string, TurnGenerationMetadata> }

export class TurnGenerationMetadataStore {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly writes = new Map<string, Promise<void>>()

  constructor(private readonly codexHome: () => string) {}

  private path(threadId: string): string {
    const key = createHash('sha256').update(threadId).digest('hex')
    return join(this.codexHome(), 'codexapp-turn-metadata', `${key}.jsonl`)
  }

  // Serialize appends per thread, without rewriting any Codex session log.
  async save(threadId: string, turnId: string, metadata: TurnGenerationMetadata): Promise<void> {
    const path = this.path(threadId)
    const write = (this.writes.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
      await mkdir(join(this.codexHome(), 'codexapp-turn-metadata'), { recursive: true })
      await appendFile(path, `${JSON.stringify({ turnId, metadata })}\n`, { mode: 0o600 })
      this.cache.delete(path)
    })
    this.writes.set(path, write)
    try {
      await write
    } finally {
      if (this.writes.get(path) === write) this.writes.delete(path)
    }
  }

  private async read(threadId: string): Promise<Map<string, TurnGenerationMetadata>> {
    const path = this.path(threadId)
    await this.writes.get(path)?.catch(() => {})
    try {
      const info = await stat(path)
      const signature = `${info.size}:${info.mtimeMs}`
      const cached = this.cache.get(path)
      if (cached?.signature === signature) return cached.data
      const data = new Map<string, TurnGenerationMetadata>()
      for (const line of (await readFile(path, 'utf8')).split('\n')) {
        try {
          const row = record(JSON.parse(line))
          const metadata = readGenerationMetadata(row?.metadata)
          if (typeof row?.turnId === 'string' && metadata) data.set(row.turnId, metadata)
        } catch { /* A partial final line does not discard earlier records. */ }
      }
      this.cache.set(path, { signature, data })
      if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!)
      return data
    } catch {
      return new Map()
    }
  }

  async mergeIntoTurns(threadId: string, turns: unknown[], execution = new Map<string, TurnGenerationMetadata>()): Promise<unknown[]> {
    const submitted = await this.read(threadId)
    return turns.map((turn) => {
      const row = record(turn)
      if (!row || typeof row.id !== 'string') return turn
      const metadata = {
        ...submitted.get(row.id),
        ...readGenerationMetadata(row.generationMetadata),
        ...execution.get(row.id),
      }
      return Object.keys(metadata).length ? { ...row, generationMetadata: metadata } : turn
    })
  }
}
