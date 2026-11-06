export type QueuedFollowUp = {
  predecessorTurnId?: string
  predecessorTaskId?: string
  execution?: { threadId: string; turnId?: string }
  blocked?: string
  destination: 'same' | 'new' | 'existing'
  destinationThreadId?: string
}

export function normalizeQueuedFollowUp(value: unknown): QueuedFollowUp | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const predecessorTurnId = typeof row.predecessorTurnId === 'string' ? row.predecessorTurnId.trim() : ''
  const predecessorTaskId = typeof row.predecessorTaskId === 'string' ? row.predecessorTaskId.trim() : ''
  if (!predecessorTurnId && !predecessorTaskId) return undefined
  const execution = row.execution as QueuedFollowUp['execution']
  if (row.destination !== 'same' && row.destination !== 'new' && row.destination !== 'existing') return undefined
  const destinationThreadId = typeof row.destinationThreadId === 'string' ? row.destinationThreadId.trim() : ''
  if (row.destination === 'existing' && !destinationThreadId) return undefined
  return { ...(predecessorTaskId ? { predecessorTaskId } : { predecessorTurnId }), destination: row.destination,
    ...(execution && typeof execution.threadId === 'string' ? { execution: { threadId: execution.threadId, ...(typeof execution.turnId === 'string' ? { turnId: execution.turnId } : {}) } } : {}),
    ...(typeof row.blocked === 'string' ? { blocked: row.blocked } : {}),
    ...(destinationThreadId ? { destinationThreadId } : {}) }
}

export function resolveQueuedPredecessor(id: string, sourceThreadId: string, tasks: Array<{ id: string; followUp?: QueuedFollowUp }>): { threadId: string; turnId: string } | string {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const task = byId.get(id)
  const link = task?.followUp
  if (!link) return 'Missing dependency'
  const seen = new Set([id])
  let parentId = link.predecessorTaskId
  while (parentId) {
    if (seen.has(parentId)) return 'Dependency cycle'
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) return 'Predecessor deleted'
    parentId = parent.followUp?.predecessorTaskId
  }
  if (link.predecessorTaskId) {
    const parent = byId.get(link.predecessorTaskId)!
    if (parent.followUp?.blocked) return 'Predecessor blocked'
    const execution = parent.followUp?.execution
    return execution?.turnId ? { threadId: execution.threadId, turnId: execution.turnId } : 'Waiting for predecessor dispatch'
  }
  return link.predecessorTurnId ? { threadId: sourceThreadId, turnId: link.predecessorTurnId } : 'Missing dependency'
}
