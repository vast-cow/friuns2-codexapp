import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reasoningCatalog } from '../api/codexGateway'
import { useDesktopState } from './useDesktopState'

vi.mock('../api/codexGateway', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/codexGateway')>(),
  getCurrentModelConfig: vi.fn(async () => ({ model: 'A', providerId: 'codex', speedMode: 'standard', reasoningEffort: 'medium' })),
  getAvailableModelIds: vi.fn(async () => ({ ids: ['A', 'B'], models: reasoningCatalog.value.models })),
  getThreadGroupsPage: vi.fn(async () => ({ groups: [], nextCursor: null })),
  getWorkspaceRootsState: vi.fn(async () => ({ roots: [], order: [], hiddenProjectPaths: [], removedProjectPaths: [] })),
  getThreadQueueState: vi.fn(async () => ({})),
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
  reasoningCatalog.value = { providerId: 'codex', models: [
    { id: 'A', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'low' },
    { id: 'B', supportedReasoningEfforts: ['medium', 'high'], defaultReasoningEffort: 'medium' },
  ] }
})
afterEach(() => {
  reasoningCatalog.value = { providerId: '', models: [] }
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

  it('isolates identical model IDs across providers', async () => {
    store.set(effortKey, JSON.stringify({ '["codex","A"]': 'high', '["other","A"]': 'low' }))
    const state = useDesktopState()
    const { getCurrentModelConfig } = await import('../api/codexGateway')
    vi.mocked(getCurrentModelConfig).mockResolvedValue({ model: 'A', providerId: 'other', speedMode: 'standard', reasoningEffort: '' })
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    state.setSelectedModelIdForThread('', 'A')
    expect(state.readReasoningEffortForThread('')).toBe('low')
    vi.mocked(getCurrentModelConfig).mockResolvedValue({ model: 'A', providerId: 'codex', speedMode: 'standard', reasoningEffort: '' })
    await state.refreshAll({ includeSelectedThreadMessages: false, awaitAncillaryRefreshes: true })
    reasoningCatalog.value = { providerId: 'codex', models: reasoningCatalog.value.models }
    state.setSelectedModelIdForThread('', 'A')
    expect(state.readReasoningEffortForThread('')).toBe('high')
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
