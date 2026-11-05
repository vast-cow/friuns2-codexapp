import { normalizeQueuedGenerationSettings, type QueuedGenerationSettings } from '../queuedGenerationSettings.js'
import { normalizeTelegramCompletionConfig, type TelegramCompletionConfig } from '../telegramCompletionConfig'
import { buildTextWithAttachments } from '../utils/attachmentPrompt.js'
import type { WorkspaceRootsOperation } from '../types/workspaceRoots'
export type { WorkspaceRootsOperation } from '../types/workspaceRoots'
import { ref } from 'vue'
import {
  fetchRpcMethodCatalog,
  fetchPendingServerRequests,
  rpcCall,
  respondServerRequest,
  subscribeRpcNotifications,
  type RpcNotification,
} from './codexRpcClient'
import type {
  CollaborationModeListResponse,
  ConfigReadResponse,
  GetAccountRateLimitsResponse,
  ModelListResponse,
  ReasoningEffort,
  ThreadForkResponse,
  ThreadListResponse,
  ThreadReadResponse,
  ThreadResumeResponse,
  ThreadStartResponse,
  Turn,
} from './appServerDtos'
import { extractErrorMessage, normalizeCodexApiError } from './codexErrors'
import {
  readActiveTurnIdFromResponse,
  normalizeThreadGroupsV2,
  normalizeThreadMessagesV2,
  normalizeThreadSummaryV2,
  readThreadInProgressFromResponse,
} from './normalizers/v2'
import type {
  SpeedMode,
  CollaborationModeKind,
  CollaborationModeOption,
  UiCreditsSnapshot,
  UiFileChange,
  UiMessage,
  UiProjectGroup,
  UiThread,
  UiRateLimitSnapshot,
  UiRateLimitWindow,
} from '../types/codex'
import { normalizePathForUi } from '../pathUtils.js'

type CurrentModelConfig = {
  model: string
  reasoningEffort: ReasoningEffort | ''
  speedMode: SpeedMode
}

export type DirectoryMcpServerStatus = {
  name: string
  authStatus: string
  tools: Array<{ name: string; title: string; description: string }>
  resources: Array<{ name: string; title: string; uri: string; description: string }>
  resourceTemplates: Array<{ name: string; title: string; uriTemplate: string; description: string }>
}

export type DirectoryMcpLoginResult = {
  authorizationUrl: string
}

export type ComposerPromptInfo = {
  name: string
  path: string
  content: string
  description: string
}


export type WorkspaceRootsState = {
  order: string[]
  labels: Record<string, string>
  active: string[]
  projectOrder: string[]
  remoteProjects?: Array<{
    id: string
    hostId: string
    remotePath: string
    label: string
  }>
}

let workspaceRootsGeneration = 0
let workspaceRootsRequestId = 0
let workspaceRootsRequest: { generation: number; id: number; promise: Promise<WorkspaceRootsState> } | null = null
let workspaceRootsMutation: Promise<unknown> = Promise.resolve()
let cachedWorkspaceRootsState: WorkspaceRootsState | null = null

export type StoredQueuedMessage = {
  generationSettings?: QueuedGenerationSettings
  id: string
  text: string
  imageUrls: string[]
  skills: Array<{ name: string; path: string }>
  fileAttachments: Array<{ label: string; path: string; fsPath: string }>
  collaborationMode: CollaborationModeKind
}

export type ThreadQueueState = Record<string, StoredQueuedMessage[]>

export type ComposerFileSuggestion = {
  path: string
}

const DEFAULT_COLLABORATION_MODE_OPTIONS: CollaborationModeOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'plan', label: 'Plan' },
]

export type WorktreeCreateResult = {
  cwd: string
  branch: string | null
  gitRoot: string
}

export type WorktreeBranchOption = {
  value: string
  label: string
  isCurrent?: boolean
  isRemote?: boolean
}

export type GitRepositoryStatus = {
  isGitRepo: boolean
  gitRoot: string
}



export type ThreadSearchResult = {
  threadIds: string[]
  indexedThreadCount: number
}

export type TelegramStatus = {
  notification?: { lastSuccessAt?: number; lastFailureAt?: number; lastError?: string; lastTestAt?: number; lastTestResult?: 'success' | 'failure'; lastTestError?: string; pendingCount: number; retryingCount: number }
  configured: boolean
  active: boolean
  lastError: string
}

export type TelegramConfig = {
  completionNotifications: TelegramCompletionConfig
  botToken: string
}

export type LocalDirectoryEntry = {
  name: string
  path: string
}

export type LocalDirectoryListing = {
  path: string
  parentPath: string
  entries: LocalDirectoryEntry[]
}

type ThreadFileChangeFallbackEntry = {
  turnId: string
  turnIndex: number
  fileChanges: UiFileChange[]
}

type ThreadTurnIndexById = Record<string, number>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeRateLimitWindow(value: unknown): UiRateLimitWindow | null {
  const record = asRecord(value)
  if (!record) return null

  const usedPercent = readNumber(record.usedPercent ?? record.used_percent)
  if (usedPercent === null) return null

  const windowValue = readNumber(record.windowDurationMins ?? record.window_minutes)
  return {
    usedPercent,
    windowDurationMins: windowValue,
    windowMinutes: windowValue,
    resetsAt: readNumber(record.resetsAt ?? record.resets_at),
  }
}

function normalizeCreditsSnapshot(value: unknown): UiCreditsSnapshot | null {
  const record = asRecord(value)
  if (!record) return null

  const hasCredits = readBoolean(record.hasCredits ?? record.has_credits)
  const unlimited = readBoolean(record.unlimited)
  if (hasCredits === null || unlimited === null) return null

  return {
    hasCredits,
    unlimited,
    balance: readString(record.balance),
  }
}

function normalizeRateLimitSnapshot(value: unknown): UiRateLimitSnapshot | null {
  const record = asRecord(value)
  if (!record) return null

  const primary = normalizeRateLimitWindow(record.primary)
  const secondary = normalizeRateLimitWindow(record.secondary)
  const credits = normalizeCreditsSnapshot(record.credits)

  if (!primary && !secondary && !credits) return null

  return {
    limitId: readString(record.limitId ?? record.limit_id),
    limitName: readString(record.limitName ?? record.limit_name),
    primary,
    secondary,
    credits,
    planType: readString(record.planType ?? record.plan_type),
  }
}

export function pickCodexRateLimitSnapshot(payload: unknown): UiRateLimitSnapshot | null {
  const record = asRecord(payload)
  if (!record) return null

  const rateLimitsByLimitId = asRecord(record.rateLimitsByLimitId ?? record.rate_limits_by_limit_id)
  const codexBucket = normalizeRateLimitSnapshot(rateLimitsByLimitId?.codex)
  if (codexBucket) return codexBucket

  return normalizeRateLimitSnapshot(record.rateLimits ?? record.rate_limits)
}

async function callRpc<T>(method: string, params?: unknown): Promise<T> {
  try {
    return await rpcCall<T>(method, params)
  } catch (error) {
    throw normalizeCodexApiError(error, `RPC ${method} failed`, method)
  }
}

function normalizeFallbackFileChange(value: unknown): UiFileChange | null {
  const record = asRecord(value)
  if (!record) return null

  const path = readString(record.path)
  const operation = readString(record.operation)
  if (!path || (operation !== 'add' && operation !== 'delete' && operation !== 'update')) {
    return null
  }

  return {
    path,
    operation,
    movedToPath: readString(record.movedToPath) ?? null,
    diff: readString(record.diff) ?? '',
    addedLineCount: readNumber(record.addedLineCount) ?? 0,
    removedLineCount: readNumber(record.removedLineCount) ?? 0,
  }
}

function normalizeThreadFileChangeFallback(value: unknown): ThreadFileChangeFallbackEntry[] {
  const payload = asRecord(value)
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const normalized: ThreadFileChangeFallbackEntry[] = []

  for (const row of rows) {
    const record = asRecord(row)
    if (!record) continue

    const turnId = readString(record.turnId)
    const turnIndex = readNumber(record.turnIndex)
    const fileChanges = Array.isArray(record.fileChanges)
      ? record.fileChanges
        .map((entry) => normalizeFallbackFileChange(entry))
        .filter((entry): entry is UiFileChange => entry !== null)
      : []

    if (!turnId || turnIndex === null || fileChanges.length === 0) continue
    normalized.push({ turnId, turnIndex, fileChanges })
  }

  return normalized
}

function buildTurnIndexByTurnId(payload: ThreadReadResponse, baseTurnIndex = 0): ThreadTurnIndexById {
  const turns = Array.isArray(payload.thread.turns) ? payload.thread.turns : []
  const lookup: ThreadTurnIndexById = {}

  for (let turnOffset = 0; turnOffset < turns.length; turnOffset += 1) {
    const turnIndex = baseTurnIndex + turnOffset
    const turn = turns[turnOffset]
    if (typeof turn?.id !== 'string' || turn.id.length === 0) continue
    lookup[turn.id] = turnIndex
  }

  return lookup
}

function readThreadTurnStartIndex(payload: ThreadReadResponse): number {
  const record = asRecord(payload)
  const raw = record?.threadTurnStartIndex
  return Math.max(0, Math.floor(typeof raw === 'number' ? raw : 0))
}

async function fetchThreadFileChangeFallback(threadId: string): Promise<ThreadFileChangeFallbackEntry[]> {
  const response = await fetch(`/codex-api/thread-file-change-fallback?threadId=${encodeURIComponent(threadId)}`)
  if (!response.ok) {
    throw new Error(`Fallback request failed with ${response.status}`)
  }
  return normalizeThreadFileChangeFallback(await response.json())
}

function mergeRecoveredFileChangeMessages(messages: UiMessage[], fallbackEntries: ThreadFileChangeFallbackEntry[]): UiMessage[] {
  if (fallbackEntries.length === 0) return messages

  const localTurnIndexByTurnId = new Map<string, number>()
  const coveredTurnIds = new Set<string>()

  for (const message of messages) {
    const tid = typeof message.turnId === 'string' && message.turnId.length > 0 ? message.turnId : undefined
    const tIdx = typeof message.turnIndex === 'number' ? message.turnIndex : undefined
    if (tid && tIdx !== undefined) localTurnIndexByTurnId.set(tid, tIdx)

    const hasFileData =
      message.messageType === 'fileChange' ||
      (Array.isArray(message.fileChanges) && message.fileChanges.length > 0)
    if (hasFileData && tid) coveredTurnIds.add(tid)
  }

  const extraMessages = fallbackEntries
    .filter((entry) => localTurnIndexByTurnId.has(entry.turnId) && !coveredTurnIds.has(entry.turnId))
    .map<UiMessage>((entry) => ({
      id: `session-file-change:${entry.turnId}`,
      role: 'system',
      text: '',
      messageType: 'fileChange',
      fileChangeStatus: 'completed',
      fileChanges: entry.fileChanges,
      turnId: entry.turnId,
      turnIndex: localTurnIndexByTurnId.get(entry.turnId) ?? entry.turnIndex,
    }))

  if (extraMessages.length === 0) return messages

  const extrasByTurnIndex = new Map<number, UiMessage[]>()
  for (const message of extraMessages) {
    const turnIndex = message.turnIndex
    if (typeof turnIndex !== 'number') continue
    const current = extrasByTurnIndex.get(turnIndex)
    if (current) current.push(message)
    else extrasByTurnIndex.set(turnIndex, [message])
  }

  const insertedTurnIndices = new Set<number>()
  const merged: UiMessage[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    merged.push(message)

    const turnIndex = message.turnIndex
    if (typeof turnIndex !== 'number' || insertedTurnIndices.has(turnIndex)) continue
    const nextTurnIndex = messages[index + 1]?.turnIndex
    if (nextTurnIndex === turnIndex) continue

    const extras = extrasByTurnIndex.get(turnIndex)
    if (!extras || extras.length === 0) continue

    merged.push(...extras)
    insertedTurnIndices.add(turnIndex)
  }

  return merged
}

async function enrichThreadMessagesWithFallback(threadId: string, messages: UiMessage[]): Promise<UiMessage[]> {
  try {
    const fallbackEntries = await fetchThreadFileChangeFallback(threadId)
    return mergeRecoveredFileChangeMessages(messages, fallbackEntries)
  } catch {
    return messages
  }
}

function normalizeReasoningEffort(value: unknown): ReasoningEffort | '' {
  return typeof value === 'string' ? value.trim() as ReasoningEffort | '' : ''
}

function normalizeSpeedMode(value: unknown): SpeedMode {
  return typeof value === 'string' && value.trim().toLowerCase() === 'fast'
    ? 'fast'
    : 'standard'
}

const INITIAL_THREAD_LIST_LIMIT = 50
const BACKGROUND_THREAD_LIST_LIMIT = 100

export type ThreadGroupsPage = {
  groups: UiProjectGroup[]
  nextCursor: string | null
}

export type ThreadTurnPage = {
  messages: UiMessage[]
  inProgress: boolean
  activeTurnId: string
  hasMoreOlder: boolean
  startTurnIndex: number
  turnIndexByTurnId: ThreadTurnIndexById
}

async function getThreadGroupsPageV2(cursor: string | null, limit: number): Promise<ThreadGroupsPage> {
  const payload = await callRpc<ThreadListResponse>('thread/list', {
    archived: false,
    limit,
    sortKey: 'updated_at',
    modelProviders: [],
    cursor,
  })
  return {
    groups: normalizeThreadGroupsV2(payload),
    nextCursor: typeof payload.nextCursor === 'string' && payload.nextCursor.length > 0
      ? payload.nextCursor
      : null,
  }
}

async function getThreadSummaryV2(threadId: string): Promise<UiThread> {
  const payload = await callRpc<ThreadReadResponse>('thread/read', {
    threadId,
    includeTurns: false,
  })
  return normalizeThreadSummaryV2(payload)
}

async function getThreadDetailV2(threadId: string): Promise<{
  model: string
  modelProvider: string
  messages: UiMessage[]
  inProgress: boolean
  activeTurnId: string
  hasMoreOlder: boolean
  turnIndexByTurnId: ThreadTurnIndexById
}> {
  const payload = await callRpc<ThreadReadResponse>('thread/read', {
    threadId,
    includeTurns: true,
  })
  const startTurnIndex = readThreadTurnStartIndex(payload)
  const normalized = normalizeThreadMessagesV2(payload, startTurnIndex)
  return {
    model: normalizeThreadModelFromPayload(payload),
    modelProvider: normalizeThreadModelProviderFromPayload(payload),
    messages: normalized,
    inProgress: readThreadInProgressFromResponse(payload),
    activeTurnId: readActiveTurnIdFromResponse(payload),
    hasMoreOlder: startTurnIndex > 0,
    turnIndexByTurnId: buildTurnIndexByTurnId(payload, startTurnIndex),
  }
}

async function getOlderThreadMessagesV2(threadId: string, beforeTurnId: string, limit = 10): Promise<ThreadTurnPage> {
  const params = new URLSearchParams({
    threadId,
    beforeTurnId,
    limit: String(limit),
  })
  const response = await fetch(`/codex-api/thread-turn-page?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Older thread page request failed with ${response.status}`)
  }
  const payload = await response.json() as {
    result?: ThreadReadResponse
    hasMoreOlder?: unknown
    startTurnIndex?: unknown
  }
  if (!payload.result) {
    throw new Error('Older thread page response did not include a thread result')
  }
  const startTurnIndex = Math.max(0, Math.floor(typeof payload.startTurnIndex === 'number' ? payload.startTurnIndex : 0))

  return {
    messages: normalizeThreadMessagesV2(payload.result, startTurnIndex),
    inProgress: readThreadInProgressFromResponse(payload.result),
    activeTurnId: readActiveTurnIdFromResponse(payload.result),
    hasMoreOlder: payload.hasMoreOlder === true,
    startTurnIndex,
    turnIndexByTurnId: buildTurnIndexByTurnId(payload.result, startTurnIndex),
  }
}

export async function getThreadGroupsPage(
  cursor: string | null = null,
  limit = INITIAL_THREAD_LIST_LIMIT,
): Promise<ThreadGroupsPage> {
  try {
    return await getThreadGroupsPageV2(cursor, limit)
  } catch (error) {
    throw normalizeCodexApiError(error, 'Failed to load thread groups', 'thread/list')
  }
}

export function getBackgroundThreadListLimit(): number {
  return BACKGROUND_THREAD_LIST_LIMIT
}

export async function getThreadSummary(threadId: string): Promise<UiThread> {
  try {
    return await getThreadSummaryV2(threadId)
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to load thread ${threadId}`, 'thread/read')
  }
}

export async function getThreadDetail(threadId: string): Promise<{
  model: string
  modelProvider: string
  messages: UiMessage[]
  inProgress: boolean
  activeTurnId: string
  hasMoreOlder: boolean
  turnIndexByTurnId: ThreadTurnIndexById
}> {
  try {
    return await getThreadDetailV2(threadId)
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to load thread ${threadId}`, 'thread/read')
  }
}

export async function getOlderThreadMessages(threadId: string, beforeTurnId: string, limit?: number): Promise<ThreadTurnPage> {
  try {
    return await getOlderThreadMessagesV2(threadId, beforeTurnId, limit)
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to load earlier messages for thread ${threadId}`, 'thread/read')
  }
}

export async function getMethodCatalog(): Promise<string[]> {
  return fetchRpcMethodCatalog()
}

export function subscribeCodexNotifications(onNotification: (value: RpcNotification) => void): () => void {
  return subscribeRpcNotifications(onNotification)
}

export type { RpcNotification }

export async function replyToServerRequest(
  id: number,
  payload: { result?: unknown; error?: { code?: number; message: string } },
): Promise<void> {
  await respondServerRequest({
    id,
    ...payload,
  })
}

export async function getPendingServerRequests(): Promise<unknown[]> {
  return fetchPendingServerRequests()
}

export async function getAccountRateLimits(): Promise<UiRateLimitSnapshot | null> {
  try {
    const payload = await callRpc<unknown>('account/rateLimits/read')
    return pickCodexRateLimitSnapshot(payload)
  } catch (error) {
    throw normalizeCodexApiError(error, 'Failed to load account rate limits', 'account/rateLimits/read')
  }
}

export async function startCodexLogin(): Promise<string> {
  const response = await fetch('/codex-api/accounts/login/start', {
    method: 'POST',
  })
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error(getErrorMessageFromPayload(payload, 'Failed to start Codex login'))
  }
  const envelope = asRecord(payload)
  const data = asRecord(envelope?.data)
  const loginUrl = readString(data?.loginUrl)
  if (!loginUrl) {
    throw new Error('Failed to start Codex login')
  }
  return loginUrl
}

export async function completeCodexLogin(callbackUrl: string): Promise<void> {
  const response = await fetch('/codex-api/accounts/login/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callbackUrl }),
  })
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error(getErrorMessageFromPayload(payload, 'Failed to complete Codex login'))
  }
}

export type ResumedThread = {
  model: string
  modelProvider: string
  messages: UiMessage[]
  inProgress: boolean
  activeTurnId: string
  hasMoreOlder: boolean
  turnIndexByTurnId: ThreadTurnIndexById
}

const RESUME_THREAD_COALESCE_TTL_MS = 30_000
const recentResumeThreadById = new Map<string, Promise<ResumedThread>>()

export async function resumeThread(threadId: string): Promise<ResumedThread> {
  const existing = recentResumeThreadById.get(threadId)
  if (existing) return existing

  const promise = (async () => {
    const payload = await callRpc<ThreadResumeResponse>('thread/resume', { threadId })
    const startTurnIndex = readThreadTurnStartIndex(payload)
    const messages = normalizeThreadMessagesV2(payload, startTurnIndex)
    return {
      model: normalizeThreadModelFromPayload(payload),
      modelProvider: normalizeThreadModelProviderFromPayload(payload),
      messages,
      inProgress: readThreadInProgressFromResponse(payload),
      activeTurnId: readActiveTurnIdFromResponse(payload),
      hasMoreOlder: startTurnIndex > 0,
      turnIndexByTurnId: buildTurnIndexByTurnId(payload, startTurnIndex),
    }
  })()

  recentResumeThreadById.set(threadId, promise)
  const hardEvictionTimer = globalThis.setTimeout(() => {
    if (recentResumeThreadById.get(threadId) === promise) {
      recentResumeThreadById.delete(threadId)
    }
  }, RESUME_THREAD_COALESCE_TTL_MS)
  void promise.finally(() => {
    globalThis.clearTimeout(hardEvictionTimer)
    globalThis.setTimeout(() => {
      if (recentResumeThreadById.get(threadId) === promise) {
        recentResumeThreadById.delete(threadId)
      }
    }, 2000)
  }).catch(() => undefined)
  return promise
}

export async function archiveThread(threadId: string): Promise<void> {
  await callRpc('thread/archive', { threadId })
}

export async function renameThread(threadId: string, threadName: string): Promise<void> {
  await callRpc('thread/name/set', { threadId, name: threadName })
}

export async function rollbackThread(threadId: string, numTurns: number): Promise<UiMessage[]> {
  const payload = await callRpc<ThreadReadResponse>('thread/rollback', { threadId, numTurns })
  return normalizeThreadMessagesV2(payload, readThreadTurnStartIndex(payload))
}

export async function updateThreadFileChanges(
  threadId: string,
  turnId: string,
  cwd: string,
  action: 'undo' | 'redo',
  patchIds?: string[],
  scope?: 'single_turn' | 'turn_and_later',
): Promise<{ changed: number; errors: string[]; message?: string; revertedPatchIds?: string[]; appliedPatchIds?: string[] }> {
  try {
    const response = await fetch('/codex-api/thread/rollback-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, turnId, cwd, action, patchIds, scope }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      changed?: number
      reverted?: number
      applied?: number
      errors?: string[]
      message?: string
      error?: string
      revertedPatchIds?: string[]
      appliedPatchIds?: string[]
    }
    if (!response.ok) {
      const message = typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : typeof payload.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Server error'
      return {
        changed: 0,
        errors: Array.isArray(payload.errors) && payload.errors.length > 0 ? payload.errors : [message],
        message: payload.message,
      }
    }
    return {
      changed: payload.changed ?? payload.reverted ?? payload.applied ?? 0,
      errors: Array.isArray(payload.errors) ? payload.errors : [],
      message: payload.message,
      revertedPatchIds: Array.isArray(payload.revertedPatchIds) ? payload.revertedPatchIds : [],
      appliedPatchIds: Array.isArray(payload.appliedPatchIds) ? payload.appliedPatchIds : [],
    }
  } catch (error) {
    return { changed: 0, errors: [error instanceof Error ? error.message : 'Network error'] }
  }
}

export async function revertThreadFileChanges(threadId: string, turnId: string, cwd: string): Promise<{ reverted: number; errors: string[] }> {
  const result = await updateThreadFileChanges(threadId, turnId, cwd, 'undo')
  return { reverted: result.changed, errors: result.errors }
}

function normalizeThreadIdFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>

  const thread = record.thread
  if (thread && typeof thread === 'object') {
    const threadId = (thread as Record<string, unknown>).id
    if (typeof threadId === 'string' && threadId.length > 0) {
      return threadId
    }
  }
  return ''
}

function normalizeThreadCwdFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>

  const thread = record.thread
  if (thread && typeof thread === 'object') {
    const cwd = (thread as Record<string, unknown>).cwd
    if (typeof cwd === 'string' && cwd.length > 0) {
      return cwd
    }
  }
  return ''
}

function normalizeThreadModelFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const model = (payload as Record<string, unknown>).model
  return typeof model === 'string' ? model.trim() : ''
}

function normalizeThreadModelProviderFromPayload(payload: unknown): string {
  const record = asRecord(payload)
  if (!record) return ''
  const modelProvider = readString(record.modelProvider)?.trim() ?? ''
  if (modelProvider) return modelProvider
  const thread = asRecord(record.thread)
  return readString(thread?.modelProvider)?.trim() ?? ''
}

export type StartedThread = {
  threadId: string
  model: string
  modelProvider: string
}

export type ForkedThread = {
  threadId: string
  cwd: string
  model: string
  messages: UiMessage[]
}

export async function startThread(cwd?: string, model?: string): Promise<StartedThread> {
  try {
    const params: Record<string, unknown> = {}
    if (typeof cwd === 'string' && cwd.trim().length > 0) {
      params.cwd = cwd.trim()
    }
    if (typeof model === 'string' && model.trim().length > 0) {
      params.model = model.trim()
    }
    const payload = await callRpc<ThreadStartResponse>('thread/start', params)
    const threadId = normalizeThreadIdFromPayload(payload)
    if (!threadId) {
      throw new Error('thread/start did not return a thread id')
    }
    return {
      threadId,
      model: normalizeThreadModelFromPayload(payload),
      modelProvider: normalizeThreadModelProviderFromPayload(payload),
    }
  } catch (error) {
    throw normalizeCodexApiError(error, 'Failed to start a new thread', 'thread/start')
  }
}

export async function forkThread(threadId: string): Promise<ForkedThread>
export async function forkThread(threadId: string, cwd: string | undefined, model: string | undefined): Promise<StartedThread>
export async function forkThread(
  threadId: string,
  cwd?: string,
  model?: string,
): Promise<StartedThread | ForkedThread> {
  if (arguments.length <= 1) {
    try {
      const payload = await callRpc<ThreadForkResponse & ThreadReadResponse & { thread?: { id?: string; cwd?: string } }>('thread/fork', {
        threadId,
        persistExtendedHistory: true,
      })
      const forkedThreadId = normalizeThreadIdFromPayload(payload)
      if (!forkedThreadId) {
        throw new Error('thread/fork did not return a thread id')
      }
      return {
        threadId: forkedThreadId,
        cwd: normalizeThreadCwdFromPayload(payload),
        model: normalizeThreadModelFromPayload(payload),
        messages: normalizeThreadMessagesV2(payload, readThreadTurnStartIndex(payload)),
      }
    } catch (error) {
      throw normalizeCodexApiError(error, `Failed to fork thread ${threadId}`, 'thread/fork')
    }
  }

  try {
    const normalizedThreadId = threadId.trim()
    if (!normalizedThreadId) {
      throw new Error('thread/fork requires threadId')
    }
    const params: Record<string, unknown> = {
      threadId: normalizedThreadId,
    }
    if (typeof cwd === 'string' && cwd.trim().length > 0) {
      params.cwd = cwd.trim()
    }
    if (typeof model === 'string' && model.trim().length > 0) {
      params.model = model.trim()
    }
    const payload = await callRpc<ThreadForkResponse>('thread/fork', params)
    const nextThreadId = normalizeThreadIdFromPayload(payload)
    if (!nextThreadId) {
      throw new Error('thread/fork did not return a thread id')
    }
    return {
      threadId: nextThreadId,
      model: normalizeThreadModelFromPayload(payload),
      modelProvider: normalizeThreadModelProviderFromPayload(payload),
    }
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to fork thread ${threadId}`, 'thread/fork')
  }
}

export type FileAttachmentParam = { label: string; path: string; fsPath: string }

function extractLocalImagePathFromUrl(value: string): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value, 'http://localhost')
    if (parsed.pathname !== '/codex-local-image') return null
    const path = parsed.searchParams.get('path')?.trim() ?? ''
    return path.length > 0 ? path : null
  } catch {
    return null
  }
}

function fileNameFromPath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? normalized
}

async function resolveCollaborationModeModel(mode: CollaborationModeKind, model?: string): Promise<string> {
  if (model?.trim()) return model.trim()
  try {
    const config = await getCurrentModelConfig()
    if (config.model.trim()) return config.model.trim()
  } catch {}
  try {
    const catalog = await getAvailableModelIds()
    if (catalog.ids.length) return catalog.ids[0]!
  } catch {}
  throw new Error(`${mode === 'plan' ? 'Plan' : 'Default'} mode requires an available model. Wait for models to load and try again.`)
}

export async function startThreadTurn(
  threadId: string,
  text: string,
  imageUrls: string[] = [],
  model?: string,
  effort?: ReasoningEffort,
  skills?: Array<{ name: string; path: string }>,
  fileAttachments: FileAttachmentParam[] = [],
  collaborationMode?: CollaborationModeKind,
  preserveExplicitSettings = false,
): Promise<string> {
  try {
    const normalizedModel = model?.trim() ?? ''
    const localImageAttachments: FileAttachmentParam[] = []
    for (const imageUrl of imageUrls) {
      const localImagePath = extractLocalImagePathFromUrl(imageUrl.trim())
      if (!localImagePath) continue
      localImageAttachments.push({
        label: fileNameFromPath(localImagePath),
        path: localImagePath,
        fsPath: localImagePath,
      })
    }
    const allFileAttachments = [...fileAttachments, ...localImageAttachments]
    const dedupedFileAttachments = allFileAttachments.filter((entry, index) =>
      allFileAttachments.findIndex((candidate) => candidate.fsPath === entry.fsPath) === index)
    const finalText = buildTextWithAttachments(text, dedupedFileAttachments)
    const input: Array<Record<string, unknown>> = [{ type: 'text', text: finalText }]
    for (const imageUrl of imageUrls) {
      const normalizedUrl = imageUrl.trim()
      if (!normalizedUrl) continue
      const localImagePath = extractLocalImagePathFromUrl(normalizedUrl)
      if (localImagePath) {
        input.push({
          type: 'localImage',
          path: localImagePath,
        })
        continue
      }
      input.push({
        type: 'image',
        url: normalizedUrl,
        image_url: normalizedUrl,
      })
    }
    if (skills) {
      for (const skill of skills) {
        input.push({ type: 'skill', name: skill.name, path: skill.path })
      }
    }
    const attachments = dedupedFileAttachments.map((f) => ({ label: f.label, path: f.path, fsPath: f.fsPath }))
    const params: Record<string, unknown> = {
      threadId,
      input,
    }
    if (attachments.length > 0) params.attachments = attachments
    const resolvedModel = collaborationMode ? await resolveCollaborationModeModel(collaborationMode, normalizedModel) : normalizedModel
    const reasoningModel = findReasoningModel(resolvedModel)
    const resolvedEffort = preserveExplicitSettings && (!Array.isArray(reasoningModel?.supportedReasoningEfforts) || !effort)
      ? effort ?? ''
      : resolveReasoningEffort(reasoningModel, effort)
    if (resolvedModel) params.model = resolvedModel
    if (resolvedEffort) params.effort = resolvedEffort
    if (collaborationMode) {
      params.collaborationMode = {
        mode: collaborationMode,
        settings: {
          model: resolvedModel,
          reasoning_effort: resolvedEffort || null,
          developer_instructions: null,
        },
      }
    }
    const payload = await callRpc<{ turn?: Turn }>('turn/start', params)
    return typeof payload?.turn?.id === 'string' ? payload.turn.id.trim() : ''
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to start turn for thread ${threadId}`, 'turn/start')
  }
}

export async function interruptThreadTurn(threadId: string, turnId?: string): Promise<void> {
  const normalizedThreadId = threadId.trim()
  const normalizedTurnId = turnId?.trim() || ''
  if (!normalizedThreadId) return

  try {
    if (!normalizedTurnId) {
      throw new Error('turn/interrupt requires turnId')
    }
    await callRpc('turn/interrupt', { threadId: normalizedThreadId, turnId: normalizedTurnId })
  } catch (error) {
    throw normalizeCodexApiError(error, `Failed to interrupt turn for thread ${normalizedThreadId}`, 'turn/interrupt')
  }
}

export async function setDefaultModel(model: string): Promise<void> {
  await callRpc('setDefaultModel', { model })
}

export async function setCodexSpeedMode(mode: SpeedMode): Promise<void> {
  const normalizedMode: SpeedMode = mode === 'fast' ? 'fast' : 'standard'
  await callRpc('config/batchWrite', {
    edits: [
      {
        keyPath: 'features.fast_mode',
        value: true,
        mergeStrategy: 'upsert',
      },
      {
        keyPath: 'service_tier',
        value: normalizedMode === 'fast' ? 'fast' : null,
        mergeStrategy: normalizedMode === 'fast' ? 'upsert' : 'replace',
      },
    ],
    filePath: null,
    expectedVersion: null,
  })
}

export type ReasoningModel = {
  id?: string
  model?: string
  supportedReasoningEfforts?: Array<string | { reasoningEffort: string; description?: string }>
  defaultReasoningEffort?: string
}

// Model capabilities come exclusively from the running Codex app-server.
export const reasoningCatalog = ref<ReasoningModel[]>([])

export function reasoningOptions(model: ReasoningModel | null): Array<{ value: ReasoningEffort; label: string; description: string }> {
  const options: Array<{ value: ReasoningEffort; label: string; description: string }> = []
  if (!Array.isArray(model?.supportedReasoningEfforts)) return options
  for (const entry of model.supportedReasoningEfforts) {
    const value = normalizeReasoningEffort(typeof entry === 'string' ? entry : entry?.reasoningEffort)
    if (!value || options.some((option) => option.value === value)) continue
    options.push({ value, label: value === 'xhigh' ? 'Extra high' : value.charAt(0).toUpperCase() + value.slice(1),
      description: typeof entry === 'object' && typeof entry?.description === 'string' ? entry.description : '' })
  }
  return options
}

export function resolveReasoningEffort(model: ReasoningModel | null, requested?: string): ReasoningEffort | '' {
  const options = reasoningOptions(model)
  const selected = options.find((option) => option.value === requested)
  if (selected) return selected.value
  return options.find((option) => option.value === model?.defaultReasoningEffort)?.value ?? options[0]?.value ?? ''
}

export function findReasoningModel(model: string): ReasoningModel | null {
  return reasoningCatalog.value.find((entry) => entry.id === model || entry.model === model) ?? null
}

export async function getAvailableModelIds(): Promise<{ ids: string[]; models: ReasoningModel[] }> {
  const models: ReasoningModel[] = []
  try {
    let cursor: string | undefined
    const seen = new Set<string>()
    do {
      const page = await callRpc<ModelListResponse>('model/list', cursor ? { cursor } : {})
      if (Array.isArray(page?.data)) {
        for (const model of page.data) {
          if (model && typeof model === 'object' && (
            (typeof model.id === 'string' && model.id.trim())
            || (typeof model.model === 'string' && model.model.trim())
          )) models.push(model)
        }
      }
      cursor = page?.nextCursor?.trim() || undefined
      if (!cursor || seen.has(cursor)) break
      seen.add(cursor)
    } while (cursor)
  } catch {
    models.length = 0
  }

  return { ids: [...new Set(models.map((model) => model.id?.trim() || model.model?.trim() || '').filter(Boolean))], models }
}

export async function getCurrentModelConfig(): Promise<CurrentModelConfig> {
  const payload = await callRpc<ConfigReadResponse>('config/read', {})
  const model = payload.config.model ?? ''
  const reasoningEffort = normalizeReasoningEffort(payload.config.model_reasoning_effort)
  const speedMode = normalizeSpeedMode(payload.config.service_tier)
  return { model, reasoningEffort, speedMode }
}

function normalizeDirectoryMcpServer(value: unknown): DirectoryMcpServerStatus | null {
  const record = asRecord(value)
  if (!record) return null
  const name = readString(record.name)
  if (!name) return null
  const toolsRecord = asRecord(record.tools) ?? {}
  const tools = Object.entries(toolsRecord).map(([fallbackName, raw]) => {
    const tool = asRecord(raw)
    return {
      name: readString(tool?.name) ?? fallbackName,
      title: readString(tool?.title) ?? '',
      description: readString(tool?.description) ?? '',
    }
  })
  const resources = Array.isArray(record.resources)
    ? record.resources.map((raw) => {
      const resource = asRecord(raw)
      return {
        name: readString(resource?.name) ?? '',
        title: readString(resource?.title) ?? '',
        uri: readString(resource?.uri) ?? '',
        description: readString(resource?.description) ?? '',
      }
    }).filter((resource) => resource.name || resource.uri)
    : []
  const rawResourceTemplates = record.resourceTemplates ?? record.resource_templates
  const resourceTemplates = Array.isArray(rawResourceTemplates)
    ? rawResourceTemplates.map((raw: unknown) => {
      const template = asRecord(raw)
      return {
        name: readString(template?.name) ?? '',
        title: readString(template?.title) ?? '',
        uriTemplate: readString(template?.uriTemplate ?? template?.uri_template) ?? '',
        description: readString(template?.description) ?? '',
      }
    }).filter((template) => template.name || template.uriTemplate)
    : []

  return {
    name,
    authStatus: readString(record.authStatus ?? record.auth_status) ?? 'unsupported',
    tools,
    resources,
    resourceTemplates,
  }
}

export async function listDirectoryMcpServers(): Promise<DirectoryMcpServerStatus[]> {
  const servers: DirectoryMcpServerStatus[] = []
  let cursor: string | null = null
  do {
    const params: Record<string, unknown> = {}
    if (cursor) params.cursor = cursor
    const payload = await callRpc<{ data?: unknown[]; nextCursor?: string | null; next_cursor?: string | null }>('mcpServerStatus/list', params)
    for (const item of payload.data ?? []) {
      const server = normalizeDirectoryMcpServer(item)
      if (server) servers.push(server)
    }
    cursor = readString(payload.nextCursor ?? payload.next_cursor)
  } while (cursor)
  return servers
}

export async function reloadDirectoryMcpServers(): Promise<void> {
  await callRpc('config/mcpServer/reload', {})
}

export async function startDirectoryMcpLogin(name: string): Promise<DirectoryMcpLoginResult> {
  const payload = await callRpc<{ authorizationUrl?: string; authorization_url?: string }>('mcpServer/oauth/login', { name })
  return {
    authorizationUrl: readString(payload.authorizationUrl ?? payload.authorization_url) ?? '',
  }
}

export async function getAccountRateLimitsResponse(): Promise<GetAccountRateLimitsResponse> {
  return await callRpc<GetAccountRateLimitsResponse>('account/rateLimits/read')
}

function normalizeCollaborationModeLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (segment) => segment.toUpperCase())
}

export async function getAvailableCollaborationModes(): Promise<CollaborationModeOption[]> {
  try {
    const payload = await callRpc<CollaborationModeListResponse>('collaborationMode/list', {})
    const seen = new Set<CollaborationModeKind>()
    const normalized: CollaborationModeOption[] = []

    for (const row of payload.data) {
      const mode = row.mode
      if (mode !== 'default' && mode !== 'plan') continue
      if (seen.has(mode)) continue
      seen.add(mode)
      normalized.push({
        value: mode,
        label: normalizeCollaborationModeLabel(row.name || mode) || (mode === 'plan' ? 'Plan' : 'Default'),
      })
    }

    if (normalized.length > 0) {
      for (const fallback of DEFAULT_COLLABORATION_MODE_OPTIONS) {
        if (!seen.has(fallback.value)) {
          normalized.push(fallback)
        }
      }
      return normalized.sort((first, second) => (
        first.value === second.value ? 0 : first.value === 'default' ? -1 : 1
      ))
    }
  } catch {
    // Fall back to static options when the app-server does not expose presets.
  }

  return DEFAULT_COLLABORATION_MODE_OPTIONS
}

function normalizeWorkspaceRootsState(payload: unknown): WorkspaceRootsState {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}

  const normalizeArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    const next: string[] = []
    for (const item of value) {
      if (typeof item === 'string' && item.length > 0 && !next.includes(item)) {
        next.push(item)
      }
    }
    return next
  }

  const labelsRaw = record.labels
  const labels: Record<string, string> = {}
  if (labelsRaw && typeof labelsRaw === 'object' && !Array.isArray(labelsRaw)) {
    for (const [key, value] of Object.entries(labelsRaw as Record<string, unknown>)) {
      const normalizedKey = typeof key === 'string' ? normalizePathForUi(key) : ''
      if (normalizedKey.length > 0 && typeof value === 'string') {
        labels[normalizedKey] = value
      }
    }
  }

  return {
    order: normalizeArray(record.order).map((value) => normalizePathForUi(value)),
    labels,
    active: normalizeArray(record.active).map((value) => normalizePathForUi(value)),
    projectOrder: normalizeArray(record.projectOrder).map((value) => normalizePathForUi(value)),
    remoteProjects: Array.isArray(record.remoteProjects)
      ? record.remoteProjects.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return []
        const remote = item as Record<string, unknown>
        const id = typeof remote.id === 'string' ? remote.id.trim() : ''
        if (!id) return []
        return [{
          id,
          hostId: typeof remote.hostId === 'string' ? remote.hostId.trim() : '',
          remotePath: typeof remote.remotePath === 'string' ? normalizePathForUi(remote.remotePath) : '',
          label: typeof remote.label === 'string' ? remote.label.trim() : '',
        }]
      })
      : [],
  }
}

function normalizeStoredQueuedMessage(value: unknown): StoredQueuedMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  if (!id) return null

  const imageUrls = Array.isArray(record.imageUrls)
    ? record.imageUrls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const skills = Array.isArray(record.skills)
    ? record.skills.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const itemRecord = item as Record<string, unknown>
      const name = typeof itemRecord.name === 'string' ? itemRecord.name.trim() : ''
      const path = typeof itemRecord.path === 'string' ? itemRecord.path.trim() : ''
      return name && path ? [{ name, path }] : []
    })
    : []
  const fileAttachments = Array.isArray(record.fileAttachments)
    ? record.fileAttachments.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const itemRecord = item as Record<string, unknown>
      const label = typeof itemRecord.label === 'string' ? itemRecord.label.trim() : ''
      const path = typeof itemRecord.path === 'string' ? itemRecord.path.trim() : ''
      const fsPath = typeof itemRecord.fsPath === 'string' ? itemRecord.fsPath.trim() : ''
      return label && path && fsPath ? [{ label, path, fsPath }] : []
    })
    : []

  const generationSettings = normalizeQueuedGenerationSettings(record.generationSettings)

  return {
    id,
    text: typeof record.text === 'string' ? record.text : '',
    imageUrls,
    skills,
    fileAttachments,
    collaborationMode: record.collaborationMode === 'plan' ? 'plan' : 'default',
    ...(generationSettings ? { generationSettings } : {}),
  }
}

function normalizeThreadQueueState(value: unknown): ThreadQueueState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const state: ThreadQueueState = {}
  for (const [threadId, rawMessages] of Object.entries(value as Record<string, unknown>)) {
    const normalizedThreadId = threadId.trim()
    if (!normalizedThreadId || !Array.isArray(rawMessages)) continue
    const messages = rawMessages.flatMap((item) => {
      const message = normalizeStoredQueuedMessage(item)
      return message ? [message] : []
    })
    if (messages.length > 0) {
      state[normalizedThreadId] = messages
    }
  }
  return state
}

export async function getWorkspaceRootsState(): Promise<WorkspaceRootsState> {
  await workspaceRootsMutation
  if (cachedWorkspaceRootsState) return cloneWorkspaceRootsState(cachedWorkspaceRootsState)
  if (!workspaceRootsRequest) {
    const generation = workspaceRootsGeneration
    const id = ++workspaceRootsRequestId
    const promise = fetchWorkspaceRootsState()
      .then((state) => {
        if (generation !== workspaceRootsGeneration) return getWorkspaceRootsState()
        cachedWorkspaceRootsState = state
        return state
      })
      .catch((error: unknown) => {
        if (generation !== workspaceRootsGeneration) return getWorkspaceRootsState()
        throw error
      })
      .finally(() => {
        if (workspaceRootsRequest?.id === id) workspaceRootsRequest = null
      })
    workspaceRootsRequest = { generation, id, promise }
  }
  const request = workspaceRootsRequest
  const state = await request.promise
  // Invalidation can also happen between promise resolution and this continuation.
  if (request.generation !== workspaceRootsGeneration) return getWorkspaceRootsState()
  return cloneWorkspaceRootsState(state)
}

async function fetchWorkspaceRootsState(): Promise<WorkspaceRootsState> {
  const response = await fetch('/codex-api/workspace-roots-state')
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error('Failed to load workspace roots state')
  }
  const envelope =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  return normalizeWorkspaceRootsState(envelope.data)
}

function cloneWorkspaceRootsState(state: WorkspaceRootsState): WorkspaceRootsState {
  return {
    order: [...state.order],
    labels: { ...state.labels },
    active: [...state.active],
    projectOrder: [...state.projectOrder],
    remoteProjects: state.remoteProjects?.map((item) => ({ ...item })) ?? [],
  }
}

export function getWorkspaceRootsStateGeneration(): number {
  return workspaceRootsGeneration
}

export function invalidateWorkspaceRootsStateCache(): void {
  workspaceRootsGeneration += 1
  cachedWorkspaceRootsState = null
  workspaceRootsRequest = null
}

function queueWorkspaceRootsMutation<T>(
  mutation: () => Promise<T>,
  stateFromResult?: (result: T) => WorkspaceRootsState,
): Promise<T> {
  const run = workspaceRootsMutation.catch(() => undefined).then(async () => {
    invalidateWorkspaceRootsStateCache()
    try {
      const result = await mutation()
      invalidateWorkspaceRootsStateCache()
      if (stateFromResult) cachedWorkspaceRootsState = cloneWorkspaceRootsState(stateFromResult(result))
      return result
    } catch (error) {
      invalidateWorkspaceRootsStateCache()
      throw error
    }
  })
  workspaceRootsMutation = run.catch(() => undefined)
  return run
}

export async function getThreadQueueState(): Promise<ThreadQueueState> {
  const response = await fetch('/codex-api/thread-queue-state')
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error('Failed to load thread queue state')
  }
  const envelope =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  return normalizeThreadQueueState(envelope.data)
}

export async function setThreadQueueState(nextState: ThreadQueueState): Promise<void> {
  const response = await fetch('/codex-api/thread-queue-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeThreadQueueState(nextState)),
  })
  if (!response.ok) {
    throw new Error('Failed to save thread queue state')
  }
}

export async function createWorktree(sourceCwd: string, baseBranch?: string): Promise<WorktreeCreateResult> {
  const normalizedBaseBranch = (baseBranch ?? '').trim()
  const response = await fetch('/codex-api/worktree/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceCwd,
      baseBranch: normalizedBaseBranch || undefined,
    }),
  })
  const payload = (await response.json()) as { data?: WorktreeCreateResult; error?: string }
  if (!response.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create worktree')
  }
  return {
    ...payload.data,
    cwd: normalizePathForUi(payload.data.cwd),
    gitRoot: normalizePathForUi(payload.data.gitRoot),
  }
}

export async function createPermanentWorktree(sourceCwd: string, worktreeName: string): Promise<WorktreeCreateResult> {
  const response = await fetch('/codex-api/worktree/create-permanent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceCwd,
      worktreeName,
    }),
  })
  const payload = (await response.json()) as { data?: WorktreeCreateResult; error?: string }
  if (!response.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create worktree')
  }
  return {
    ...payload.data,
    cwd: normalizePathForUi(payload.data.cwd),
    gitRoot: normalizePathForUi(payload.data.gitRoot),
  }
}

export async function getWorktreeBranchOptions(sourceCwd: string): Promise<WorktreeBranchOption[]> {
  const normalizedSourceCwd = sourceCwd.trim()
  if (!normalizedSourceCwd) return []
  const query = new URLSearchParams({ sourceCwd: normalizedSourceCwd })
  const response = await fetch(`/codex-api/worktree/branches?${query.toString()}`)
  const payload = (await response.json()) as { data?: unknown; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load branches')
  }
  const rawList = Array.isArray(payload.data) ? payload.data : []
  const options: WorktreeBranchOption[] = []
  const seen = new Set<string>()
  for (const item of rawList) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const value = typeof record.value === 'string' ? record.value.trim() : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if (!value || seen.has(value)) continue
    seen.add(value)
    options.push({
      value,
      label: label || value,
    })
  }
  return options
}

export async function getGitRepositoryStatus(cwd: string): Promise<GitRepositoryStatus> {
  const normalizedCwd = cwd.trim()
  if (!normalizedCwd) {
    return { isGitRepo: false, gitRoot: '' }
  }
  const query = new URLSearchParams({ cwd: normalizedCwd })
  const response = await fetch(`/codex-api/git/repository-status?${query.toString()}`)
  const payload = (await response.json()) as { data?: unknown; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to read Git repository status')
  }
  const record = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? (payload.data as Record<string, unknown>)
    : {}
  return {
    isGitRepo: record.isGitRepo === true,
    gitRoot: typeof record.gitRoot === 'string' ? normalizePathForUi(record.gitRoot) : '',
  }
}

export async function getHomeDirectory(): Promise<string> {
  const response = await fetch('/codex-api/home-directory')
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error('Failed to load home directory')
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  return typeof data.path === 'string' ? data.path.trim() : ''
}

export async function listLocalDirectories(path: string, options?: { showHidden?: boolean }): Promise<LocalDirectoryListing> {
  const query = new URLSearchParams({ path })
  if (options?.showHidden === true) {
    query.set('showHidden', '1')
  }
  const response = await fetch(`/codex-local-directories?${query.toString()}`)
  const payload = await readJsonResponse(response)
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to load local directories')
    throw new Error(message)
  }

  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  const entriesRaw = Array.isArray(data.entries) ? data.entries : []

  return {
    path: typeof data.path === 'string' ? normalizePathForUi(data.path) : '',
    parentPath: typeof data.parentPath === 'string' ? normalizePathForUi(data.parentPath) : '',
    entries: entriesRaw.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const record = item as Record<string, unknown>
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      const entryPath = typeof record.path === 'string' ? normalizePathForUi(record.path) : ''
      return name && entryPath ? [{ name, path: entryPath }] : []
    }),
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const raw = await response.text()
  if (!raw) return {}
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error(`Expected JSON response from ${response.url || 'request'}`)
  }
}

export function updateWorkspaceRootsState(operation: WorkspaceRootsOperation): Promise<WorkspaceRootsState> {
  return queueWorkspaceRootsMutation(() => updateWorkspaceRootsStateRequest(operation), (state) => state)
}

export function openProjectRoot(path: string, options?: { createIfMissing?: boolean; label?: string }): Promise<string> {
  return queueWorkspaceRootsMutation(() => openProjectRootRequest(path, options))
}

export function createLocalDirectory(path: string): Promise<string> {
  return queueWorkspaceRootsMutation(() => createLocalDirectoryRequest(path))
}

export function cloneGithubRepository(url: string, basePath: string): Promise<string> {
  return queueWorkspaceRootsMutation(() => cloneGithubRepositoryRequest(url, basePath))
}

async function updateWorkspaceRootsStateRequest(operation: WorkspaceRootsOperation): Promise<WorkspaceRootsState> {
  const response = await fetch('/codex-api/workspace-roots-state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation),
  })
  const payload = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(getErrorMessageFromPayload(payload, 'Failed to save workspace roots state'))
  }
  const envelope = payload as { data?: unknown }
  const state = normalizeWorkspaceRootsState(envelope.data)
  return cloneWorkspaceRootsState(state)
}

async function openProjectRootRequest(path: string, options?: { createIfMissing?: boolean; label?: string }): Promise<string> {
  const response = await fetch('/codex-api/project-root', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      createIfMissing: options?.createIfMissing === true,
      label: options?.label ?? '',
    }),
  })
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to open project root')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  const normalizedPath = typeof data.path === 'string' ? normalizePathForUi(data.path) : ''
  return normalizedPath
}

async function createLocalDirectoryRequest(path: string): Promise<string> {
  const response = await fetch('/codex-api/local-directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const payload = await readJsonResponse(response)
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to create local directory')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  const normalizedPath = typeof data.path === 'string' ? normalizePathForUi(data.path) : ''
  return normalizedPath
}

async function cloneGithubRepositoryRequest(url: string, basePath: string): Promise<string> {
  const response = await fetch('/codex-api/github-clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, basePath }),
  })
  const payload = await readJsonResponse(response)
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to clone GitHub repository')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  return typeof data.path === 'string' ? normalizePathForUi(data.path) : ''
}

export async function createProjectlessThreadDirectory(prompt?: string): Promise<{ cwd: string; outputDirectory: string; workspaceRoot: string }> {
  const response = await fetch('/codex-api/projectless-thread-cwd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt ?? null }),
  })
  const payload = await readJsonResponse(response)
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to create new chat folder')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  const cwd = typeof data.cwd === 'string' ? normalizePathForUi(data.cwd) : ''
  if (!cwd) {
    throw new Error('Failed to create new chat folder')
  }
  return {
    cwd,
    outputDirectory: typeof data.outputDirectory === 'string' ? normalizePathForUi(data.outputDirectory) : cwd,
    workspaceRoot: typeof data.workspaceRoot === 'string' ? normalizePathForUi(data.workspaceRoot) : '',
  }
}

export async function getProjectRootSuggestion(basePath: string): Promise<{ name: string; path: string }> {
  const query = new URLSearchParams({ basePath })
  const response = await fetch(`/codex-api/project-root-suggestion?${query.toString()}`)
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to suggest project name')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  return {
    name: typeof data.name === 'string' ? data.name.trim() : '',
    path: typeof data.path === 'string' ? normalizePathForUi(data.path) : '',
  }
}

export async function searchComposerFiles(cwd: string, query: string, limit = 20): Promise<ComposerFileSuggestion[]> {
  const trimmedCwd = cwd.trim()
  if (!trimmedCwd) return []
  const response = await fetch('/codex-api/composer-file-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cwd: trimmedCwd,
      query: query.trim(),
      limit,
    }),
  })
  const payload = (await response.json()) as unknown
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to search files')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data = Array.isArray(record.data) ? record.data : []
  const suggestions: ComposerFileSuggestion[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const rawPath = row.path
    const value = typeof rawPath === 'string' ? rawPath.trim() : ''
    if (!value) continue
    suggestions.push({ path: value })
  }
  return suggestions
}

export async function searchThreads(
  query: string,
  limit = 200,
): Promise<ThreadSearchResult> {
  const response = await fetch('/codex-api/thread-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  const payload = (await response.json()) as { data?: ThreadSearchResult; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to search threads')
  }
  return payload.data ?? { threadIds: [], indexedThreadCount: 0 }
}

export async function configureTelegramBot(
  botToken: string,
  completionNotifications?: TelegramCompletionConfig,
): Promise<void> {
  const response = await fetch('/codex-api/telegram/configure-bot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      botToken,
      completionNotifications,
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to connect Telegram bot')
    throw new Error(message)
  }
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const response = await fetch('/codex-api/telegram/config')
  const payload = await response.json()
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to load Telegram configuration')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  return {
    botToken: typeof data.botToken === 'string' ? data.botToken : '',
    completionNotifications: normalizeTelegramCompletionConfig(data.completionNotifications),
  }
}

export async function sendTelegramTestNotification(): Promise<void> {
  const response = await fetch('/codex-api/telegram/test-notification', { method: 'POST' })
  const payload = await response.json()
  if (!response.ok) throw new Error(getErrorMessageFromPayload(payload, 'Test notification failed'))
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const response = await fetch('/codex-api/telegram/status')
  const payload = await response.json()
  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, 'Failed to load Telegram status')
    throw new Error(message)
  }
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {}
  return {
    configured: data.configured === true,
    active: data.active === true,
    lastError: typeof data.lastError === 'string' ? data.lastError : '',
    notification: data.notification && typeof data.notification === 'object' ? data.notification as TelegramStatus['notification'] : undefined,
  }
}

function getErrorMessageFromPayload(payload: unknown, fallback: string): string {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}
  const message = record.message
  if (typeof message === 'string' && message.trim().length > 0) {
    return message
  }
  const error = record.error
  return typeof error === 'string' && error.trim().length > 0 ? error : fallback
}

export type ThreadTitleCache = { titles: Record<string, string>; order: string[] }
export type ThreadPinnedState = { threadIds: string[] }

export async function getThreadTitleCache(): Promise<ThreadTitleCache> {
  try {
    const response = await fetch('/codex-api/thread-titles')
    if (!response.ok) return { titles: {}, order: [] }
    const envelope = (await response.json()) as { data?: ThreadTitleCache }
    return envelope.data ?? { titles: {}, order: [] }
  } catch {
    return { titles: {}, order: [] }
  }
}

export async function persistThreadTitle(id: string, title: string): Promise<void> {
  try {
    await fetch('/codex-api/thread-titles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title }),
    })
  } catch {
    // Best-effort persist
  }
}

export async function getPinnedThreadState(): Promise<ThreadPinnedState> {
  try {
    const response = await fetch('/codex-api/thread-pins')
    if (!response.ok) return { threadIds: [] }
    const envelope = (await response.json()) as { data?: ThreadPinnedState }
    return envelope.data ?? { threadIds: [] }
  } catch {
    return { threadIds: [] }
  }
}

export async function persistPinnedThreadIds(threadIds: string[]): Promise<void> {
  try {
    await fetch('/codex-api/thread-pins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadIds }),
    })
  } catch {
    // Best-effort persist
  }
}

export async function generateThreadTitle(prompt: string, cwd: string | null): Promise<string> {
  try {
    const result = await callRpc<{ title?: string }>('generate-thread-title', { prompt, cwd })
    return result.title?.trim() ?? ''
  } catch {
    return ''
  }
}

export type SkillInfo = {
  name: string
  displayName?: string
  description: string
  path: string
  scope: string
  enabled: boolean
}

function normalizeSkillMarkdownPath(skillPath: string): string {
  if (!skillPath) return ''
  return skillPath.endsWith('/SKILL.md') ? skillPath : `${skillPath}/SKILL.md`
}

function deriveGroupedSkillRoot(
  skillPath: string,
  knownPaths: Set<string>,
): { rootPath: string; rootName: string; isNested: boolean } | null {
  const normalizedPath = normalizeSkillMarkdownPath(skillPath)
  const parts = normalizedPath.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const pluginSkillsIndex = parts.lastIndexOf('skills')
  if (pluginSkillsIndex >= 2) {
    const pluginName = parts[pluginSkillsIndex - 2] ?? ''
    if (pluginName) {
      const pluginRootPath = `/${[...parts.slice(0, pluginSkillsIndex + 1), pluginName, 'SKILL.md'].join('/')}`
      if (knownPaths.has(pluginRootPath)) {
        return { rootPath: pluginRootPath, rootName: pluginName, isNested: pluginRootPath !== normalizedPath }
      }
    }
  }

  const firstSkillsIndex = parts.indexOf('skills')
  if (firstSkillsIndex < 0 || firstSkillsIndex + 1 >= parts.length - 1) return null
  const rootName = parts[firstSkillsIndex + 1] ?? ''
  if (!rootName) return null
  const rootPath = `/${[...parts.slice(0, firstSkillsIndex + 2), 'SKILL.md'].join('/')}`
  if (!knownPaths.has(rootPath)) return { rootPath, rootName, isNested: rootPath !== normalizedPath }
  return { rootPath, rootName, isNested: rootPath !== normalizedPath }
}

type SkillsListResponseEntry = {
  cwd: string
  skills: Array<{
    name: string
    description: string
    shortDescription?: string
    path: string
    scope: string
    enabled: boolean
  }>
  errors: unknown[]
}

export async function getSkillsList(cwds?: string[]): Promise<SkillInfo[]> {
  try {
    const params: Record<string, unknown> = {}
    if (cwds && cwds.length > 0) params.cwds = cwds
    const payload = await callRpc<{ data: SkillsListResponseEntry[] }>('skills/list', params)
    const allSkills = payload.data.flatMap((entry) => entry.skills)
    const pathSet = new Set(allSkills.map((skill) => normalizeSkillMarkdownPath(skill.path)).filter(Boolean))
    const grouped = new Map<string, SkillInfo & { __hasRoot: boolean }>()
    for (const entry of payload.data) {
      for (const skill of entry.skills) {
        if (!skill.name) continue
        const groupInfo = deriveGroupedSkillRoot(skill.path, pathSet)
        const normalizedPath = normalizeSkillMarkdownPath(skill.path)
        const shouldCollapseIntoRoot = Boolean(groupInfo?.isNested && pathSet.has(groupInfo.rootPath))
        const key = shouldCollapseIntoRoot ? groupInfo!.rootPath : normalizedPath
        const isRoot = normalizedPath === key
        const existing = grouped.get(key)
        const candidate: SkillInfo & { __hasRoot: boolean } = {
          name: skill.name,
          displayName: groupInfo && key === groupInfo.rootPath ? groupInfo.rootName : undefined,
          description: skill.shortDescription || skill.description || '',
          path: key,
          scope: skill.scope,
          enabled: skill.enabled,
          __hasRoot: isRoot,
        }
        if (!existing) {
          grouped.set(key, candidate)
          continue
        }
        existing.enabled = existing.enabled || skill.enabled
        if (!existing.__hasRoot && isRoot) {
          grouped.set(key, candidate)
          continue
        }
        if (!existing.displayName && candidate.displayName) {
          existing.displayName = candidate.displayName
        }
        if (!existing.description && candidate.description) {
          existing.description = candidate.description
        }
      }
    }
    return Array.from(grouped.values()).map(({ __hasRoot: _ignored, ...skill }) => skill)
  } catch {
    return []
  }
}

export async function getComposerPrompts(): Promise<ComposerPromptInfo[]> {
  try {
    const response = await fetch('/codex-api/prompts')
    if (!response.ok) return []
    const payload = (await response.json()) as { data?: ComposerPromptInfo[] }
    return Array.isArray(payload.data) ? payload.data : []
  } catch {
    return []
  }
}

export async function createComposerPrompt(name: string, content: string): Promise<ComposerPromptInfo | null> {
  try {
    const response = await fetch('/codex-api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { data?: ComposerPromptInfo }
    return payload.data ?? null
  } catch {
    return null
  }
}

export async function removeComposerPrompt(path: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ path })
    const response = await fetch(`/codex-api/prompts?${params.toString()}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch {
    return false
  }
}

const FILE_UPLOAD_TIMEOUT_MS = 60_000

export async function uploadFile(file: File): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FILE_UPLOAD_TIMEOUT_MS)
  try {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch('/codex-api/upload-file', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { path?: string }
    return data.path ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export const THREAD_GOAL_STATUSES = ['active', 'paused', 'blocked', 'usageLimited', 'budgetLimited', 'complete'] as const
export type ThreadGoalStatus = typeof THREAD_GOAL_STATUSES[number]
export type ThreadGoal = {
  threadId: string
  objective: string
  status: ThreadGoalStatus
  tokenBudget: number | null
  tokensUsed: number
  timeUsedSeconds: number
  createdAt: number
  updatedAt: number
}

function normalizeThreadGoal(value: unknown): ThreadGoal {
  const row = asRecord(value)
  if (!row || typeof row.threadId !== 'string' || !row.threadId.trim()
    || typeof row.objective !== 'string'
    || !THREAD_GOAL_STATUSES.includes(row.status as ThreadGoalStatus)) {
    throw new Error('Thread goal response was malformed')
  }
  return {
    threadId: row.threadId,
    objective: row.objective,
    status: row.status as ThreadGoalStatus,
    tokenBudget: readNumber(row.tokenBudget),
    tokensUsed: readNumber(row.tokensUsed) ?? 0,
    timeUsedSeconds: readNumber(row.timeUsedSeconds) ?? 0,
    createdAt: readNumber(row.createdAt) ?? 0,
    updatedAt: readNumber(row.updatedAt) ?? 0,
  }
}

export async function getThreadGoal(threadId: string): Promise<ThreadGoal | null> {
  if (!threadId.trim()) return null
  const result = await callRpc<{ goal?: unknown }>('thread/goal/get', { threadId: threadId.trim() })
  return result.goal == null ? null : normalizeThreadGoal(result.goal)
}

export async function setThreadGoal(threadId: string, changes: { objective?: string; status?: ThreadGoalStatus; tokenBudget?: number | null }): Promise<ThreadGoal> {
  if (!threadId.trim()) throw new Error('thread/goal/set requires threadId')
  const result = await callRpc<{ goal: unknown }>('thread/goal/set', { ...changes, threadId: threadId.trim() })
  return normalizeThreadGoal(result.goal)
}

export async function clearThreadGoal(threadId: string): Promise<boolean> {
  if (!threadId.trim()) return false
  return (await callRpc<{ cleared: boolean }>('thread/goal/clear', { threadId: threadId.trim() })).cleared === true
}

export async function logoutCodex(): Promise<void> {
  await callRpc('account/logout', {})
}

export async function getCodexAuthenticationStatus(): Promise<boolean | null> {
  const result = await callRpc<{ account?: unknown }>('account/read', { refreshToken: false })
  return result && typeof result === 'object' && 'account' in result ? result.account != null : null
}
