import { computed } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reasoningCatalog } from '../api/codexGateway'
import { useDesktopState } from './useDesktopState'

vi.mock('../api/codexGateway', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/codexGateway')>(),
  getCurrentModelConfig: vi.fn(async () => ({ model: 'A', speedMode: 'standard', reasoningEffort: 'medium' })),
  getAvailableModelIds: vi.fn(async () => ({ ids: ['A', 'B'], models: reasoningCatalog.value })),
  getThreadGroupsPage: vi.fn(async () => ({ groups: [], nextCursor: null })),
  getWorkspaceRootsState: vi.fn(async () => ({ order: [], labels: {}, active: [], projectOrder: [] })),
  getThreadTitleCache: vi.fn(async () => ({ titles: {} })),
  getAvailableCollaborationModes: vi.fn(async () => [{ value: 'default', label: 'Default' }]),
  getSkillsList: vi.fn(async () => []),
  getAccountRateLimits: vi.fn(async () => null),
}))

const modelKey = 'codex-web-local.selected-model-by-context.v1'
const effortKey = 'codex-web-local.reasoning-by-provider-model.v1'
let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
  })
  reasoningCatalog.value = [
    { id: 'A', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'low' },
    { id: 'B', supportedReasoningEfforts: ['medium', 'high'], defaultReasoningEffort: 'medium' },
  ]
})
afterEach(() => {
  reasoningCatalog.value = []
  vi.unstubAllGlobals()
})

describe('persistent composer model preferences', () => {
  it('restores separate model efforts immediately and after recreating desktop state', () => {
    const state = useDesktopState()
    state.setSelectedModelIdForThread('', 'A')
    state.setSelectedReasoningEffort('high', '')
    state.setSelectedModelIdForThread('', 'B')
    expect(state.readReasoningEffortForThread('')).toBe('medium')
    state.setSelectedReasoningEffort('medium', '')
    state.setSelectedModelIdForThread('', 'A')
    expect(state.readReasoningEffortForThread('')).toBe('high')
    state.setSelectedModelIdForThread('', 'B')
    const reopened = useDesktopState()
    expect(reopened.readModelIdForThread('')).toBe('B')
    expect(reopened.readReasoningEffortForThread('')).toBe('medium')
    reopened.setSelectedModelIdForThread('', 'A')
    expect(reopened.readReasoningEffortForThread('')).toBe('high')
  })

  it('uses capability defaults for missing, corrupt, and unsupported preferences without rewriting storage', () => {
    store.set(effortKey, '{invalid')
    const state = useDesktopState()
    state.setSelectedModelIdForThread('', 'A')
    expect(state.readReasoningEffortForThread('')).toBe('low')
    store.set(effortKey, JSON.stringify({ '["codex","A"]': 'xhigh' }))
    const reopened = useDesktopState()
    expect(reopened.readReasoningEffortForThread('')).toBe('low')
    expect(store.get(effortKey)).toContain('xhigh')
  })

  it('resolves home reasoning against its own model while another thread is selected', () => {
    const state = useDesktopState()
    state.setSelectedModelIdForThread('existing-thread', 'A')
    state.primeSelectedThread('existing-thread')
    state.setSelectedReasoningEffort('high', 'existing-thread')
    state.setSelectedModelIdForThread('__new-thread__', 'B')
    expect(state.readReasoningEffortForThread('__new-thread__')).toBe('medium')
    expect(state.readReasoningOptionsForThread('__new-thread__').map((option) => option.value)).toEqual(['medium', 'high'])
    expect(state.readReasoningEffortForThread('existing-thread')).toBe('high')
  })

  it('keeps saved choices during catalog fallback and restores them when available again', async () => {
    store.set(modelKey, JSON.stringify({ '__new-thread-provider__::codex': 'unavailable' }))
    store.set(effortKey, JSON.stringify({ '["codex","unavailable"]': 'high' }))
    const state = useDesktopState()
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    expect(state.readModelIdForThread('')).toBe('A')
    expect(JSON.parse(store.get(modelKey)!)).toEqual({ '__new-thread-provider__::codex': 'unavailable' })
    expect(store.get(effortKey)).toContain('high')
    const { getAvailableModelIds } = await import('../api/codexGateway')
    vi.mocked(getAvailableModelIds).mockResolvedValueOnce({ ids: ['A', 'unavailable'], models: [
      { id: 'unavailable', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'low' },
    ] })
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    expect(state.readModelIdForThread('')).toBe('unavailable')
    expect(state.readReasoningEffortForThread('')).toBe('high')
  })
})

it('updates the displayed model when the Codex catalog arrives after the composer mounts', async () => {
  const state = useDesktopState()
  const displayed = computed(() => state.readModelIdForThread(''))
  expect(displayed.value).toBe('')
  await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
  expect(displayed.value).toBe('A')
})

const usageKey = 'codex-web-local.model-usage-order.v1'

it('orders explicit selections across contexts and persists without changing selection or efforts', async () => {
  const state = useDesktopState()
  await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
  state.setSelectedModelIdForThread('', 'B')
  state.setSelectedReasoningEffort('high', '')
  state.setSelectedModelIdForThread('existing', 'A')
  expect(state.availableModelIds.value).toEqual(['A', 'B'])
  state.setSelectedModelIdForThread('existing', 'B')
  expect(state.availableModelIds.value).toEqual(['B', 'A'])
  const reopened = useDesktopState()
  await reopened.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
  expect(reopened.availableModelIds.value).toEqual(['B', 'A'])
  expect(reopened.readReasoningEffortForThread('')).toBe('high')
  const stored = store.get(usageKey)
  reopened.primeSelectedThread('existing')
  await reopened.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
  expect(store.get(usageKey)).toBe(stored)
})

it.each(['{invalid', '{}', 'null', '[1,null,"", "B", "B", "missing"]'])('handles stored usage %s and preserves unused catalog order', async (raw) => {
  store.set(usageKey, raw)
  const state = useDesktopState()
  await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
  expect(state.availableModelIds.value).toEqual(raw.includes('"B"') ? ['B', 'A'] : ['A', 'B'])
  expect(store.get(usageKey)).toBe(raw)
})

it('records the model actually submitted in an existing thread', async () => {
  const gateway = await import('../api/codexGateway')
  const resume = vi.spyOn(gateway, 'resumeThread').mockResolvedValue({ model: 'A' } as Awaited<ReturnType<typeof gateway.resumeThread>>)
  const start = vi.spyOn(gateway, 'startThreadTurn').mockRejectedValue(new Error('test submission'))
  const state = useDesktopState()
  state.setSelectedModelIdForThread('existing', 'A')
  state.setSelectedModelIdForThread('', 'B')
  state.primeSelectedThread('existing')
  await expect(state.sendMessageToSelectedThread('MRU test')).rejects.toThrow('test submission')
  expect(JSON.parse(store.get(usageKey)!)).toEqual(['A', 'B'])
  expect(start).toHaveBeenCalled()
  resume.mockRestore()
  start.mockRestore()
})
