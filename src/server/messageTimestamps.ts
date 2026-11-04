import { readMessageTimestamp } from '../messageTimestamps.js'

type Times = { submittedAt?: string; completedAt?: string }
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {}

export function sessionMessageTimes(raw: string): Map<string, Times> {
  const times = new Map<string, Times>()
  let active = ''
  for (const line of raw.split('\n')) {
    try {
      const row = record(JSON.parse(line))
      const payload = record(row.payload)
      if (row.type === 'event_msg' && payload.type === 'task_started') {
        active = typeof payload.turn_id === 'string' ? payload.turn_id : ''
      } else if (row.type === 'turn_context') {
        active = typeof payload.turn_id === 'string' ? payload.turn_id : ''
      }
      if (row.type !== 'event_msg') continue
      const id = typeof payload.turn_id === 'string' ? payload.turn_id : active
      const timestamp = readMessageTimestamp(row.timestamp)
      if (!id || !timestamp) continue
      const entry = times.get(id) ?? {}
      if (payload.type === 'user_message' && !entry.submittedAt) entry.submittedAt = timestamp
      if (payload.type === 'task_complete') { entry.completedAt = timestamp; active = '' }
      times.set(id, entry)
    } catch { /* Ignore incomplete JSONL records. */ }
  }
  return times
}

export function mergeMessageTimes(turns: unknown[], times: Map<string, Times>): unknown[] {
  return turns.map(turn => {
    const row = record(turn)
    const evidence = typeof row.id === 'string' ? times.get(row.id) : undefined
    return evidence ? { ...row, ...evidence } : turn
  })
}
