import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDesktopState } from './useDesktopState'
import { reasoningCatalog } from '../api/codexGateway'
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

  it.each(['gpt-5.5', 'other-model'])('captures independent queue settings before awaits, retains them through reorder and reload (%s)', async (secondModel) => {
    const state = await loadState()
    turnStarted()
    reasoningCatalog.value = { providerId: 'codex', models: ['gpt-5.5', 'other-model'].map((id) => ({
      id, supportedReasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'low',
    })) }
    state.setSelectedReasoningEffort('low')
    // Change the composer immediately, before the first submission resumes after its await.
    const first = state.sendMessageToSelectedThread('A', [], [], 'queue')
    state.setSelectedModelId(secondModel)
    state.setSelectedReasoningEffort('medium')
    const second = state.sendMessageToSelectedThread('B', [], [], 'queue')
    state.setSelectedReasoningEffort('high')
    await Promise.all([first, second])
    const [a, b] = state.selectedThreadQueuedMessages.value
    expect(a?.generationSettings).toEqual({ model: 'gpt-5.5', effort: 'low', providerId: 'openai' })
    expect(b?.generationSettings).toEqual({ model: secondModel, effort: 'medium', providerId: 'openai' })
    state.reorderQueuedMessage(b!.id, a!.id)
    const saved = gateway.setThreadQueueState.mock.calls.at(-1)![0]
    expect(saved[thread.id].map((item: { text: string }) => item.text)).toEqual(['B', 'A'])
    gateway.getThreadQueueState.mockResolvedValue(JSON.parse(JSON.stringify(saved)))
    const reopened = await loadState()
    expect(reopened.selectedThreadQueuedMessages.value).toEqual([b, a])
  })

  it('retains submission settings if the active turn completes during the enqueue await', async () => {
    const state = await loadState()
    turnStarted()
    reasoningCatalog.value = { providerId: 'codex', models: [{
      id: 'gpt-5.5', supportedReasoningEfforts: ['low', 'medium'], defaultReasoningEffort: 'low',
    }] }
    state.setSelectedReasoningEffort('low')
    const submitted = state.sendMessageToSelectedThread('queued as the turn finishes', [], [], 'queue')
    state.setSelectedReasoningEffort('medium')
    turnCompleted()
    await submitted
    expect(gateway.startThreadTurn.mock.calls[0]?.slice(3, 5)).toEqual(['gpt-5.5', 'low'])
  })

  it('keeps saved settings when editing and steering without altering composer preferences', async () => {
    const state = await loadState()
    turnStarted()
    reasoningCatalog.value = { providerId: 'codex', models: [{
      id: 'gpt-5.5', supportedReasoningEfforts: ['low', 'medium'], defaultReasoningEffort: 'low',
    }] }
    state.setSelectedReasoningEffort('low')
    await state.sendMessageToSelectedThread('original', [], [], 'queue')
    const original = state.selectedThreadQueuedMessages.value[0]!
    state.removeQueuedMessage(original.id)
    state.setSelectedReasoningEffort('medium')
    await state.sendMessageToSelectedThread('edited', [], [], 'queue', [], 0, original.collaborationMode, original.generationSettings)
    expect(state.selectedThreadQueuedMessages.value[0]?.generationSettings).toEqual(original.generationSettings)
    state.steerQueuedMessage(state.selectedThreadQueuedMessages.value[0]!.id)
    await vi.waitFor(() => expect(gateway.startThreadTurn).toHaveBeenCalled())
    expect(gateway.startThreadTurn.mock.calls[0]?.slice(3, 5)).toEqual(['gpt-5.5', 'low'])
    expect(state.selectedReasoningEffort.value).toBe('medium')
  })

  it('does not assign a snapshot when an edited legacy entry is resubmitted', async () => {
    const state = await loadState()
    turnStarted()
    await state.sendMessageToSelectedThread('legacy edit', [], [], 'queue', [], 0, 'plan', null)
    expect(state.selectedThreadQueuedMessages.value[0]).not.toHaveProperty('generationSettings')
    expect(gateway.setThreadQueueState.mock.calls.at(-1)![0][thread.id][0]).not.toHaveProperty('generationSettings')
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

const pastedFile = {
  label: 'pasted-text-2026-11-04-12-00-00.txt',
  path: '/api/uploads/pasted-text-2026-11-04-12-00-00.txt',
  fsPath: '/tmp/codex-web-uploads/pasted-text-2026-11-04-12-00-00.txt',
}
const secondFile = {
  label: 'notes.txt', path: '/api/uploads/notes.txt', fsPath: '/tmp/codex-web-uploads/notes.txt',
}

function attachmentUser(files = [pastedFile], text = `Attached file: ${pastedFile.label}`): UiMessage {
  return { ...nextUser, text, fileAttachments: files.map(({ label, path }) => ({ label, path })) }
}

function attachmentDetail(user: UiMessage, previous: UiMessage[] = [oldUser]): ResumedThread {
  return {
    ...activeDetail,
    messages: [...previous, user],
    turnIndexByTurnId: { ...oldDetail.turnIndexByTurnId, [user.turnId!]: user.turnIndex! },
    activeTurnId: user.turnId!,
  }
}

function expectConfirmedAttachment(state: ReturnType<typeof useDesktopState>, expected: UiMessage[]) {
  expect(state.messages.value.filter((message) => message.role === 'user')).toEqual(expected)
  expect(state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic')).toEqual([])
}

describe('optimistic attachment reconciliation', () => {
  it.each([
    { context: 'new', prompt: '', files: [pastedFile] },
    { context: 'new', prompt: 'Read these notes', files: [pastedFile] },
    { context: 'existing', prompt: '', files: [pastedFile] },
    { context: 'existing', prompt: 'Read these notes', files: [pastedFile] },
    { context: 'new', prompt: '', files: [pastedFile, secondFile] },
    { context: 'existing', prompt: '', files: [pastedFile, secondFile] },
  ])('replaces $context-thread optimistic attachments (prompt: "$prompt", files: $files.length)', async ({ context, prompt, files }) => {
    const isNew = context === 'new'
    const state = isNew ? createState() : await loadState()
    if (isNew) state.startPolling()
    const started = deferred<string>()
    gateway.startThreadTurn.mockReturnValue(started.promise)
    const persisted = {
      ...attachmentUser(files, prompt || `Attached file${files.length > 1 ? 's' : ''}: ${files.map((file) => file.label).join(', ')}`),
      turnIndex: isNew ? 0 : 1,
    }
    gateway.getThreadDetail.mockResolvedValue(attachmentDetail(persisted, isNew ? [] : [oldUser]))
    const sending = isNew
      ? state.sendMessageToNewThread(prompt, '/tmp/project', [], [], files)
      : state.sendMessageToSelectedThread(prompt, [], [], 'steer', files)
    await vi.advanceTimersByTimeAsync(0)
    const optimistic = state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic')
    expect(optimistic).toHaveLength(1)
    expect(optimistic[0]).toMatchObject({ text: prompt, fileAttachments: files })
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
    expect(gateway.startThreadTurn.mock.calls[0]?.[6]).toEqual(files)
    started.resolve('turn-2')
    await sending
    await vi.advanceTimersByTimeAsync(0)
    expectConfirmedAttachment(state, isNew ? [persisted] : [oldUser, persisted])
    expect(state.messages.value.find((message) => message.id === persisted.id)?.fileAttachments)
      .toEqual(files.map(({ label, path }) => ({ label, path })))
    // A repeated notification/history snapshot must remain idempotent.
    await state.loadMessages(thread.id, { force: true, silent: true })
    expectConfirmedAttachment(state, isNew ? [persisted] : [oldUser, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('keeps separate submissions with the same filename (different path: %s)', async (differentPath) => {
    const first = { ...attachmentUser(), id: 'user-1', turnId: 'turn-1', turnIndex: 0 }
    const previous = { ...oldDetail, messages: [first] }
    gateway.resumeThread.mockResolvedValue(previous)
    gateway.getThreadDetail.mockResolvedValue(previous)
    const state = await loadState()
    const files = [{ ...pastedFile, ...(differentPath ? {
      path: '/api/uploads/second/pasted-text-2026-11-04-12-00-00.txt',
      fsPath: '/tmp/codex-web-uploads/second/pasted-text-2026-11-04-12-00-00.txt',
    } : {}) }]
    await state.sendMessageToSelectedThread('', [], [], 'steer', files)
    expect(state.messages.value.filter((message) => message.role === 'user')).toHaveLength(2)
    expect(state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic'))
      .toMatchObject([{ turnId: 'turn-2', fileAttachments: files }])
    const persisted = attachmentUser(files)
    gateway.getThreadDetail.mockResolvedValue(attachmentDetail(persisted, [first]))
    await state.loadMessages(thread.id, { force: true, silent: true })
    expectConfirmedAttachment(state, [first, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it('retains an accepted attachment through stale reads until completion provides its persisted row', async () => {
    const state = await loadState()
    gateway.getThreadDetail.mockResolvedValue(oldDetail)
    await state.sendMessageToSelectedThread('', [], [], 'steer', [pastedFile])
    expect(state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic'))
      .toMatchObject([{ text: '', turnId: 'turn-2', fileAttachments: [pastedFile] }])
    const persisted = attachmentUser()
    gateway.getThreadDetail.mockResolvedValue({ ...attachmentDetail(persisted), inProgress: false, activeTurnId: '' })
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expectConfirmedAttachment(state, [oldUser, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it('reconciles history delivered before the turn-start response once its identity is known', async () => {
    const state = await loadState()
    const started = deferred<string>()
    gateway.startThreadTurn.mockReturnValue(started.promise)
    const sending = state.sendMessageToSelectedThread('', [], [], 'steer', [pastedFile])
    await vi.advanceTimersByTimeAsync(0)
    const persisted = attachmentUser()
    gateway.getThreadDetail.mockResolvedValue(attachmentDetail(persisted))
    turnStarted()
    await vi.advanceTimersByTimeAsync(220)
    expect(state.messages.value.some((message) => message.id === persisted.id)).toBe(true)
    started.resolve('turn-2')
    await sending
    expectConfirmedAttachment(state, [oldUser, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it('recovers from a disconnected history read without submitting the attachment again', async () => {
    const state = await loadState()
    gateway.getThreadDetail.mockResolvedValue(oldDetail)
    await state.sendMessageToSelectedThread('', [], [], 'steer', [pastedFile])
    gateway.getThreadDetail.mockRejectedValueOnce(new Error('connection interrupted'))
    await expect(state.loadMessages(thread.id, { force: true })).rejects.toThrow('connection interrupted')
    expect(state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic')).toHaveLength(1)
    const persisted = attachmentUser()
    gateway.getThreadDetail.mockResolvedValue({ ...attachmentDetail(persisted), inProgress: false, activeTurnId: '' })
    turnCompleted()
    await vi.advanceTimersByTimeAsync(220)
    expectConfirmedAttachment(state, [oldUser, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it('retains a failed attachment submission and its error without automatically retrying', async () => {
    const state = await loadState()
    gateway.startThreadTurn.mockRejectedValue(new Error('connection interrupted'))
    await expect(state.sendMessageToSelectedThread('', [], [], 'steer', [pastedFile]))
      .rejects.toThrow('connection interrupted')
    expect(state.messages.value.filter((message) => message.messageType === 'userMessage.optimistic'))
      .toMatchObject([{ text: '', fileAttachments: [pastedFile] }])
    expect(state.selectedLiveOverlay.value?.errorText).toBe('connection interrupted')
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })

  it('restores exactly the same persisted attachments in a fresh state after successful submission', async () => {
    const state = await loadState()
    const persisted = attachmentUser([pastedFile, secondFile], 'Read both files')
    const detail = { ...attachmentDetail(persisted), inProgress: false, activeTurnId: '' }
    gateway.getThreadDetail.mockResolvedValue(detail)
    await state.sendMessageToSelectedThread('Read both files', [], [], 'steer', [pastedFile, secondFile])
    expectConfirmedAttachment(state, [oldUser, persisted])
    gateway.resumeThread.mockResolvedValue(detail)
    const reloaded = createState()
    await reloaded.loadMessages(thread.id)
    expectConfirmedAttachment(reloaded, [oldUser, persisted])
    expect(gateway.startThreadTurn).toHaveBeenCalledTimes(1)
  })
})
