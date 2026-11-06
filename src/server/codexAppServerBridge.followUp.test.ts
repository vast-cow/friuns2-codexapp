import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BackendQueueProcessor } from './codexAppServerBridge'
import { readCodexGlobalState, updateCodexGlobalState } from './codexGlobalState'

let home: string
let processor: BackendQueueProcessor
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'follow-up-'))
  vi.stubEnv('CODEX_HOME', home)
})
afterEach(async () => {
  processor?.dispose()
  vi.unstubAllEnvs()
  await rm(home, { recursive: true, force: true })
})
async function setup(destination: 'same' | 'new' | 'existing' = 'existing') {
  const state = { predecessor: 'inProgress', busy: false }
  const starts: Record<string, unknown>[] = []
  const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === 'thread/read') return { thread: { cwd: '/project', status: { type: params.threadId === 'T2' && state.busy ? 'active' : 'idle' }, turns: params.threadId === 'T1' ? [{ id: 'P', status: state.predecessor }] : [] } }
    if (method === 'thread/start') return { thread: { id: 'NEW' } }
    if (method === 'thread/resume') return {}
    if (method === 'config/read') return { config: {} }
    if (method === 'model/list') return { data: [] }
    if (method === 'turn/start') { starts.push(params); return { turn: { id: 'F' } } }
    throw Error(method)
  })
  await updateCodexGlobalState((value) => { value['thread-queue-state'] = { T1: [{
    id: 'Q', text: 'follow-up', imageUrls: [], skills: [{ name: 'skill', path: '/skill' }], fileAttachments: [], collaborationMode: 'plan',
    generationSettings: { model: 'M', effort: 'low' },
    followUp: { predecessorTurnId: 'P', destination, ...(destination === 'existing' ? { destinationThreadId: 'T2' } : {}) },
  }] } })
  processor = new BackendQueueProcessor({ rpc, onNotification: () => () => {} } as never)
  return { state, starts, rpc }
}
it('waits for the exact predecessor, then waits for a busy destination', async () => {
  const { state, starts } = await setup()
  await processor.processThreadQueue('T1')
  expect(starts).toHaveLength(0)
  state.predecessor = 'completed'
  state.busy = true
  await processor.processThreadQueue('T1')
  expect(starts).toHaveLength(0)
  state.busy = false
  await Promise.all([processor.processThreadQueue('T1'), processor.processThreadQueue('T1')])
  await processor.processThreadQueue('T1')
  expect(starts).toHaveLength(1)
  expect(starts[0]).toMatchObject({ threadId: 'T2', model: 'M', effort: 'low', collaborationMode: { mode: 'plan' }, input: [{ type: 'text', text: 'follow-up' }, { type: 'skill', name: 'skill' }] })
})
it.each(['completed', 'failed', 'interrupted', 'canceled', 'cancelled'])('recovers %s predecessors from disk without browser notifications', async (status) => {
  const { state, starts } = await setup('same')
  state.predecessor = status
  await processor.processThreadQueue('T1')
  expect(starts[0]?.threadId).toBe('T1')
})
it('does not treat approval or input waiting as completion', async () => {
  const { state, starts } = await setup()
  for (const status of ['inProgress', 'waitingForApproval', 'waitingForInput']) {
    state.predecessor = status
    await processor.processThreadQueue('T1')
  }
  expect(starts).toHaveLength(0)
})
it('creates a destination with normal cwd/model context and persists it before dispatch', async () => {
  const { state, starts, rpc } = await setup('new')
  state.predecessor = 'completed'
  await processor.processThreadQueue('T1')
  expect(rpc).toHaveBeenCalledWith('thread/start', { cwd: '/project', model: 'M' })
  expect(starts[0]?.threadId).toBe('NEW')
  expect((await readCodexGlobalState())['thread-queue-state'] ?? {}).toEqual({})
})
it('restores the independent trigger and destination after backend replacement', async () => {
  const { state, starts, rpc } = await setup()
  await processor.processThreadQueue('T1')
  processor.dispose()
  processor = new BackendQueueProcessor({ rpc, onNotification: () => () => {} } as never)
  await processor.processThreadQueue('T1')
  expect(starts).toHaveLength(0)
  state.predecessor = 'completed'
  await processor.processThreadQueue('T1')
  expect(starts).toHaveLength(1)
  expect(starts[0]).toMatchObject({ threadId: 'T2', model: 'M', effort: 'low', collaborationMode: { mode: 'plan' } })
})
