

import { deleteThreadAutomation, deleteProjectAutomation, runThreadAutomationNow, upsertProjectAutomation, upsertThreadAutomation } from '../../api/codexGateway'
import type { UiThreadAutomation, UiThreadAutomationStatus } from '../../types/codex'

type AutomationScheduleMode = 'daily' | 'interval' | 'advanced'
type AutomationIntervalUnit = 'minutes' | 'hours' | 'days'
type AutomationTargetMode = 'thread' | 'project'
type AutomationScheduleDraft = {
  mode: AutomationScheduleMode
  dailyTime: string
  interval: number
  intervalUnit: AutomationIntervalUnit
}
export interface AutomationContext {
  t: (message: string, params?: Record<string, string | number>) => string
  emit: ((evt: "select", threadId: string) => void) & ((evt: "archive", threadId: string) => void) & ((evt: "start-new-thread", projectName: string) => void) & ((evt: "browse-thread-files", threadId: string) => void) & ((evt: "save-thread-project", threadId: string) => void) & ((evt: "browse-project-files", projectName: string) => void) & ((evt: "save-project", projectName: string) => void) & ((evt: "request-project-git-status", projectName: string) => void) & ((evt: "create-project-worktree", projectName: string) => void) & ((evt: "rename-project", payload: { projectName: string; displayName: string; }) => void) & ((evt: "rename-thread", payload: { threadId: string; title: string; }) => void) & ((evt: "remove-project", projectName: string) => void) & ((evt: "reorder-project", payload: { projectName: string; toIndex: number; }) => void) & ((evt: "copy-thread-chat", threadId: string) => void) & ((evt: "fork-thread", threadId: string) => void) & ((evt: "start-new-chat") => void) & ((evt: "automations-changed") => void)
  automationByThreadId: import("vue").Ref<Record<string, UiThreadAutomation[]>, Record<string, UiThreadAutomation[]>>
  automationByProjectName: import("vue").Ref<Record<string, UiThreadAutomation[]>, Record<string, UiThreadAutomation[]>>
  automationDialogVisible: import("vue").Ref<boolean, boolean>
  automationDialogScope: import("vue").Ref<"thread" | "project", "thread" | "project">
  automationDialogThreadId: import("vue").Ref<string, string>
  automationDialogProjectName: import("vue").Ref<string, string>
  automationDialogAutomationId: import("vue").Ref<string, string>
  automationDialogMode: import("vue").Ref<"create" | "edit", "create" | "edit">
  automationTargetPickerVisible: import("vue").Ref<boolean, boolean>
  automationTargetMode: import("vue").Ref<AutomationTargetMode, AutomationTargetMode>
  automationTargetValue: import("vue").Ref<string, string>
  automationDialogError: import("vue").Ref<string, string>
  automationDialogNotice: import("vue").Ref<string, string>
  isSavingAutomation: import("vue").Ref<boolean, boolean>
  isRunningAutomation: import("vue").Ref<boolean, boolean>
  automationDraft: import("vue").Ref<{ name: string; prompt: string; rrule: string; status: UiThreadAutomationStatus; }, { name: string; prompt: string; rrule: string; status: UiThreadAutomationStatus; } | { name: string; prompt: string; rrule: string; status: UiThreadAutomationStatus; }>
  automationScheduleDraft: import("vue").Ref<{ mode: AutomationScheduleMode; dailyTime: string; interval: number; intervalUnit: AutomationIntervalUnit; }, AutomationScheduleDraft | { mode: AutomationScheduleMode; dailyTime: string; interval: number; intervalUnit: AutomationIntervalUnit; }>
  automationDialogAutomations: import("vue").ComputedRef<UiThreadAutomation[]>
  automationSchedulePreview: import("vue").ComputedRef<string>
  automationDialogSubtitle: import("vue").ComputedRef<"This creates a heartbeat automation attached to the selected chat." | "This creates a project automation attached to the selected project folder." | "This creates project automations attached to the selected project folder." | "This creates heartbeat automations attached to the selected thread.">
  automationThreadTargetOptions: import("vue").ComputedRef<{ value: string; label: string; searchText: string; }[]>
  automationTargetDropdownOptions: import("vue").ComputedRef<{ value: string; label: string; }[]>
  automationIntervalUnitOptions: { value: string; label: string; }[]
  automationStatusOptions: import("vue").ComputedRef<{ value: string; label: string; }[]>
  padRruleNumber: (value: number) => string
  parsePositiveInteger: (value: unknown, fallback: number) => number
  parseRruleParts: (rrule: string) => Record<string, string>
  closeThreadMenu: () => void
  omitAutomationThread: (state: Record<string, UiThreadAutomation[]>, threadId: string) => Record<string, UiThreadAutomation[]>
  reloadProjectAutomations: () => Promise<void>
  closeProjectMenu: () => void
  getProjectAutomationKey: (projectName: string) => string
}

export function createAutomationActions(context: AutomationContext) {
const { t, emit, automationByThreadId, automationByProjectName, automationDialogVisible, automationDialogScope, automationDialogThreadId, automationDialogProjectName, automationDialogAutomationId, automationDialogMode, automationTargetPickerVisible, automationTargetMode, automationTargetValue, automationDialogError, automationDialogNotice, isSavingAutomation, isRunningAutomation, automationDraft, automationScheduleDraft, automationDialogAutomations, automationSchedulePreview, automationDialogSubtitle, automationThreadTargetOptions, automationTargetDropdownOptions, automationIntervalUnitOptions, automationStatusOptions, padRruleNumber, parsePositiveInteger, parseRruleParts, closeThreadMenu, omitAutomationThread, reloadProjectAutomations, closeProjectMenu, getProjectAutomationKey } = context
function buildDailyRrule(time: string): string {
  const [rawHour, rawMinute] = time.split(':')
  const hour = Math.min(23, Math.max(0, Number(rawHour) || 0))
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0))
  return `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${minute}`
}

function buildIntervalRrule(interval: number, unit: AutomationIntervalUnit): string {
  const normalizedInterval = parsePositiveInteger(interval, 1)
  if (unit === 'minutes') return `FREQ=MINUTELY;INTERVAL=${normalizedInterval}`
  if (unit === 'hours') return `FREQ=HOURLY;INTERVAL=${normalizedInterval}`
  return `FREQ=DAILY;INTERVAL=${normalizedInterval}`
}

function createScheduleDraftFromRrule(rrule: string): AutomationScheduleDraft {
  const parts = parseRruleParts(rrule)
  const frequency = parts.FREQ?.toUpperCase()
  const interval = parsePositiveInteger(parts.INTERVAL, 1)
  if (frequency === 'DAILY' && parts.BYHOUR !== undefined && parts.BYMINUTE !== undefined && interval === 1) {
    const hour = Math.min(23, Math.max(0, Number(parts.BYHOUR) || 0))
    const minute = Math.min(59, Math.max(0, Number(parts.BYMINUTE) || 0))
    return {
      mode: 'daily',
      dailyTime: `${padRruleNumber(hour)}:${padRruleNumber(minute)}`,
      interval: 1,
      intervalUnit: 'hours',
    }
  }
  if (frequency === 'MINUTELY' || frequency === 'HOURLY' || (frequency === 'DAILY' && parts.INTERVAL !== undefined)) {
    return {
      mode: 'interval',
      dailyTime: '09:00',
      interval,
      intervalUnit: frequency === 'MINUTELY' ? 'minutes' : frequency === 'HOURLY' ? 'hours' : 'days',
    }
  }
  return {
    mode: 'advanced',
    dailyTime: '09:00',
    interval: 1,
    intervalUnit: 'hours',
  }
}

function syncAutomationRruleFromScheduleDraft(): void {
  const draft = automationScheduleDraft.value
  if (draft.mode === 'daily') {
    automationDraft.value.rrule = buildDailyRrule(draft.dailyTime)
  } else if (draft.mode === 'interval') {
    automationDraft.value.rrule = buildIntervalRrule(draft.interval, draft.intervalUnit)
  }
}

function onAutomationIntervalUnitChange(value: string): void {
  if (value !== 'minutes' && value !== 'hours' && value !== 'days') return
  automationScheduleDraft.value = {
    ...automationScheduleDraft.value,
    intervalUnit: value,
  }
  syncAutomationRruleFromScheduleDraft()
}

function onAutomationStatusChange(value: string): void {
  if (value !== 'ACTIVE' && value !== 'PAUSED') return
  automationDraft.value = {
    ...automationDraft.value,
    status: value,
  }
}

function syncAutomationScheduleDraftFromRrule(): void {
  automationScheduleDraft.value = createScheduleDraftFromRrule(automationDraft.value.rrule)
}

function setAutomationScheduleMode(mode: AutomationScheduleMode): void {
  automationScheduleDraft.value = {
    ...automationScheduleDraft.value,
    mode,
  }
  syncAutomationRruleFromScheduleDraft()
}

function openAutomationDialog(threadId: string): void {
  automationDialogScope.value = 'thread'
  automationDialogThreadId.value = threadId
  automationDialogProjectName.value = ''
  automationTargetPickerVisible.value = false
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  const existing = automationByThreadId.value[threadId]?.[0]
  if (existing) {
    selectAutomationForEditing(existing.id)
  } else {
    startNewAutomationDraft()
  }
  automationDialogVisible.value = true
  closeThreadMenu()
}

function openProjectAutomationDialog(projectName: string): void {
  const projectCwd = getProjectAutomationKey(projectName)
  if (!projectCwd) {
    automationDialogScope.value = 'project'
    automationDialogThreadId.value = ''
    automationDialogProjectName.value = ''
    automationTargetPickerVisible.value = false
    automationDialogError.value = 'Project automation requires a resolved absolute project path.'
    automationDialogNotice.value = ''
    automationDialogVisible.value = true
    closeProjectMenu()
    return
  }
  automationDialogScope.value = 'project'
  automationDialogThreadId.value = ''
  automationDialogProjectName.value = projectCwd
  automationTargetPickerVisible.value = false
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  const existing = automationByProjectName.value[projectCwd]?.[0]
  if (existing) {
    selectAutomationForEditing(existing.id)
  } else {
    startNewAutomationDraft()
  }
  automationDialogVisible.value = true
  closeProjectMenu()
}

function openAutomationEditorFromPanel(payload: {
  scope: 'thread' | 'project'
  target: string
  automation: UiThreadAutomation
}): void {
  automationDialogScope.value = payload.scope
  automationDialogThreadId.value = payload.scope === 'thread' ? payload.target : ''
  automationDialogProjectName.value = payload.scope === 'project' ? payload.target : ''
  automationTargetPickerVisible.value = false
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  if (payload.scope === 'project') {
    automationByProjectName.value = updateAutomationForProject(automationByProjectName.value, payload.target, payload.automation)
  } else {
    automationByThreadId.value = updateAutomationForThread(automationByThreadId.value, payload.target, payload.automation)
  }
  selectAutomationForEditing(payload.automation.id)
  automationDialogVisible.value = true
  closeProjectMenu()
  closeThreadMenu()
}

function openAutomationCreatorFromPanel(): void {
  automationTargetPickerVisible.value = true
  automationTargetMode.value = 'thread'
  automationTargetValue.value = automationThreadTargetOptions.value[0]?.value ?? ''
  automationDialogScope.value = 'thread'
  automationDialogThreadId.value = ''
  automationDialogProjectName.value = ''
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  startNewAutomationDraft()
  automationDialogVisible.value = true
  closeProjectMenu()
  closeThreadMenu()
}

function setAutomationTargetMode(mode: AutomationTargetMode): void {
  automationTargetMode.value = mode
  automationTargetValue.value = ''
  automationDialogScope.value = mode === 'project' ? 'project' : 'thread'
  automationTargetValue.value = automationTargetDropdownOptions.value[0]?.value ?? ''
}

function startNewAutomationDraft(): void {
  automationDialogAutomationId.value = ''
  automationDialogMode.value = 'create'
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  automationDraft.value = {
    name: automationDialogScope.value === 'project' ? 'Project automation' : 'Thread automation',
    prompt: '',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    status: 'ACTIVE',
  }
  automationScheduleDraft.value = createScheduleDraftFromRrule(automationDraft.value.rrule)
}

function selectAutomationForEditing(automationId: string): void {
  const existing = automationDialogAutomations.value.find((automation) => automation.id === automationId)
  if (!existing) return
  automationDialogAutomationId.value = existing.id
  automationDialogMode.value = 'edit'
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  automationDraft.value = {
    name: existing.name,
    prompt: existing.prompt,
    rrule: existing.rrule,
    status: existing.status,
  }
  automationScheduleDraft.value = createScheduleDraftFromRrule(existing.rrule)
}

function closeAutomationDialog(): void {
  automationDialogVisible.value = false
  automationDialogScope.value = 'thread'
  automationDialogThreadId.value = ''
  automationDialogProjectName.value = ''
  automationDialogAutomationId.value = ''
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  isSavingAutomation.value = false
  isRunningAutomation.value = false
}

function updateAutomationForThread(
  state: Record<string, UiThreadAutomation[]>,
  threadId: string,
  saved: UiThreadAutomation,
): Record<string, UiThreadAutomation[]> {
  const existing = state[threadId] ?? []
  const index = existing.findIndex((automation) => automation.id === saved.id)
  const next = [...existing]
  if (index >= 0) {
    next.splice(index, 1, saved)
  } else {
    next.push(saved)
  }
  return { ...state, [threadId]: next }
}

function removeAutomationForThread(
  state: Record<string, UiThreadAutomation[]>,
  threadId: string,
  automationId: string,
): Record<string, UiThreadAutomation[]> {
  const next = (state[threadId] ?? []).filter((automation) => automation.id !== automationId)
  return next.length > 0 ? { ...state, [threadId]: next } : omitAutomationThread(state, threadId)
}

function updateAutomationForProject(
  state: Record<string, UiThreadAutomation[]>,
  projectName: string,
  saved: UiThreadAutomation,
): Record<string, UiThreadAutomation[]> {
  const existing = state[projectName] ?? []
  const index = existing.findIndex((automation) => automation.id === saved.id)
  const next = [...existing]
  if (index >= 0) {
    next.splice(index, 1, saved)
  } else {
    next.push(saved)
  }
  return { ...state, [projectName]: next }
}

async function submitAutomationDialog(): Promise<void> {
  let threadId = automationDialogThreadId.value
  let projectName = automationDialogProjectName.value
  isSavingAutomation.value = true
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  try {
    syncAutomationRruleFromScheduleDraft()
    if (automationTargetPickerVisible.value && automationDialogMode.value === 'create') {
      if (automationTargetMode.value === 'thread') {
        threadId = automationTargetValue.value
        projectName = ''
        automationDialogScope.value = 'thread'
        automationDialogThreadId.value = threadId
        automationDialogProjectName.value = ''
      } else {
        projectName = automationTargetValue.value
        threadId = ''
        automationDialogScope.value = 'project'
        automationDialogThreadId.value = ''
        automationDialogProjectName.value = projectName
      }
    }
    if (automationDialogScope.value === 'thread' && !threadId) {
      throw new Error('Select a chat target for this automation')
    }
    if (automationDialogScope.value === 'project' && !projectName) {
      throw new Error('Select a project target for this automation')
    }
    const input = {
      id: automationDialogAutomationId.value || undefined,
      name: automationDraft.value.name,
      prompt: automationDraft.value.prompt,
      rrule: automationDraft.value.rrule,
      status: automationDraft.value.status,
    }
    const saved = automationDialogScope.value === 'project'
      ? await upsertProjectAutomation({ ...input, projectName })
      : await upsertThreadAutomation({ ...input, threadId })
    if (automationDialogScope.value === 'project') {
      await reloadProjectAutomations()
    } else {
      automationByThreadId.value = updateAutomationForThread(automationByThreadId.value, threadId, saved)
    }
    emit('automations-changed')
    selectAutomationForEditing(saved.id)
    automationDialogNotice.value = 'Automation saved.'
    isSavingAutomation.value = false
  } catch (error) {
    automationDialogError.value = error instanceof Error ? error.message : 'Failed to save automation'
    isSavingAutomation.value = false
  }
}

async function onDeleteAutomationFromDialog(): Promise<void> {
  const threadId = automationDialogThreadId.value
  const projectName = automationDialogProjectName.value
  const automationId = automationDialogAutomationId.value
  if (!automationId) return
  if (automationDialogScope.value === 'thread' && !threadId) return
  if (automationDialogScope.value === 'project' && !projectName) return
  isSavingAutomation.value = true
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  try {
    if (automationDialogScope.value === 'project') {
      await deleteProjectAutomation(projectName, automationId)
      await reloadProjectAutomations()
    } else {
      await deleteThreadAutomation(threadId, automationId)
      automationByThreadId.value = removeAutomationForThread(automationByThreadId.value, threadId, automationId)
    }
    const nextAutomation = automationDialogAutomations.value[0]
    if (nextAutomation) {
      selectAutomationForEditing(nextAutomation.id)
    } else {
      startNewAutomationDraft()
    }
    emit('automations-changed')
    isSavingAutomation.value = false
  } catch (error) {
    automationDialogError.value = error instanceof Error ? error.message : 'Failed to remove automation'
    isSavingAutomation.value = false
  }
}

async function onRunAutomationFromDialog(): Promise<void> {
  const threadId = automationDialogThreadId.value
  const automationId = automationDialogAutomationId.value
  if (!threadId || !automationId) return
  isRunningAutomation.value = true
  automationDialogError.value = ''
  automationDialogNotice.value = ''
  try {
    await runThreadAutomationNow(threadId, automationId)
    automationDialogNotice.value = 'Automation run queued.'
  } catch (error) {
    automationDialogError.value = error instanceof Error ? error.message : 'Failed to run automation'
  } finally {
    isRunningAutomation.value = false
  }
}
return { buildDailyRrule, buildIntervalRrule, createScheduleDraftFromRrule, syncAutomationRruleFromScheduleDraft, onAutomationIntervalUnitChange, onAutomationStatusChange, syncAutomationScheduleDraftFromRrule, setAutomationScheduleMode, openAutomationDialog, openProjectAutomationDialog, openAutomationEditorFromPanel, openAutomationCreatorFromPanel, setAutomationTargetMode, startNewAutomationDraft, selectAutomationForEditing, closeAutomationDialog, updateAutomationForThread, removeAutomationForThread, updateAutomationForProject, submitAutomationDialog, onDeleteAutomationFromDialog, onRunAutomationFromDialog }
}