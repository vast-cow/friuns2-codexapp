import { expect, it } from 'vitest'
import { normalizeQueuedFollowUp, resolveQueuedPredecessor, type QueuedFollowUp } from './queuedFollowUp'
const task = (id: string, followUp: QueuedFollowUp) => ({ id, followUp })
it('resolves Same thread from the immediate predecessor actual execution', () => {
  const b = task('B', { predecessorTurnId: 'A', destination: 'new' })
  const c = task('C', { predecessorTaskId: 'B', destination: 'same' })
  expect(resolveQueuedPredecessor('C', 'T1', [b, c])).toBe('Waiting for predecessor dispatch')
  b.followUp.execution = { threadId: 'T2', turnId: 'B-turn' }
  expect(resolveQueuedPredecessor('C', 'T1', [b, c])).toEqual({ threadId: 'T2', turnId: 'B-turn' })
  expect(normalizeQueuedFollowUp(JSON.parse(JSON.stringify(b.followUp)))).toEqual(b.followUp)
})
it('blocks deleted predecessors, self links and cycles', () => {
  const c = task('C', { predecessorTaskId: 'B', destination: 'same' })
  expect(resolveQueuedPredecessor('C', 'T1', [c])).toBe('Predecessor deleted')
  expect(resolveQueuedPredecessor('C', 'T1', [task('C', { predecessorTaskId: 'C', destination: 'same' })])).toBe('Dependency cycle')
  expect(resolveQueuedPredecessor('C', 'T1', [c, task('B', { predecessorTaskId: 'C', destination: 'new' })])).toBe('Dependency cycle')
})
