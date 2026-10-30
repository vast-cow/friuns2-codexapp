import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDesktopState } from './useDesktopState'
import type { ResumedThread, RpcNotification } from '../api/codexGateway'
import type { UiMessage, UiThread } from '../types/codex'

const gateway = vi.hoisted(() => ({
  getThreadGroupsPage: vi.fn(),
  getThreadDetail: vi.fn(),
  resumeThread: vi.fn(),
  startThreadTurn: vi.fn(),
  startThread: vi.fn(),
  generateThreadTitle: vi.fn(),
  subscribeCodexNotifications: vi.fn(),
  getPendingServerRequests: vi.fn(),
  getThreadQueueState: vi.fn(),
  setThreadQueueState: vi.fn(),
  getThreadTitleCache: vi.fn(),
  getWorkspaceRootsState: vi.fn(),
  getAvailableModelIds: vi.fn(),
  getCurrentModelConfig: vi.fn(),
  getAvailableCollaborationModes: vi.fn(),
  getSkillsList: vi.fn(),
  getAccountRateLimits: vi.fn(),
}))

vi.mock('../api/codexGateway', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/codexGateway')>(),
  ...gateway,
}))

const oldUser: UiMessage = {
  id: 'user-1', role: 'user', text: 'hello', messageType: 'userMessage', turnId: 'turn-1', turnIndex: 0,
}
const nextUser: UiMessage = {
  id: 'user-2', role: 'user', text: 'sent-now', messageType: 'userMessage', turnId: 'turn-2', turnIndex: 1,
}
const reply: UiMessage = {
  id: 'assistant-2', role: 'assistant', text: 'visible reply', messageType: 'agentMessage', turnId: 'turn-2', turnIndex: 1,
}
const thread: UiThread = {
  id: 'thread-1', title: 'Test chat', cwd: '/tmp/project', projectName: 'project',
  createdAtIso: '2026-10-30T00:00:00Z', updatedAtIso: '2026-10-30T00:00:00Z',
  preview: '', unread: false, inProgress: false, hasWorktree: false,
}
const oldDetail: ResumedThread = {
  model: 'gpt-5.5', modelProvider: 'openai', messages: [oldUser],
  inProgress: false, activeTurnId: '', hasMoreOlder: false, turnIndexByTurnId: { 'turn-1': 0 },
}
const completedDetail: ResumedThread = {
  ...oldDetail, messages: [oldUser, nextUser, reply], turnIndexByTurnId: { 'turn-1': 0, 'turn-2': 1 },
}
const activeDetail: ResumedThread = {
  ...completedDetail, messages: [oldUser, nextUser], inProgress: true, activeTurnId: 'turn-2',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

let notificationHandler: (notification: RpcNotification) => void

function notify(notification: Omit<RpcNotification, 'atIso'>) {
  notificationHandler({ ...notification, atIso: new Date().toISOString() })
}
const states: Array<ReturnType<typeof useDesktopState>> = []

function createState() {
  const state = useDesktopState()
  states.push(state)
  state.primeSelectedThread(thread.id)
  return state
}

async function loadState() {
  const state = createState()
  await state.refreshAll({ includeSelectedThreadMessages: true, awaitAncillaryRefreshes: true })
  state.startPolling()
  return state
}

function turnStarted() {
  notify({ method: 'turn/started', params: { threadId: thread.id, turn: { id: 'turn-2', status: 'inProgress' } } })
}

function turnCompleted() {
  notify({ method: 'turn/completed', params: { threadId: thread.id, turn: { id: 'turn-2', status: 'completed' } } })
}

function streamReply(text = reply.text) {
  notify({ method: 'item/agentMessage/delta', params: { threadId: thread.id, turnId: 'turn-2', itemId: reply.id, delta: text } })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-30T00:00:00Z'))
  const storage = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  })
  gateway.getThreadGroupsPage.mockResolvedValue({ groups: [{ projectName: 'project', threads: [thread] }], nextCursor: null })
  gateway.getThreadQueueState.mockResolvedValue({})
  gateway.setThreadQueueState.mockResolvedValue({})
  gateway.getThreadTitleCache.mockResolvedValue({ titles: {} })
  gateway.getWorkspaceRootsState.mockRejectedValue(new Error('no workspace roots'))
  gateway.getAvailableModelIds.mockResolvedValue({ ids: ['gpt-5.5'], models: [] })
  gateway.getCurrentModelConfig.mockResolvedValue({ model: 'gpt-5.5', providerId: 'codex', reasoningEffort: '', speedMode: 'standard' })
  gateway.getAvailableCollaborationModes.mockResolvedValue([{ value: 'default', label: 'Default' }])
  gateway.getSkillsList.mockResolvedValue([])
  gateway.getAccountRateLimits.mockResolvedValue(null)
  gateway.getPendingServerRequests.mockResolvedValue([])
  gateway.resumeThread.mockResolvedValue(oldDetail)
  gateway.getThreadDetail.mockResolvedValue(activeDetail)
  gateway.startThreadTurn.mockResolvedValue('turn-2')
  gateway.startThread.mockResolvedValue({ threadId: thread.id, model: 'gpt-5.5', modelProvider: 'openai' })
  gateway.generateThreadTitle.mockResolvedValue('')
  gateway.subscribeCodexNotifications.mockImplementation((handler) => { notificationHandler = handler; return vi.fn() })
})

afterEach(() => {
  for (const state of states.splice(0)) state.stopPolling()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('message visibility during sends and history synchronization', () => {
  it('keeps the first optimistic message in a new thread and replaces it without duplication', async () => {
    const state = createState()
    state.startPolling()
    const started = deferred<string>()
    gateway.startThreadTurn.mockImplementation(() => { turnStarted(); return started.promise })
    const newThreadUser = { ...nextUser, turnIndex: 0 }
    gateway.getThreadDetail.mockResolvedValue({ ...activeDetail, messages: [newThreadUser], turnIndexByTurnId: { 'turn-2': 0 } })
    expect(await state.sendMessageToNewThread(nextUser.text, '/tmp/project')).toBe(thread.id)
    expect(state.messages.value.filter((message) => message.role === 'user')).toMatchObject([
      { text: nextUser.text, messageType: 'userMessage.optimistic', turnIndex: 0 },
    ])
    started.resolve('turn-2')
    await vi.advanceTimersByTimeAsync(0)
    expect(state.messages.value.filter((message) => message.role === 'user')).toEqual([newThreadUser])
  })

  it('shows an existing-thread send before the turn request resolves', async () => {
    const state = await loadState()
    const started = deferred<string>()
    gateway.startThreadTurn.mockReturnValue(started.promise)
    const sending = state.sendMessageToSelectedThread(nextUser.text)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.messages.value.filter((message) => message.text === nextUser.text)).toHaveLength(1)
    started.resolve('turn-2')
    await sending
    expect(gateway.getThreadDetail).toHaveBeenCalledTimes(1)
    expect(state.messages.value.filter((message) => message.text === nextUser.text)).toEqual([nextUser])
  })

  it('fetches completion inside the two-second cache window and survives reload', async () => {
    const state = await loadState()
    gateway.startThreadTurn.mockImplementation(async () => { turnStarted(); return 'turn-2' })
    await state.sendMessageToSelectedThread(nextUser.text)
    gateway.getThreadDetail.mockResolvedValue(completedDetail)
    turnCompleted()
    await vi.advanceTimersByTimeAsync(5000)
    expect(gateway.getThreadDetail).toHaveBeenCalledTimes(2)
    expect(state.messages.value.filter((message) => message.role !== 'system')).toEqual(completedDetail.messages)
    expect(state.selectedLiveOverlay.value).toBeNull()
    // Unchanged navigation still reuses the cache and adds no history request.
    await state.loadMessages(thread.id)
    expect(gateway.getThreadDetail).toHaveBeenCalledTimes(2)
    gateway.resumeThread.mockResolvedValue(completedDetail)
    const reloaded = createState()
    await reloaded.loadMessages(thread.id)
    expect(reloaded.messages.value).toEqual(completedDetail.messages)
  })

  it('refreshes a changed thread version even within two seconds', async () => {
    const state = await loadState()
    gateway.getThreadGroupsPage.mockResolvedValue({
      groups: [{ projectName: 'project', threads: [{ ...thread, updatedAtIso: '2026-10-30T00:00:01Z' }] }], nextCursor: null,
    })
    gateway.getThreadDetail.mockResolvedValue(completedDetail)
    await state.refreshAll({ forceThreadRefresh: true })
    expect(gateway.getThreadDetail).toHaveBeenCalledTimes(1)
    expect(state.messages.value).toEqual(completedDetail.messages)
  })

  it('retains the submitted message alongside an error when sending fails', async () => {
    const state = await loadState()
    gateway.startThreadTurn.mockRejectedValue(new Error('send failed'))
    await expect(state.sendMessageToSelectedThread(nextUser.text)).rejects.toThrow('send failed')
    expect(state.messages.value.filter((message) => message.text === nextUser.text)).toHaveLength(1)
    expect(state.selectedLiveOverlay.value?.errorText).toBe('send failed')
  })

  it('retries a transient history failure when a completion notification arrives', async () => {
    const state = await loadState()
    gateway.getThreadDetail.mockRejectedValueOnce(new Error('temporary read failure'))
    await expect(state.loadMessages(thread.id, { force: true })).rejects.toThrow('temporary read failure')
    gateway.getThreadDetail.mockResolvedValue(completedDetail)
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.role !== 'system')).toEqual(completedDetail.messages)
    expect(state.selectedLiveOverlay.value).toBeNull()
  })

  it('keeps a live reply when a stale completed snapshot arrives, then reconciles it once', async () => {
    const state = await loadState()
    const pending = deferred<ResumedThread>()
    gateway.getThreadDetail.mockReturnValueOnce(pending.promise)
    turnStarted()
    await vi.advanceTimersByTimeAsync(220)
    streamReply()
    expect(state.messages.value.some((message) => message.text === reply.text)).toBe(true)
    pending.resolve(oldDetail)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.messages.value.some((message) => message.text === reply.text)).toBe(true)
    expect(state.selectedLiveOverlay.value).not.toBeNull()
    gateway.getThreadDetail.mockResolvedValue(completedDetail)
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.id === reply.id)).toEqual([reply])
    expect(state.selectedLiveOverlay.value).toBeNull()
  })

  it('does not let a history read begun after turn start reset a newer active turn', async () => {
    const state = await loadState()
    gateway.getThreadDetail.mockResolvedValue(oldDetail)
    turnStarted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.selectedLiveOverlay.value).not.toBeNull()
    expect(state.messages.value).toEqual([oldUser])
  })

  it('keeps a completed live reply until history contains it', async () => {
    const state = await loadState()
    turnStarted()
    notify({ method: 'item/completed', params: { threadId: thread.id, item: { id: reply.id, type: 'agentMessage', text: reply.text } } })
    gateway.getThreadDetail.mockResolvedValue(oldDetail)
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.id === reply.id)).toHaveLength(1)
    gateway.getThreadDetail.mockResolvedValue(completedDetail)
    await state.loadMessages(thread.id, { silent: true, force: true })
    expect(state.messages.value.filter((message) => message.id === reply.id)).toEqual([reply])
  })

  it('does not truncate or duplicate live text when history has an earlier prefix', async () => {
    const state = await loadState()
    turnStarted()
    streamReply()
    gateway.getThreadDetail.mockResolvedValue({ ...activeDetail, messages: [oldUser, nextUser, { ...reply, text: 'visible' }] })
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.id === reply.id).map((message) => message.text)).toEqual([reply.text])
    streamReply(' continued')
    expect(state.messages.value.filter((message) => message.id === reply.id).map((message) => message.text)).toEqual([reply.text + ' continued'])
    gateway.getThreadDetail.mockResolvedValue({ ...completedDetail, messages: [oldUser, nextUser, { ...reply, text: reply.text + ' continued' }] })
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.id === reply.id).map((message) => message.text)).toEqual([reply.text + ' continued'])
  })

  it('performs one follow-up read for completion arriving during a pending history read', async () => {
    const state = await loadState()
    await vi.advanceTimersByTimeAsync(2500)
    const pending = deferred<ResumedThread>()
    gateway.getThreadDetail.mockReturnValueOnce(pending.promise).mockResolvedValue(completedDetail)
    turnStarted()
    const loading = state.loadMessages(thread.id)
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    pending.resolve(activeDetail)
    await loading
    await vi.advanceTimersByTimeAsync(220)
    expect(gateway.getThreadDetail).toHaveBeenCalledTimes(2)
    expect(state.messages.value.filter((message) => message.role !== 'system')).toEqual(completedDetail.messages)
    expect(state.selectedLiveOverlay.value).toBeNull()
  })

  it('continues streaming from the persisted prefix after history catches up mid-turn', async () => {
    const state = await loadState()
    turnStarted()
    streamReply('visible')
    gateway.getThreadDetail.mockResolvedValue({ ...activeDetail, messages: [oldUser, nextUser, { ...reply, text: 'visible' }] })
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.filter((message) => message.id === reply.id).map((message) => message.text)).toEqual(['visible'])
    streamReply(' reply')
    expect(state.messages.value.filter((message) => message.id === reply.id).map((message) => message.text)).toEqual([reply.text])
  })

  it('does not deduplicate a repeated prompt against a previous turn', async () => {
    const state = await loadState()
    gateway.getThreadDetail.mockResolvedValue(oldDetail)
    await state.sendMessageToSelectedThread(oldUser.text)
    expect(state.messages.value.filter((message) => message.text === oldUser.text)).toHaveLength(2)
    gateway.getThreadDetail.mockResolvedValue({ ...activeDetail, messages: [oldUser, { ...nextUser, text: oldUser.text }] })
    await state.loadMessages(thread.id, { force: true, silent: true })
    expect(state.messages.value.filter((message) => message.text === oldUser.text)).toHaveLength(2)
    expect(state.messages.value.some((message) => message.messageType === 'userMessage.optimistic')).toBe(false)
  })

  it('keeps queued submissions out of the conversation until they are sent', async () => {
    const state = await loadState()
    turnStarted()
    await state.sendMessageToSelectedThread('queued', [], [], 'queue')
    expect(state.messages.value.some((message) => message.text === 'queued')).toBe(false)
    expect(state.selectedThreadQueuedMessages.value.map((message) => message.text)).toEqual(['queued'])
    expect(gateway.startThreadTurn).not.toHaveBeenCalled()
  })

  it('shows steering submissions immediately with unique IDs for rapid sends', async () => {
    const state = await loadState()
    turnStarted()
    const started = deferred<string>()
    gateway.startThreadTurn.mockReturnValue(started.promise)
    await state.sendMessageToSelectedThread('first', [], [], 'steer')
    await state.sendMessageToSelectedThread('second', [], [], 'steer')
    const optimistic = state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic')
    expect(optimistic.map((message) => message.text)).toEqual(['first', 'second'])
    expect(new Set(optimistic.map((message) => message.id)).size).toBe(2)
    started.resolve('turn-2')
    await vi.advanceTimersByTimeAsync(0)
  })
})
