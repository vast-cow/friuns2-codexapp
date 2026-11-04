import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendQueueProcessor } from './codexAppServerBridge'
import { readCodexGlobalState, updateCodexGlobalState } from './codexGlobalState'
import { submittedGenerationMetadata } from '../turnGenerationMetadata'
import type { StoredQueuedMessage } from '../api/codexGateway'
import type { QueuedGenerationSettings } from '../queuedGenerationSettings'

type Turn = { threadId: string; message: StoredQueuedMessage }
type QueueExecution = {
  startQueuedTurn(turn: Turn): Promise<void>
  popNextQueuedTurn(threadId: string): Promise<Turn | null>
  restoreQueuedTurn(turn: Turn): Promise<void>
}
const threadId = 'queue-settings-thread'
const message = (id: string, model = 'M', effort: QueuedGenerationSettings['effort'] = 'low'): StoredQueuedMessage => ({
  id, text: id, imageUrls: [], skills: [], fileAttachments: [], collaborationMode: 'default',
  generationSettings: { model, effort },
})
let home: string
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'queue-settings-'))
  vi.stubEnv('CODEX_HOME', home)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(home, { recursive: true, force: true })
})

function execution(options: { threadProvider?: string; configProvider?: string; models?: unknown[]; unavailableCatalog?: boolean } = {}) {
  const starts: Record<string, unknown>[] = []
  const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === 'thread/resume') return { thread: { modelProvider: options.threadProvider ?? 'openai' } }
    if (method === 'config/read') return { config: { model: 'unrelated-global-model', model_provider: options.configProvider ?? 'openai', model_reasoning_effort: 'high' } }
    if (method === 'model/list') {
      if (options.unavailableCatalog) throw new Error('catalog offline')
      return { data: options.models ?? ['M', 'N'].map((id) => ({ id, supportedReasoningEfforts: ['none', 'low', 'medium'], defaultReasoningEffort: 'low' })) }
    }
    if (method === 'turn/start') {
      starts.push(params)
      return { turn: { id: `turn-${starts.length}` } }
    }
    throw new Error(`Unexpected RPC ${method}`)
  })
  const processor = Object.create(BackendQueueProcessor.prototype)
  processor.appServer = { rpc }
  return { processor: processor as QueueExecution, starts, rpc }
}

async function persist(queue: StoredQueuedMessage[]) {
  await updateCodexGlobalState((state) => { state['thread-queue-state'] = { [threadId]: queue } })
}

describe('queued generation settings at turn/start', () => {
  it.each(['M', 'N'])('executes independent low and medium turns with second model %s after disk restore', async (secondModel) => {
    const a = message('A', 'M', 'low')
    const b = { ...message('B', secondModel, 'medium'), collaborationMode: 'plan' as const }
    await persist([a, b])
    // Recreate the processor for each turn, as on a backend restart.
    const first = execution()
    const firstTurn = await first.processor.popNextQueuedTurn(threadId)
    await first.processor.startQueuedTurn(firstTurn!)
    const second = execution()
    const secondTurn = await second.processor.popNextQueuedTurn(threadId)
    await second.processor.startQueuedTurn(secondTurn!)
    const starts = [...first.starts, ...second.starts]
    expect(starts.map((params) => [params.model, params.effort])).toEqual([['M', 'low'], [secondModel, 'medium']])
    for (const [index, params] of starts.entries()) {
      expect(params.collaborationMode).toEqual({ mode: index ? 'plan' : 'default', settings: {
        model: params.model, reasoning_effort: params.effort, developer_instructions: null,
      } })
      expect(submittedGenerationMetadata(params)).toMatchObject({ model: params.model, effort: params.effort })
    }
    expect(first.rpc.mock.calls.map(([method]) => method)).toEqual(['thread/resume', 'config/read', 'model/list', 'turn/start'])
    expect(await second.processor.popNextQueuedTurn(threadId)).toBeNull()
  })

  it('keeps settings attached through reordering, normalization, and failed-turn restoration', async () => {
    const a = message('A', 'M', 'low')
    const b = message('B', 'N', 'medium')
    await persist([b, a])
    const { processor } = execution()
    const popped = await processor.popNextQueuedTurn(threadId)
    expect(popped?.message).toEqual(b)
    await processor.restoreQueuedTurn(popped!)
    const state = await readCodexGlobalState()
    expect(state['thread-queue-state']).toEqual({ [threadId]: [b, a] })
  })

  it('uses legacy config fallback without inventing a saved snapshot', async () => {
    const legacy = message('legacy')
    delete legacy.generationSettings
    await persist([legacy])
    const { processor, starts } = execution()
    const turn = await processor.popNextQueuedTurn(threadId)
    expect(turn?.message).not.toHaveProperty('generationSettings')
    await processor.startQueuedTurn(turn!)
    expect(starts[0]?.model).toBe('unrelated-global-model')
  })

  it.each([['none', 'none'], ['', undefined], ['xhigh', 'low']] as const)('resolves requested effort %j to %j consistently', async (effort, expected) => {
    const { processor, starts } = execution()
    await processor.startQueuedTurn({ threadId, message: message('A', 'M', effort) })
    expect(starts[0]?.effort).toBe(expected)
    expect(starts[0]?.collaborationMode).toMatchObject({ settings: { reasoning_effort: expected ?? null } })
  })

  it('preserves explicit settings when capability lookup is unavailable', async () => {
    const { processor, starts } = execution({ unavailableCatalog: true, threadProvider: 'codex' })
    await processor.startQueuedTurn({ threadId, message: message('A', 'M', 'medium') })
    expect(starts[0]).toMatchObject({ model: 'M', effort: 'medium' })
  })
})

it('blocks legacy alternative-provider queue settings before starting a turn', async () => {
  const { processor, starts } = execution()
  const legacy = message('legacy')
  legacy.generationSettings = { model: 'old-model', effort: 'low', unsupportedProvider: 'old-provider' }
  await expect(processor.startQueuedTurn({ threadId, message: legacy })).rejects.toThrow('removed provider')
  expect(starts).toEqual([])
})
