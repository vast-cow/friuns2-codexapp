import { nextTick } from 'vue'

import { cloneGithubRepository, downloadProjectZip, createLocalDirectory, listLocalDirectories, openProjectRoot } from '../api/codexGateway'

import type { LocalDirectoryEntry } from '../api/codexGateway'

import { getPathParent, normalizePathForUi } from '../pathUtils.js'

export interface ProjectContext {
  t: (message: string, params?: Record<string, string | number>) => string
  refreshAll: (options?: { includeSelectedThreadMessages?: boolean; awaitAncillaryRefreshes?: boolean; providerChanged?: boolean; forceThreadRefresh?: boolean; }) => Promise<void>
  pinProjectToTop: (projectName: string) => Promise<void>
  feedbackMailto: string
  prepareFeedbackLink: (event: MouseEvent, message?: string) => void
  newThreadCwd: import("vue").Ref<string, string>
  projectZipExportStatus: import("vue").Ref<{ phase: 'idle' | 'exporting' | 'ready'; loaded: number; total: number | null; blob: Blob | null; fileName: string; error: string }>
  defaultNewProjectName: import("vue").Ref<string, string>
  createFolderInputRef: import("vue").Ref<HTMLInputElement | null, HTMLInputElement | null>
  projectZipProgressText: import("vue").ComputedRef<string>
  projectZipProgressWidth: import("vue").ComputedRef<string>
  isCreateFolderOpen: import("vue").Ref<boolean, boolean>
  createFolderDraft: import("vue").Ref<string, string>
  createFolderError: import("vue").Ref<string, string>
  isCreatingFolder: import("vue").Ref<boolean, boolean>
  isProjectSetupModalOpen: import("vue").Ref<boolean, boolean>
  projectSetupMode: import("vue").Ref<"create" | "clone", "create" | "clone">
  projectSetupBaseDir: import("vue").Ref<string, string>
  projectNameDraft: import("vue").Ref<string, string>
  githubCloneUrlDraft: import("vue").Ref<string, string>
  isProjectImporting: import("vue").Ref<boolean, boolean>
  projectSetupError: import("vue").Ref<string, string>
  isProjectSetupSubmitting: import("vue").Ref<boolean, boolean>
  projectSetupPrimaryInputRef: import("vue").Ref<HTMLInputElement | null, HTMLInputElement | null>
  isExistingFolderPickerOpen: import("vue").Ref<boolean, boolean>
  existingFolderPathInputRef: import("vue").Ref<HTMLInputElement | null, HTMLInputElement | null>
  existingFolderFilterInputRef: import("vue").Ref<HTMLInputElement | null, HTMLInputElement | null>
  existingFolderPathDraft: import("vue").Ref<string, string>
  existingFolderBrowsePath: import("vue").Ref<string, string>
  existingFolderParentPath: import("vue").Ref<string, string>
  existingFolderEntries: import("vue").Ref<{ name: string; path: string; }[], LocalDirectoryEntry[] | { name: string; path: string; }[]>
  existingFolderError: import("vue").Ref<string, string>
  isExistingFolderLoading: import("vue").Ref<boolean, boolean>
  isOpeningExistingFolder: import("vue").Ref<boolean, boolean>
  showHiddenFolders: import("vue").Ref<boolean, boolean>
  existingFolderFilter: import("vue").Ref<string, string>
  existingFolderBrowseRequestId: import("vue").Ref<number>
  createFolderParentPath: import("vue").ComputedRef<string>
  isCreateFolderNameValid: import("vue").ComputedRef<boolean>
  canCreateFolder: import("vue").ComputedRef<boolean>
  isProjectNameDraftValid: import("vue").ComputedRef<boolean>
  canSubmitProjectSetup: import("vue").ComputedRef<boolean>
  resolvedExistingFolderPath: import("vue").ComputedRef<string>
  createFolderSubmitLabel: import("vue").ComputedRef<"Creating…" | "Create">
  projectSetupSubmitLabel: import("vue").ComputedRef<string>
  existingFolderFilteredEntries: import("vue").ComputedRef<{ key: string; name: string; path: string; kind: "parent" | "directory"; }[]>
  resolveProjectBaseDirectory: () => Promise<string>
  refreshDefaultProjectName: () => Promise<void>
  loadWorkspaceRootOptionsState: () => Promise<void>
  joinPath: (parent: string, child: string) => string
  normalizeAbsolutePath: (value: string) => string
}

export function createProjectActions(context: ProjectContext) {
const { t, refreshAll, pinProjectToTop, feedbackMailto, prepareFeedbackLink, newThreadCwd, projectZipExportStatus, defaultNewProjectName, createFolderInputRef, projectZipProgressText, projectZipProgressWidth, isCreateFolderOpen, createFolderDraft, createFolderError, isCreatingFolder, isProjectSetupModalOpen, projectSetupMode, projectSetupBaseDir, projectNameDraft, githubCloneUrlDraft, isProjectImporting, projectSetupError, isProjectSetupSubmitting, projectSetupPrimaryInputRef, isExistingFolderPickerOpen, existingFolderPathInputRef, existingFolderFilterInputRef, existingFolderPathDraft, existingFolderBrowsePath, existingFolderParentPath, existingFolderEntries, existingFolderError, isExistingFolderLoading, isOpeningExistingFolder, showHiddenFolders, existingFolderFilter, existingFolderBrowseRequestId, createFolderParentPath, isCreateFolderNameValid, canCreateFolder, isProjectNameDraftValid, canSubmitProjectSetup, resolvedExistingFolderPath, createFolderSubmitLabel, projectSetupSubmitLabel, existingFolderFilteredEntries, resolveProjectBaseDirectory, refreshDefaultProjectName, loadWorkspaceRootOptionsState, joinPath, normalizeAbsolutePath } = context
async function onOpenProjectSetupModal(): Promise<void> {
  const baseDir = await resolveProjectBaseDirectory()
  if (!baseDir) return

  await refreshDefaultProjectName()
  projectSetupBaseDir.value = baseDir
  projectNameDraft.value = defaultNewProjectName.value.trim() || 'New Project (1)'
  githubCloneUrlDraft.value = ''
  projectSetupError.value = ''
  projectSetupMode.value = 'create'
  isProjectSetupModalOpen.value = true
  void nextTick(() => projectSetupPrimaryInputRef.value?.focus())
}

function onCloseProjectSetupModal(): void {
  if (isProjectSetupSubmitting.value) return
  isProjectSetupModalOpen.value = false
  projectSetupError.value = ''
}

async function createProjectFromSetupModal(): Promise<string> {
  const baseDir = projectSetupBaseDir.value.trim()
  const normalizedProjectName = projectNameDraft.value.trim()
  if (!isProjectNameDraftValid.value) {
    throw new Error('Enter a single project folder name.')
  }
  const targetPath = normalizeAbsolutePath(joinPath(baseDir, normalizedProjectName))
  if (!targetPath) return ''

  return openProjectRoot(targetPath, {
    createIfMissing: true,
    label: '',
  })
}

async function cloneGithubRepositoryFromSetupModal(): Promise<string> {
  const baseDir = projectSetupBaseDir.value.trim()
  const normalizedRepoUrl = githubCloneUrlDraft.value.trim()
  if (!normalizedRepoUrl) return ''

  return cloneGithubRepository(normalizedRepoUrl, baseDir)
}

async function onSubmitProjectSetup(): Promise<void> {
  if (!canSubmitProjectSetup.value || isProjectSetupSubmitting.value) return

  projectSetupError.value = ''
  isProjectSetupSubmitting.value = true
  try {
    const normalizedPath =
      projectSetupMode.value === 'clone'
        ? await cloneGithubRepositoryFromSetupModal()
        : await createProjectFromSetupModal()
    if (!normalizedPath) return

    newThreadCwd.value = normalizedPath
    await pinProjectToTop(normalizedPath)
    await loadWorkspaceRootOptionsState()
    await refreshDefaultProjectName()
    isProjectSetupModalOpen.value = false
  } catch (error) {
    projectSetupError.value = error instanceof Error ? error.message : 'Failed to create or clone project.'
  } finally {
    isProjectSetupSubmitting.value = false
  }
}

async function finishProjectImport(
  input: HTMLInputElement | null,
  importer: (baseDir: string) => Promise<{ path: string }>,
  fallbackMessage: string,
): Promise<void> {
  isProjectImporting.value = true
  try {
    const baseDir = await resolveProjectBaseDirectory()
    if (!baseDir) return
    const result = await importer(baseDir)
    if (!result.path) return
    newThreadCwd.value = result.path
    await pinProjectToTop(result.path)
    await loadWorkspaceRootOptionsState()
    await refreshAll({ includeSelectedThreadMessages: false, forceThreadRefresh: true })
    await refreshDefaultProjectName()
  } catch (error) {
    const message = error instanceof Error ? error.message : fallbackMessage
    window.alert(message)
  } finally {
    isProjectImporting.value = false
    if (input) input.value = ''
  }
}

async function onOpenExistingFolder(): Promise<void> {
  const startPath = newThreadCwd.value.trim() || await resolveProjectBaseDirectory()
  if (!startPath) return
  isCreateFolderOpen.value = false
  isExistingFolderPickerOpen.value = true
  existingFolderFilter.value = ''
  await loadExistingFolderListing(startPath)
  if (!existingFolderError.value) {
    void nextTick(() => existingFolderPathInputRef.value?.focus())
  }
}

function onCloseExistingFolderPanel(): void {
  existingFolderBrowseRequestId.value += 1
  isExistingFolderPickerOpen.value = false
  isExistingFolderLoading.value = false
  existingFolderError.value = ''
  existingFolderFilter.value = ''
  existingFolderPathDraft.value = ''
  onCloseCreateFolderPanel()
}

async function onBrowseExistingFolder(path: string): Promise<void> {
  if (!path || isExistingFolderLoading.value) return
  existingFolderFilter.value = ''
  await loadExistingFolderListing(path)
}

function onToggleHiddenFolders(): void {
  const currentPath = existingFolderBrowsePath.value.trim()
  if (!isExistingFolderPickerOpen.value || !currentPath) return
  void loadExistingFolderListing(currentPath)
}

function onRetryExistingFolderBrowse(): void {
  const currentPath = resolvedExistingFolderPath.value
  if (!isExistingFolderPickerOpen.value || !currentPath || isExistingFolderLoading.value || isOpeningExistingFolder.value) return
  void loadExistingFolderListing(currentPath)
}

async function onConfirmExistingFolder(path = resolvedExistingFolderPath.value): Promise<void> {
  const targetPath = normalizePathForUi(path).trim()
  if (!targetPath) return

  existingFolderError.value = ''
  isOpeningExistingFolder.value = true
  try {
    const normalizedPath = await openProjectRoot(targetPath, {
      createIfMissing: false,
      label: '',
    })
    if (!normalizedPath) {
      existingFolderError.value = 'Failed to open the selected folder.'
      return
    }

    newThreadCwd.value = normalizedPath
    await pinProjectToTop(normalizedPath)
    await loadWorkspaceRootOptionsState()
    await refreshAll({ includeSelectedThreadMessages: false, forceThreadRefresh: true })
    await refreshDefaultProjectName()
    onCloseExistingFolderPanel()
  } catch (error) {
    existingFolderError.value = error instanceof Error ? error.message : 'Failed to open the selected folder.'
  } finally {
    isOpeningExistingFolder.value = false
  }
}

async function onOpenCreateFolderPanel(): Promise<void> {
  createFolderError.value = ''
  if (isCreateFolderOpen.value) {
    onCloseCreateFolderPanel()
    return
  }
  if (!isExistingFolderPickerOpen.value) {
    const startPath = newThreadCwd.value.trim() || await resolveProjectBaseDirectory()
    if (!startPath) return
    isExistingFolderPickerOpen.value = true
    existingFolderFilter.value = ''
    await loadExistingFolderListing(startPath)
    if (existingFolderError.value) return
  }
  if (existingFolderError.value) return
  createFolderDraft.value = defaultNewProjectName.value
  isCreateFolderOpen.value = true
  void nextTick(() => createFolderInputRef.value?.focus())
}

function onCloseCreateFolderPanel(): void {
  createFolderError.value = ''
  createFolderDraft.value = ''
  isCreateFolderOpen.value = false
}

async function onCreateFolder(): Promise<void> {
  const normalizedInput = createFolderDraft.value.trim()
  if (!normalizedInput) return

  createFolderError.value = ''
  if (existingFolderError.value) {
    createFolderError.value = 'Reload the current folder before creating a new one.'
    return
  }
  isCreatingFolder.value = true

  const baseDir = createFolderParentPath.value.trim()
  const targetPath = normalizeAbsolutePath(joinPath(baseDir, normalizedInput))

  if (!targetPath) {
    createFolderError.value = 'Unable to determine where the new folder should be created.'
    isCreatingFolder.value = false
    return
  }

  if (!isCreateFolderNameValid.value) {
    createFolderError.value = 'Enter a single folder name.'
    isCreatingFolder.value = false
    return
  }

  try {
    const normalizedPath = await createLocalDirectory(targetPath)
    if (!normalizedPath) {
      createFolderError.value = 'Failed to create the folder.'
      return
    }

    createFolderError.value = ''
    existingFolderFilter.value = ''
    await loadExistingFolderListing(normalizedPath)
    onCloseCreateFolderPanel()
  } catch (error) {
    createFolderError.value = error instanceof Error ? error.message : 'Failed to create folder.'
  } finally {
    isCreatingFolder.value = false
  }
}

async function loadExistingFolderListing(path: string): Promise<void> {
  const requestId = ++existingFolderBrowseRequestId.value
  const normalizedRequestedPath = normalizePathForUi(path).trim()
  existingFolderPathDraft.value = normalizedRequestedPath
  existingFolderBrowsePath.value = normalizedRequestedPath
  existingFolderError.value = ''
  isExistingFolderLoading.value = true

  try {
    const listing = await listLocalDirectories(path, { showHidden: showHiddenFolders.value })
    if (requestId !== existingFolderBrowseRequestId.value) return
    existingFolderPathDraft.value = listing.path
    existingFolderBrowsePath.value = listing.path
    existingFolderParentPath.value = listing.parentPath
    existingFolderEntries.value = listing.entries
  } catch (error) {
    if (requestId !== existingFolderBrowseRequestId.value) return
    existingFolderError.value = error instanceof Error ? error.message : 'Failed to load local folders.'
    existingFolderParentPath.value = getPathParent(existingFolderBrowsePath.value)
    existingFolderEntries.value = []
    onCloseCreateFolderPanel()
  } finally {
    if (requestId === existingFolderBrowseRequestId.value) {
      isExistingFolderLoading.value = false
    }
  }
}

function onCloseProjectZipExportModal(): void {
  if (projectZipExportStatus.value.phase === 'exporting') return
  projectZipExportStatus.value = { phase: 'idle', loaded: 0, total: null, blob: null, fileName: '', error: '' }
}

function onDownloadProjectZipExport(): void {
  const { blob, fileName } = projectZipExportStatus.value
  if (!blob || !fileName) return
  projectZipExportStatus.value = { ...projectZipExportStatus.value, error: '' }
  downloadProjectZipFallback(blob, fileName)
}

async function onShareProjectZipExport(): Promise<void> {
  const { blob, fileName } = projectZipExportStatus.value
  if (!blob || !fileName) return
  try {
    projectZipExportStatus.value = { ...projectZipExportStatus.value, error: '' }
    await shareProjectZip(blob, fileName)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    const message = error instanceof Error ? error.message : ''
    const wasBlocked = error instanceof DOMException && error.name === 'NotAllowedError'
      || /permission denied|notallowed|not allowed|gesture/iu.test(message)
    projectZipExportStatus.value = {
      ...projectZipExportStatus.value,
      error: wasBlocked
        ? t('This browser blocked sharing the ZIP. Use Download instead.')
        : (message || t('Failed to share project. Use Download instead.')),
    }
  }
}

async function exportProjectZipForCwd(targetCwd: string): Promise<void> {
  if (!targetCwd || typeof document === 'undefined') return
  projectZipExportStatus.value = { phase: 'exporting', loaded: 0, total: null, blob: null, fileName: '', error: '' }
  try {
    const { blob, fileName } = await downloadProjectZip(targetCwd, ({ loaded, total }) => {
      projectZipExportStatus.value = { ...projectZipExportStatus.value, phase: 'exporting', loaded, total }
    })
    projectZipExportStatus.value = { phase: 'ready', loaded: blob.size, total: blob.size, blob, fileName, error: '' }
  } catch (error) {
    projectZipExportStatus.value = { phase: 'idle', loaded: 0, total: null, blob: null, fileName: '', error: '' }
    if (error instanceof DOMException && error.name === 'AbortError') return
    const message = error instanceof Error ? error.message : 'Failed to export project.'
    window.alert(message)
  }
}

function downloadProjectZipFallback(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

async function shareProjectZip(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type || 'application/zip' })
  const shareData = {
    files: [file],
    title: fileName,
  }
  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
  if (!canShareFiles) {
    throw new Error('File sharing is not supported in this browser.')
  }
  await navigator.share(shareData)
}
return { onOpenProjectSetupModal, onCloseProjectSetupModal, createProjectFromSetupModal, cloneGithubRepositoryFromSetupModal, onSubmitProjectSetup, finishProjectImport, onOpenExistingFolder, onCloseExistingFolderPanel, onBrowseExistingFolder, onToggleHiddenFolders, onRetryExistingFolderBrowse, onConfirmExistingFolder, onOpenCreateFolderPanel, onCloseCreateFolderPanel, onCreateFolder, loadExistingFolderListing, onCloseProjectZipExportModal, onDownloadProjectZipExport, onShareProjectZipExport, exportProjectZipForCwd, downloadProjectZipFallback, shareProjectZip }
}