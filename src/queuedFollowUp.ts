export type QueuedFollowUp = {
  predecessorTurnId: string
  destination: 'same' | 'new' | 'existing'
  destinationThreadId?: string
}

export function normalizeQueuedFollowUp(value: unknown): QueuedFollowUp | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  if (typeof row.predecessorTurnId !== 'string' || !row.predecessorTurnId.trim()) return undefined
  if (row.destination !== 'same' && row.destination !== 'new' && row.destination !== 'existing') return undefined
  const destinationThreadId = typeof row.destinationThreadId === 'string' ? row.destinationThreadId.trim() : ''
  if (row.destination === 'existing' && !destinationThreadId) return undefined
  return { predecessorTurnId: row.predecessorTurnId.trim(), destination: row.destination,
    ...(destinationThreadId ? { destinationThreadId } : {}) }
}
