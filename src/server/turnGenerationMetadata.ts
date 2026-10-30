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
    await this.saveMany(threadId, [{ turnId, metadata }])
  }

  async saveMany(threadId: string, entries: Array<{ turnId: string; metadata: TurnGenerationMetadata }>): Promise<void> {
    if (entries.length === 0) return
    const path = this.path(threadId)
    const write = (this.writes.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
      await mkdir(join(this.codexHome(), 'codexapp-turn-metadata'), { recursive: true })
      await appendFile(path, entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''), { mode: 0o600 })
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

// Preserve a destination's own evidence and prefer execution records over
// submitted settings independently for model and effort.
function inheritMetadata(source: TurnGenerationMetadata, destination?: TurnGenerationMetadata): TurnGenerationMetadata {
  const result: TurnGenerationMetadata = {}
  for (const field of ['model', 'effort'] as const) {
    const sourceKey = field === 'model' ? 'modelSource' : 'effortSource'
    const fromDestination = destination?.[field] !== undefined
      && (destination[sourceKey] === 'execution' || source[field] === undefined || source[sourceKey] !== 'execution')
    const chosen = fromDestination ? destination : source
    if (field === 'model' && chosen?.model !== undefined) {
      result.model = chosen.model
      result.modelSource = chosen.modelSource
    } else if (field === 'effort' && chosen?.effort !== undefined) {
      result.effort = chosen.effort
      result.effortSource = chosen.effortSource
    }
  }
  return result
}

// Use exact user and assistant text only when both are present and all user
// inputs are textual. Skip large turns and duplicate fingerprints.
function turnTextFingerprint(turn: unknown): string {
  const items = record(turn)?.items
  if (!Array.isArray(items)) return ''
  const parts: Array<[string, string[]]> = []
  let hasUser = false
  let hasAssistant = false
  let length = 0
  for (const item of items) {
    const row = record(item)
    if (row?.type === 'userMessage') {
      if (!Array.isArray(row.content) || row.content.length === 0) return ''
      const texts: string[] = []
      for (const entry of row.content) {
        const input = record(entry)
        if (input?.type !== 'text' || typeof input.text !== 'string') return ''
        texts.push(input.text)
        length += input.text.length
      }
      hasUser = texts.some((value) => value.length > 0) || hasUser
      parts.push(['user', texts])
    } else if (row?.type === 'agentMessage' && typeof row.text === 'string' && row.text.length > 0) {
      hasAssistant = true
      length += row.text.length
      parts.push(['assistant', [row.text]])
    }
    if (length > 262144) return ''
  }
  return hasUser && hasAssistant ? createHash('sha256').update(JSON.stringify(parts)).digest('hex') : ''
}

// Prefer turn and item IDs. Identical text is used only when it uniquely
// identifies a complete turn on both sides of the fork.
export function inheritForkTurnMetadata(sourceTurns: unknown[], forkTurns: unknown[]): {
  turns: unknown[]
  entries: Array<{ turnId: string; metadata: TurnGenerationMetadata }>
} {
  const byTurnId = new Map<string, Set<number>>()
  const byItemId = new Map<string, Set<number>>()
  const byFingerprint = new Map<string, Set<number>>()
  function index(map: Map<string, Set<number>>, id: string, position: number): void {
    const positions = map.get(id) ?? new Set<number>()
    positions.add(position)
    map.set(id, positions)
  }
  sourceTurns.forEach((turn, position) => {
    const row = record(turn)
    if (typeof row?.id === 'string' && row.id) index(byTurnId, row.id, position)
    const fingerprint = turnTextFingerprint(turn)
    if (fingerprint) index(byFingerprint, fingerprint, position)
    if (Array.isArray(row?.items)) for (const item of row.items) {
      const id = record(item)?.id
      if (typeof id === 'string' && id) index(byItemId, id, position)
    }
  })
  const matches = forkTurns.map((turn) => {
    const row = record(turn)
    if (typeof row?.id !== 'string' || !row.id) return undefined
    const direct = byTurnId.get(row.id)
    if (direct) return direct.size === 1 ? [...direct][0] : undefined
    const candidates = new Set<number>()
    if (Array.isArray(row.items)) for (const item of row.items) {
      const id = record(item)?.id
      if (typeof id !== 'string') continue
      for (const position of byItemId.get(id) ?? []) candidates.add(position)
    }
    if (candidates.size > 0) return candidates.size === 1 ? [...candidates][0] : undefined
    const fingerprint = turnTextFingerprint(turn)
    const textMatches = fingerprint ? byFingerprint.get(fingerprint) : undefined
    return textMatches?.size === 1 ? [...textMatches][0] : undefined
  })
  const counts = new Map<number, number>()
  for (const match of matches) if (match !== undefined) counts.set(match, (counts.get(match) ?? 0) + 1)
  const entries: Array<{ turnId: string; metadata: TurnGenerationMetadata }> = []
  const turns = forkTurns.map((turn, index) => {
    const row = record(turn)
    const match = matches[index]
    if (!row || typeof row.id !== 'string' || match === undefined || counts.get(match) !== 1) return turn
    const source = readGenerationMetadata(record(sourceTurns[match])?.generationMetadata)
    if (!source) return turn
    const existing = readGenerationMetadata(row.generationMetadata)
    const metadata = inheritMetadata(source, existing)
    if (JSON.stringify(metadata) === JSON.stringify(existing)) return turn
    entries.push({ turnId: row.id, metadata })
    return { ...row, generationMetadata: metadata }
  })
  return { turns, entries }
}
