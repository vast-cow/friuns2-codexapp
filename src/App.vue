<template>
  <DesktopLayout :is-sidebar-collapsed="isSidebarCollapsed" @close-sidebar="setSidebarCollapsed(true)">
    <template #sidebar>
      <section class="sidebar-root">
        <div
          ref="sidebarScrollableRef"
          class="sidebar-scrollable"
          @scroll="onSidebarScroll"
        >
          <SidebarThreadControls
            v-if="!isSidebarCollapsed"
            class="sidebar-thread-controls-host"
            :is-sidebar-collapsed="isSidebarCollapsed"
            :show-new-thread-button="true"
            @toggle-sidebar="setSidebarCollapsed(!isSidebarCollapsed)"
            @start-new-thread="onStartNewThreadFromToolbar"
          >
            <button
              class="sidebar-search-toggle"
              type="button"
              :aria-pressed="isSidebarSearchVisible"
              :aria-label="t('Search threads')"
              :title="t('Search threads')"
              @click="toggleSidebarSearch"
            >
              <IconTablerSearch class="sidebar-search-toggle-icon" />
            </button>
            <button
              class="sidebar-search-toggle"
              :class="{ 'is-active': isSkillsRoute }"
              type="button"
              :aria-label="t('Skills')"
              :title="t('Skills')"
              :aria-current="isSkillsRoute ? 'page' : undefined"
              @click="router.push({ name: 'skills' }); isMobile && setSidebarCollapsed(true)"
            >
              <IconTablerBolt class="sidebar-search-toggle-icon" />
            </button>
            <button
              class="sidebar-search-toggle"
              :class="{ 'is-active': isAutomationsRoute }"
              type="button"
              :aria-label="t('Automations')"
              :title="t('Automations')"
              :aria-current="isAutomationsRoute ? 'page' : undefined"
              @click="router.push({ name: 'automations' }); isMobile && setSidebarCollapsed(true)"
            >
              <IconTablerBolt class="sidebar-search-toggle-icon" />
            </button>
          </SidebarThreadControls>

          <div v-if="!isSidebarCollapsed && isSidebarSearchVisible" class="sidebar-search-bar">
            <IconTablerSearch class="sidebar-search-bar-icon" />
            <input
              ref="sidebarSearchInputRef"
              v-model="sidebarSearchQuery"
              class="sidebar-search-input"
              type="text"
              :placeholder="t('Filter threads...')"
              @keydown="onSidebarSearchKeydown"
            />
            <button
              v-if="sidebarSearchQuery.length > 0"
              class="sidebar-search-clear"
              type="button"
              :aria-label="t('Clear search')"
              @click="clearSidebarSearch"
            >
              <IconTablerX class="sidebar-search-clear-icon" />
            </button>
          </div>

          <SidebarThreadTree ref="sidebarThreadTreeRef" :groups="projectGroups" :project-display-name-by-id="projectDisplayNameById"
            :project-git-repo-by-name="projectGitRepoByName"
            :project-cwd-by-name="projectCwdByName"
            v-if="!isSidebarCollapsed"
            :selected-thread-id="selectedThreadId" :is-loading="isLoadingThreads"
            :is-thread-list-fully-loaded="isThreadListFullyLoaded"
            :search-query="sidebarSearchQuery"
            :search-matched-thread-ids="serverMatchedThreadIds"
            @select="onSelectThread"
            @archive="onArchiveThread" @start-new-thread="onStartNewThread" @rename-project="onRenameProject"
            @browse-thread-files="onBrowseThreadFiles"
            @save-thread-project="onSaveThreadProject"
            @browse-project-files="onBrowseProjectFiles"
            @save-project="onSaveProject"
            @request-project-git-status="onRequestProjectGitStatus"
            @create-project-worktree="onCreateProjectWorktree"
            @rename-thread="onRenameThread"
            @fork-thread="onForkThread"
            @remove-project="onRemoveProject" @reorder-project="onReorderProject"
            @copy-thread-chat="onCopyThreadChat"
            @automations-changed="onAutomationsChanged"
            @start-new-chat="onStartProjectlessNewChat" />
        </div>

        <div
          v-if="!isSidebarCollapsed"
          ref="settingsAreaRef"
          class="sidebar-settings-area"
          @click="onSettingsAreaClick"
        >
          <Transition name="settings-panel">
            <div
              v-if="isSettingsOpen"
              ref="settingsPanelRef"
              class="sidebar-settings-panel"
              @click.stop
            >
              <SettingsContent :context="settingsContext" />
            </div>
          </Transition>
          <button
            ref="settingsButtonRef"
            class="sidebar-settings-button"
            type="button"
            @click.stop="isSettingsOpen = !isSettingsOpen"
          >
            <IconTablerSettings class="sidebar-settings-icon" />
            <span>{{ t('Settings') }}</span>
            <span class="sidebar-settings-button-version">
              {{ worktreeName }} · v{{ appVersion }}
            </span>
          </button>
        </div>
      </section>
    </template>

    <template #content>
      <section
        class="content-root"
        :class="{
          'is-virtual-keyboard-open': isTerminalKeyboardLayoutActive,
          'is-terminal-open': isComposerTerminalOpen,
        }"
        :style="contentStyle"
      >
        <span v-if="isVirtualKeyboardOpen" class="content-keyboard-spacer" aria-hidden="true" />
        <ContentHeader :title="contentTitle" :accent="isSkillsRoute || isAutomationsRoute">
          <template #leading>
            <SidebarThreadControls
              v-if="isSidebarCollapsed || isMobile"
              class="sidebar-thread-controls-header-host"
              :is-sidebar-collapsed="isSidebarCollapsed"
              :show-new-thread-button="true"
              @toggle-sidebar="setSidebarCollapsed(!isSidebarCollapsed)"
              @start-new-thread="onStartNewThreadFromToolbar"
            />
            <span v-if="isSkillsRoute" class="skills-route-header-icon" aria-hidden="true">
              <IconTablerBolt />
            </span>
            <span v-else-if="isAutomationsRoute" class="skills-route-header-icon automations-route-header-icon" aria-hidden="true">
              <IconTablerBolt />
            </span>
          </template>
          <template #actions>
            <ComposerDropdown
              v-if="canShowTerminalToggle"
              class="content-header-terminal-command"
              :class="{ 'is-open': isComposerTerminalOpen }"
              :model-value="terminalHeaderDropdownValue"
              :options="terminalHeaderDropdownOptions"
              :placeholder="terminalCommandPlaceholder"
              :selected-prefix-icon="IconTablerTerminal"
              :icon-only="true"
              menu-align="end"
              :empty-label="t('No commands')"
              @update:model-value="onSelectHeaderTerminalCommand"
            />
            <HeaderGitBranchDropdown
              v-if="canShowContentHeaderBranchDropdown"
              class="content-header-branch-dropdown"
              :current-branch="currentThreadBranch"
              :head-sha="currentThreadHeadSha"
              :head-subject="currentThreadHeadSubject"
              :head-date="currentThreadHeadDate"
              :detached="isThreadDetachedHead"
              :dirty="isThreadWorktreeDirty"
              :worktree-change-summary="threadWorktreeChangeSummary"
              :branches="threadBranchOptions"
              :commits-by-branch="threadBranchCommitsByBranch"
              :commits-loading-for="threadBranchCommitsLoadingFor"
              :commits-error="threadBranchCommitsError"
              :commit-files-by-sha="threadCommitFilesBySha"
              :commit-files-loading-for="threadCommitFilesLoadingFor"
              :commit-files-error="threadCommitFilesError"
              :loading="isLoadingThreadBranches"
              :busy="isSwitchingThreadBranch"
              :error="threadBranchError"
              :review-open="isReviewPaneOpen"
              :show-review="route.name === 'thread' && selectedThreadId.length > 0"
              @toggle-review="onToggleContentHeaderReview"
              @checkout-branch="onCheckoutContentHeaderBranch"
              @reset-branch-to-commit="onResetContentHeaderBranchToCommit"
              @load-commits="loadThreadBranchCommits"
              @load-commit-files="loadThreadCommitFiles"
              @open-commit-file="onOpenContentHeaderCommitFile"
            />
          </template>
        </ContentHeader>

        <section class="content-body">
          <template v-if="isSkillsRoute">
            <DirectoryHub
              :cwd="directoryCwd"
              :thread-id="routeThreadId"
              :try-in-flight-key="directoryTryInFlightKey"
              @skills-changed="onSkillsChanged"
              @try-item="onTryDirectoryItem"
            />
          </template>
          <template v-else-if="isAutomationsRoute">
            <AutomationsPanel
              ref="automationsPanelRef"
              :groups="projectGroups"
              :project-cwd-by-name="projectCwdByName"
              :project-display-name-by-id="projectDisplayNameById"
              :selected-automation-id="routeAutomationId"
              @select-automation="onSelectAutomationInPanel"
              @edit-automation="onEditAutomationFromPanel"
              @create-automation="onCreateAutomationFromPanel"
            />
          </template>
          <template v-else-if="isHomeRoute">
            <div class="content-grid content-grid-home">
              <div class="new-thread-empty">
                <p class="new-thread-hero">{{ t("Let's build") }}</p>
                <ComposerDropdown class="new-thread-folder-dropdown" :model-value="newThreadCwd"
                  :options="newThreadFolderOptions" :placeholder="t('Choose folder')"
                  :enable-search="true"
                  :search-placeholder="t('Quick search project')"
                  :disabled="false" @update:model-value="onSelectNewThreadFolder" />
                <p v-if="newThreadCwd" class="new-thread-folder-selected" :title="newThreadCwd">
                  {{ t('Selected folder') }}: {{ newThreadCwd }}
                </p>
                <div class="new-thread-folder-actions">
                  <button class="new-thread-folder-action new-thread-folder-action-primary" type="button" @click="onOpenExistingFolder">
                    {{ t('Select folder') }}
                  </button>
                  <button class="new-thread-folder-action" type="button" @click="onOpenProjectSetupModal">
                    {{ t('Create Project') }}
                  </button>
                  <button class="new-thread-folder-action" type="button" :disabled="isProjectImporting" @click="onChooseProjectImportZip">
                    {{ isProjectImporting ? t('Importing…') : t('Import Project') }}
                  </button>
                  <input
                    ref="projectImportInputRef"
                    class="new-thread-project-import-input"
                    type="file"
                    accept=".zip,application/zip"
                    tabindex="-1"
                    aria-hidden="true"
                    @change="onDirectProjectImportFileChange"
                  />
                </div>


                <ComposerRuntimeDropdown
                  v-if="isNewThreadCwdGitRepo"
                  class="new-thread-runtime-dropdown"
                  v-model="newThreadRuntime"
                />
                <div v-if="newThreadRuntime === 'worktree'" class="new-thread-branch-select">
                  <p class="new-thread-branch-select-label">{{ t('Base branch') }}</p>
                  <ComposerDropdown
                    class="new-thread-branch-dropdown"
                    :model-value="newWorktreeBaseBranch"
                    :options="newWorktreeBranchDropdownOptions"
                    :placeholder="t('Select branch')"
                    :enable-search="true"
                    :search-placeholder="t('Search branches...')"
                    :disabled="isLoadingWorktreeBranches || newWorktreeBranchDropdownOptions.length === 0"
                    @update:model-value="onSelectNewWorktreeBranch"
                  />
                  <p class="new-thread-branch-select-help">
                    {{
                      isLoadingWorktreeBranches
                        ? t('Loading branches…')
                        : selectedWorktreeBranchLabel
                          ? t('New worktree branch will start from {branch}.', { branch: selectedWorktreeBranchLabel })
                          : t('No Git branches found for this folder.')
                    }}
                  </p>
                </div>
                <p v-if="isNewThreadCwdGitRepo" class="new-thread-runtime-help">
                  {{ t('Local project uses the selected folder directly. New worktree creates an isolated Git worktree before the first prompt.') }}
                </p>
                <div
                  v-if="worktreeInitStatus.phase !== 'idle'"
                  class="worktree-init-status"
                  :class="{
                    'is-running': worktreeInitStatus.phase === 'running',
                    'is-error': worktreeInitStatus.phase === 'error',
                  }"
                >
                  <strong class="worktree-init-status-title">{{ worktreeInitStatus.title }}</strong>
                  <span class="worktree-init-status-message">{{ worktreeInitStatus.message }}</span>
                </div>
              </div>

              <div class="composer-with-queue">
                <div v-if="codexCliMissingError" class="composer-runtime-error" role="alert">
                  <span>{{ t(codexCliMissingError) }}</span>
                  <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, codexCliMissingError)">{{ t('Send feedback') }}</a>
                </div>
                <ThreadTerminalPanel
                  v-if="homeTerminalOpen && composerCwd"
                  ref="homeTerminalPanelRef"
                  class="content-thread-terminal-panel"
                  :thread-id="composerThreadContextId"
                  :cwd="composerCwd"
                  @hide="onHideHomeTerminal"
                  @terminal-focus-change="onTerminalFocusChange"
                />
                <ThreadComposer ref="homeThreadComposerRef" :active-thread-id="composerThreadContextId"
                  :cwd="composerCwd"
                  :collaboration-modes="availableCollaborationModes"
                  :selected-collaboration-mode="selectedCollaborationMode"
                  :models="availableModelIds" :selected-model="composerSelectedModelId"
                  :selected-reasoning-effort="composerReasoningEffort"
                  :reasoning-effort-options="composerReasoningOptions"
                  :selected-speed-mode="selectedSpeedMode"
                  :is-updating-speed-mode="isUpdatingSpeedMode"
                  :skills="installedSkills"
                  :thread-token-usage="selectedThreadTokenUsage"
                  :codex-quota="codexQuota"
                  :is-turn-in-progress="false"
                  :is-stop-pending="false"
                  :is-interrupting-turn="false" :send-with-enter="sendWithEnter" :in-progress-submit-mode="inProgressSendMode"
                  :dictation-click-to-toggle="dictationClickToToggle" :dictation-auto-send="dictationAutoSend"
                  :dictation-language="dictationLanguage"
                  @submit="onSubmitThreadMessage"
                  @update:selected-collaboration-mode="onSelectCollaborationMode"
                  @update:selected-model="onSelectModel"
                  @update:selected-reasoning-effort="onSelectReasoningEffort"
                  @update:selected-speed-mode="onSelectSpeedMode" />
              </div>
            </div>
          </template>
          <template v-else-if="route.name === 'thread'">
            <div class="content-grid">
              <ReviewPane
                v-if="isReviewPaneOpen && selectedThreadId && composerCwd"
                :thread-id="selectedThreadId"
                :cwd="composerCwd"
                :is-thread-in-progress="isSelectedThreadInProgress"
                :initial-file-path="reviewInitialFilePath"
                :commit-sha="reviewInitialCommitSha"
                @close="isReviewPaneOpen = false"
              />

              <template v-else>
                <div class="content-thread">
                  <ThreadConversation ref="threadConversationRef" :messages="filteredMessages" :is-loading="isLoadingMessages"
                    :active-thread-id="composerThreadContextId" :cwd="composerCwd"
                    :live-overlay="liveOverlay"
                    :pending-requests="selectedThreadServerRequests"
                    :has-more-persisted-above="hasMoreOlderMessages"
                    :is-loading-persisted-above="isLoadingOlderMessages"
                    :load-earlier-messages="loadOlderMessages"
                    @fork-thread="onForkThreadFromMessage"
                    @rollback="onRollback"
                    @implement-plan="onImplementPlan"
                    @respond-server-request="onRespondServerRequest" />
                </div>

                <div class="composer-with-queue">
                  <div v-if="codexCliMissingError" class="composer-runtime-error" role="alert">
                    <span>{{ t(codexCliMissingError) }}</span>
                    <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, codexCliMissingError)">{{ t('Send feedback') }}</a>
                  </div>
                  <QueuedMessages
                    v-if="selectedThreadQueuedMessages.length > 0"
                    :messages="selectedThreadQueuedMessages"
                    @edit="onEditQueuedMessage"
                    @steer="steerQueuedMessage"
                    @delete="removeQueuedMessage"
                    @reorder="onReorderQueuedMessage"
                  />
                  <ThreadTerminalPanel
                    v-if="selectedThreadTerminalOpen && selectedThreadId && composerCwd"
                    ref="threadTerminalPanelRef"
                    class="content-thread-terminal-panel"
                    :thread-id="selectedThreadId"
                    :cwd="composerCwd"
                    @hide="onHideSelectedThreadTerminal"
                    @terminal-focus-change="onTerminalFocusChange"
                  />
                  <ThreadGoalPanel
                    ref="threadGoalPanelRef"
                    :thread-id="selectedThreadId"
                    :in-progress="isSelectedThreadInProgress"
                  />
                  <ThreadPendingRequestPanel
                    v-if="selectedThreadPendingRequest"
                    :request="selectedThreadPendingRequest"
                    :request-count="selectedThreadServerRequests.length"
                    :has-queue-above="selectedThreadQueuedMessages.length > 0"
                    @respond-server-request="onRespondServerRequest"
                  />
                  <ThreadComposer
                    v-else
                    ref="threadComposerRef"
                    :active-thread-id="composerThreadContextId"
                    :cwd="composerCwd"
                    :collaboration-modes="availableCollaborationModes"
                    :selected-collaboration-mode="selectedCollaborationMode"
                    :models="availableModelIds"
                    :selected-model="composerSelectedModelId"
                    :selected-reasoning-effort="composerReasoningEffort"
                    :reasoning-effort-options="composerReasoningOptions"
                    :selected-speed-mode="selectedSpeedMode"
                    :is-updating-speed-mode="isUpdatingSpeedMode"
                    :skills="installedSkills"
                    :thread-token-usage="selectedThreadTokenUsage"
                    :codex-quota="codexQuota"
                    :is-turn-in-progress="isSelectedThreadInProgress"
                    :is-stop-pending="isSelectedThreadInterruptPending"
                    :is-interrupting-turn="isInterruptingTurn"
                    :has-queue-above="selectedThreadQueuedMessages.length > 0"
                    :send-with-enter="sendWithEnter" :in-progress-submit-mode="inProgressSendMode"
                    :dictation-click-to-toggle="dictationClickToToggle" :dictation-auto-send="dictationAutoSend"
                    :dictation-language="dictationLanguage"
                    @update:selected-collaboration-mode="onSelectCollaborationMode"
                    @submit="onSubmitThreadMessage" @update:selected-model="onSelectModel"
                    @update:selected-reasoning-effort="onSelectReasoningEffort"
                    @update:selected-speed-mode="onSelectSpeedMode"
                    @edit-goal="pendingGoalEdit = route.fullPath"
                    @interrupt="onInterruptTurn" />
                </div>
              </template>
            </div>
          </template>
        </section>
      </section>
    </template>
  </DesktopLayout>
  <div v-if="projectLoadError" role="alert">{{ projectLoadError }} <button type="button" @click="retryProject">Retry</button></div>
  <ProjectDialogs v-if="isExistingFolderPickerOpen || isProjectSetupModalOpen || projectZipExportStatus.phase !== 'idle'" :context="projectContext" />

  <div
    v-if="isCodexLoginModalOpen"
    class="codex-login-modal-backdrop"
    role="presentation"
    @click="onCancelCodexLoginModal"
  >
    <form
      class="codex-login-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="t('Complete Codex login')"
      @submit.prevent="onSubmitCodexLoginCallback"
      @click.stop
    >
      <div class="codex-login-modal-header">
        <h2 class="codex-login-modal-title">{{ t('Complete Codex login') }}</h2>
        <button
          class="codex-login-modal-close"
          type="button"
          :aria-label="t('Close')"
          :disabled="isCompletingCodexLogin"
          @click="onCancelCodexLoginModal"
        >
          ×
        </button>
      </div>
      <p class="codex-login-modal-copy">
        {{ t('Finish login in the browser, then paste the localhost callback URL here.') }}
      </p>
      <a
        v-if="codexLoginUrl"
        class="codex-login-modal-link"
        :href="codexLoginUrl"
        target="_blank"
        rel="noreferrer"
      >
        {{ t('Open login URL') }}
      </a>
      <input
        ref="codexLoginCallbackInputRef"
        v-model="codexLoginCallbackUrl"
        class="codex-login-modal-input"
        type="url"
        inputmode="url"
        :placeholder="t('Paste localhost callback URL')"
        :disabled="isCompletingCodexLogin"
      >
      <div v-if="accountActionError" class="codex-login-modal-error visible-error-with-feedback">
        <span>{{ accountActionError }}</span>
        <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, accountActionError)">{{ t('Send feedback') }}</a>
      </div>
      <div class="codex-login-modal-actions">
        <button
          class="codex-login-modal-cancel"
          type="button"
          :disabled="isCompletingCodexLogin"
          @click="onCancelCodexLoginModal"
        >
          {{ t('Cancel') }}
        </button>
        <button
          class="codex-login-modal-submit"
          type="submit"
          :disabled="isCompletingCodexLogin || codexLoginCallbackUrl.trim().length === 0"
        >
          {{ isCompletingCodexLogin ? t('Completing…') : t('Complete') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { deferredActions } from './features/deferredActions'
import { lazyFeature } from './features/lazyFeature'
import IconTablerTerminal from './components/icons/IconTablerTerminal.vue'
import ComposerRuntimeDropdown from './components/content/ComposerRuntimeDropdown.vue'
import ComposerDropdown from './components/content/ComposerDropdown.vue'
import ContentHeader from './components/content/ContentHeader.vue'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DesktopLayout from './components/layout/DesktopLayout.vue'
import SidebarThreadTree from './components/sidebar/SidebarThreadTree.vue'

const ThreadGoalPanel = defineAsyncComponent(() => import('./components/content/ThreadGoalPanel.vue'))
import ThreadComposer from './components/content/ThreadComposer.vue'

import SidebarThreadControls from './components/sidebar/SidebarThreadControls.vue'
import IconTablerBolt from './components/icons/IconTablerBolt.vue'
import IconTablerSearch from './components/icons/IconTablerSearch.vue'
import IconTablerSettings from './components/icons/IconTablerSettings.vue'

import IconTablerX from './components/icons/IconTablerX.vue'
import { useDesktopState } from './composables/useDesktopState'
import { useMobile } from './composables/useMobile'
import { useUiLanguage } from './composables/useUiLanguage'
import { useFeedbackDiagnostics } from './composables/useFeedbackDiagnostics'
import { checkoutGitBranch, createPermanentWorktree, createWorktree, createProjectlessThreadDirectory, getGitBranchState, getGitBranchCommits, getGitCommitFiles, getGitRepositoryStatus, getReviewSummary, getWorktreeBranchOptions, getAccounts, completeCodexLogin, getHomeDirectory, getProjectRootSuggestion, getThreadTerminalQuickCommands, getThreadTerminalStatus, getWorkspaceRootsState, importProjectZip, openProjectRoot, refreshAccountsFromAuth, resetGitBranchToCommit, searchThreads } from './api/codexGateway'
import type { ReasoningEffort, SpeedMode, UiAccountEntry, UiServerRequest, UiServerRequestReply, UiThreadAutomation, UiThreadTokenUsage } from './types/codex'
import type { ComposerDraftPayload, ThreadComposerExposed } from './components/content/ThreadComposer.vue'
import type { GitCommitFileChange, GitCommitOption, LocalDirectoryEntry, TelegramStatus, ThreadTerminalQuickCommand, WorktreeBranchOption } from './api/codexGateway'
import { getFreeModeStatus } from './api/codexGateway'
import { getPathLeafName, getPathParent, isProjectlessChatPath, normalizePathForUi } from './pathUtils.js'
import { copyTextToClipboard } from './utils/clipboard'

// Load conditional panels only when their existing v-if guards render them.
// Queue controls are only needed once a thread has queued messages.
const SettingsContent = lazyFeature(() => import('./features/SettingsContent.vue'))
const QueuedMessages = defineAsyncComponent(() => import('./components/content/QueuedMessages.vue'))
const RateLimitStatus = defineAsyncComponent(() => import('./components/content/RateLimitStatus.vue'))
const ThreadPendingRequestPanel = defineAsyncComponent(() => import('./components/content/ThreadPendingRequestPanel.vue'))
const HeaderGitBranchDropdown = defineAsyncComponent(() => import('./components/content/HeaderGitBranchDropdown.vue'))
const ThreadConversation = defineAsyncComponent(() => import('./components/content/ThreadConversation.vue'))
const ThreadTerminalPanel = defineAsyncComponent(() => import('./components/content/ThreadTerminalPanel.vue'))
const ReviewPane = defineAsyncComponent(() => import('./components/content/ReviewPane.vue'))
const DirectoryHub = defineAsyncComponent(() => import('./components/content/DirectoryHub.vue'))
const AutomationsPanel = defineAsyncComponent(() => import('./components/content/AutomationsPanel.vue'))
const { t, uiLanguage, uiLanguageOptions, setUiLanguage } = useUiLanguage()

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'codex-web-local.sidebar-collapsed.v1'
const ACCOUNTS_SECTION_COLLAPSED_STORAGE_KEY = 'codex-web-local.accounts-section-collapsed.v1'
const TERMINAL_QUICK_COMMAND_STORAGE_KEY = 'codex-web-local.terminal-quick-commands.v1'
const TOGGLE_TERMINAL_COMMAND_VALUE = '__toggle_terminal__'
const worktreeName = import.meta.env.VITE_WORKTREE_NAME ?? 'unknown'
const appVersion = import.meta.env.VITE_APP_VERSION ?? 'unknown'
const SETTINGS_HELP = {
  sendWithEnter: t('When enabled, press Enter to send. When disabled, use Command+Enter to send.'),
  inProgressSendMode: t('If a turn is still running, choose whether a new prompt should steer the current turn or be queued.'),
  appearance: t('Switch between system theme, light mode, and dark mode.'),
  chatWidth: t('Choose how wide the conversation column and composer can grow on desktop screens.'),
  dictationClickToToggle: t('Use click-to-start and click-to-stop dictation instead of hold-to-talk.'),
  dictationAutoSend: t('Automatically send transcribed dictation when recording stops.'),
  dictationLanguage: t('Choose transcription language or keep auto-detect.'),
} as const

type ChatWidthMode = 'standard' | 'wide' | 'extra-wide'

type TerminalHeaderQuickCommand = {
  label: string
  value: string
  custom?: boolean
  usageCount: number
  lastUsedAt: number
  sourceIndex?: number
}

type ThreadTerminalPanelExposed = {
  runQuickCommand: (command: string, custom?: boolean) => Promise<void>
}

type DirectoryTryItemPayload = {
  kind: 'app' | 'plugin' | 'skill' | 'composio'
  name: string
  displayName: string
  skillPath?: string
  prompt?: string
  attachedSkills?: Array<{ name: string; path: string }>
}

type ChatWidthPreset = {
  label: string
  columnMax: string
  cardMax: string
}

const CHAT_WIDTH_PRESETS: Record<ChatWidthMode, ChatWidthPreset> = {
  standard: {
    label: 'Standard',
    columnMax: '45rem',
    cardMax: '76ch',
  },
  wide: {
    label: 'Wide',
    columnMax: '72rem',
    cardMax: '88ch',
  },
  'extra-wide': {
    label: 'Extra wide',
    columnMax: '96rem',
    cardMax: '96ch',
  },
}

const WHISPER_LANGUAGES: Record<string, string> = {
  en: 'english',
  zh: 'chinese',
  de: 'german',
  es: 'spanish',
  ru: 'russian',
  ko: 'korean',
  fr: 'french',
  ja: 'japanese',
  pt: 'portuguese',
  tr: 'turkish',
  pl: 'polish',
  ca: 'catalan',
  nl: 'dutch',
  ar: 'arabic',
  sv: 'swedish',
  it: 'italian',
  id: 'indonesian',
  hi: 'hindi',
  fi: 'finnish',
  vi: 'vietnamese',
  he: 'hebrew',
  uk: 'ukrainian',
  el: 'greek',
  ms: 'malay',
  cs: 'czech',
  ro: 'romanian',
  da: 'danish',
  hu: 'hungarian',
  ta: 'tamil',
  no: 'norwegian',
  th: 'thai',
  ur: 'urdu',
  hr: 'croatian',
  bg: 'bulgarian',
  lt: 'lithuanian',
  la: 'latin',
  mi: 'maori',
  ml: 'malayalam',
  cy: 'welsh',
  sk: 'slovak',
  te: 'telugu',
  fa: 'persian',
  lv: 'latvian',
  bn: 'bengali',
  sr: 'serbian',
  az: 'azerbaijani',
  sl: 'slovenian',
  kn: 'kannada',
  et: 'estonian',
  mk: 'macedonian',
  br: 'breton',
  eu: 'basque',
  is: 'icelandic',
  hy: 'armenian',
  ne: 'nepali',
  mn: 'mongolian',
  bs: 'bosnian',
  kk: 'kazakh',
  sq: 'albanian',
  sw: 'swahili',
  gl: 'galician',
  mr: 'marathi',
  pa: 'punjabi',
  si: 'sinhala',
  km: 'khmer',
  sn: 'shona',
  yo: 'yoruba',
  so: 'somali',
  af: 'afrikaans',
  oc: 'occitan',
  ka: 'georgian',
  be: 'belarusian',
  tg: 'tajik',
  sd: 'sindhi',
  gu: 'gujarati',
  am: 'amharic',
  yi: 'yiddish',
  lo: 'lao',
  uz: 'uzbek',
  fo: 'faroese',
  ht: 'haitian creole',
  ps: 'pashto',
  tk: 'turkmen',
  nn: 'nynorsk',
  mt: 'maltese',
  sa: 'sanskrit',
  lb: 'luxembourgish',
  my: 'myanmar',
  bo: 'tibetan',
  tl: 'tagalog',
  mg: 'malagasy',
  as: 'assamese',
  tt: 'tatar',
  haw: 'hawaiian',
  ln: 'lingala',
  ha: 'hausa',
  ba: 'bashkir',
  jw: 'javanese',
  su: 'sundanese',
  yue: 'cantonese',
}

const {
  projectGroups,
  projectDisplayNameById,
  selectedThread,
  selectedThreadTokenUsage,
  selectedThreadTerminalOpen,
  selectedThreadServerRequests,
  selectedLiveOverlay,
  codexQuota,
  selectedThreadId,
  availableCollaborationModes,
  availableModelIds,
  selectedCollaborationMode,
  selectedModelId,
  selectedSpeedMode,
  codexCliMissingError,
  installedSkills,
  accountRateLimitSnapshots,
  messages,
  hasMoreOlderMessages,
  isLoadingThreads,
  isThreadListFullyLoaded,
  isLoadingMessages,
  isLoadingOlderMessages,
  isSendingMessage,
  isInterruptingTurn,
  isSelectedThreadInterruptPending,
  isUpdatingSpeedMode,
  error: desktopError,
  refreshAll,
  refreshWorkspaceRoots,
  refreshSkills,
  selectThread,
  ensureThreadMessagesLoaded,
  loadOlderMessages,
  setThreadTerminalOpen,
  toggleSelectedThreadTerminal,
  archiveThreadById,
  forkThreadById,
  renameThreadById,
  forkThreadFromTurn,
  sendMessageToSelectedThread,
  sendMessageToNewThread,
  interruptSelectedThreadTurn,
  selectedThreadQueuedMessages,
  removeQueuedMessage,
  reorderQueuedMessage,
  steerQueuedMessage,
  setSelectedCollaborationMode,
  readModelIdForThread,
  readReasoningEffortForThread,
  readReasoningOptionsForThread,
  setSelectedModelIdForThread,

  setSelectedReasoningEffort,
  updateSelectedSpeedMode,
  respondToPendingServerRequest,
  renameProject,
  removeProject,
  reorderProject,
  pinProjectToTop,
  startPolling,
  stopPolling,
  primeSelectedThread,
  rollbackSelectedThread,
} = useDesktopState()

const route = useRoute()
const router = useRouter()
const { isMobile } = useMobile()
type SidebarThreadTreeExposed = {
  openAutomationEditorFromPanel: (payload: AutomationEditRequest) => void
  openAutomationCreatorFromPanel: () => void
}
type AutomationsPanelExposed = {
  loadAutomations: () => Promise<void>
}
type AutomationEditRequest = {
  scope: 'thread' | 'project'
  target: string
  automation: UiThreadAutomation
}
const sidebarThreadTreeRef = ref<SidebarThreadTreeExposed | null>(null)
const automationsPanelRef = ref<AutomationsPanelExposed | null>(null)
const {
  buildFeedbackMailto,
  feedbackMailtoBase,
  recordVisibleFailure,
} = useFeedbackDiagnostics()
const feedbackMailto = feedbackMailtoBase()

function prepareFeedbackLink(event: MouseEvent, message?: string): void {
  if (message) {
    recordVisibleFailure(message)
  }
  const target = event.currentTarget
  if (target instanceof HTMLAnchorElement) {
    target.href = buildFeedbackMailto()
  }
}
const homeThreadComposerRef = ref<ThreadComposerExposed | null>(null)
const threadGoalPanelRef = ref<InstanceType<typeof ThreadGoalPanel> | null>(null)
const pendingGoalEdit = ref('')
watch([threadGoalPanelRef, () => route.fullPath, pendingGoalEdit], () => {
  if (!pendingGoalEdit.value) return
  if (pendingGoalEdit.value !== route.fullPath) { pendingGoalEdit.value = ''; return }
  if (threadGoalPanelRef.value) {
    pendingGoalEdit.value = ''
    threadGoalPanelRef.value.edit()
  }
}, { flush: 'post' })
const threadComposerRef = ref<ThreadComposerExposed | null>(null)
const threadConversationRef = ref<{ jumpToLatest: () => void } | null>(null)
const homeTerminalPanelRef = ref<ThreadTerminalPanelExposed | null>(null)
const threadTerminalPanelRef = ref<ThreadTerminalPanelExposed | null>(null)
const homeTerminalOpen = ref(false)
const isTerminalInputFocused = ref(false)
const isTerminalKeyboardFocusFallbackActive = ref(false)
const isThreadTerminalAvailable = ref(true)
const terminalProjectQuickCommands = ref<ThreadTerminalQuickCommand[]>([])
const terminalStoredQuickCommands = ref<TerminalHeaderQuickCommand[]>(loadTerminalStoredQuickCommands())
const terminalHeaderDropdownValue = ref('')
const editingQueuedMessageState = ref<{ threadId: string; queueIndex: number; message: (typeof selectedThreadQueuedMessages.value)[number] } | null>(null)
const isRouteSyncInProgress = ref(false)
const directoryTryInFlightKey = ref('')
let hasPendingRouteSync = false
const hasInitialized = ref(false)
const newThreadCwd = ref('')
const newThreadRuntime = ref<'local' | 'worktree'>('local')
const gitRepoStatusByCwd = ref<Record<string, boolean>>({})
const gitRepoStatusRequestByCwd = new Map<string, Promise<boolean>>()
const newWorktreeBaseBranch = ref('')
const worktreeBranchOptions = ref<WorktreeBranchOption[]>([])
const isLoadingWorktreeBranches = ref(false)
const workspaceRootOptionsState = ref<{ order: string[]; labels: Record<string, string>; projectOrder: string[] }>({
  order: [],
  labels: {},
  projectOrder: [],
})
const projectZipExportStatus = ref<{ phase: 'idle' | 'exporting' | 'ready'; loaded: number; total: number | null; blob: Blob | null; fileName: string; error: string }>({
  phase: 'idle',
  loaded: 0,
  total: null,
  blob: null,
  fileName: '',
  error: '',
})
const worktreeInitStatus = ref<{ phase: 'idle' | 'running' | 'error'; title: string; message: string }>({
  phase: 'idle',
  title: '',
  message: '',
})
const isSidebarCollapsed = ref(loadSidebarCollapsed())
const sidebarSearchQuery = ref('')
const isSidebarSearchVisible = ref(false)
const sidebarScrollableRef = ref<HTMLElement | null>(null)
const sidebarSearchInputRef = ref<HTMLInputElement | null>(null)
const settingsAreaRef = ref<HTMLElement | null>(null)
const settingsPanelRef = ref<HTMLElement | null>(null)
const settingsButtonRef = ref<HTMLElement | null>(null)
const serverMatchedThreadIds = ref<string[] | null>(null)
let threadSearchTimer: ReturnType<typeof setTimeout> | null = null
let terminalKeyboardFocusFallbackTimer: ReturnType<typeof setTimeout> | null = null
let sidebarScrollTop = 0
let sidebarScrollRestoreRequestId = 0
let isRestoringSidebarScroll = false
let threadBranchesRequestId = 0
let threadBranchCommitsRequestId = 0
let threadCommitFilesRequestId = 0
let threadWorktreeSummaryRequestId = 0
const defaultNewProjectName = ref('New Project (1)')
const homeDirectory = ref('')
const isSettingsOpen = ref(false)
const isAccountsSectionCollapsed = ref(loadAccountsSectionCollapsed())
const isReviewPaneOpen = ref(false)
const reviewInitialFilePath = ref('')
const reviewInitialCommitSha = ref('')
const threadBranchOptions = ref<WorktreeBranchOption[]>([])
const currentThreadBranch = ref<string | null>(null)
const currentThreadHeadSha = ref<string | null>(null)
const currentThreadHeadSubject = ref<string | null>(null)
const currentThreadHeadDate = ref<string | null>(null)
const isThreadDetachedHead = ref(false)
const isThreadWorktreeDirty = ref(false)
const threadWorktreeChangeSummary = ref({ addedLineCount: 0, removedLineCount: 0 })
const threadBranchError = ref('')
const threadBranchCommitsByBranch = ref<Record<string, GitCommitOption[]>>({})
const threadBranchCommitsLoadingFor = ref('')
const threadBranchCommitsError = ref('')
const threadCommitFilesBySha = ref<Record<string, GitCommitFileChange[]>>({})
const threadCommitFilesLoadingFor = ref('')
const threadCommitFilesError = ref('')
const isLoadingThreadBranches = ref(false)
const isSwitchingThreadBranch = ref(false)

function toThreadBranchCommitsKey(branch: string, includeResetHistory: boolean): string {
  return `${branch}\u0000${includeResetHistory ? 'with-reset-history' : 'without-reset-history'}`
}

const createFolderInputRef = ref<HTMLInputElement | null>(null)
const accounts = ref<UiAccountEntry[]>([])
const isRefreshingAccounts = ref(false)
const isSwitchingAccounts = ref(false)
const isStartingCodexLogin = ref(false)
const isCompletingCodexLogin = ref(false)
const isCodexLoginModalOpen = ref(false)
const codexLoginUrl = ref('')
const codexLoginCallbackUrl = ref('')
const codexLoginCallbackInputRef = ref<HTMLInputElement | null>(null)
const removingAccountId = ref('')
const confirmingRemoveAccountId = ref('')
const hoveredAccountId = ref('')
const accountActionError = ref('')
const SEND_WITH_ENTER_KEY = 'codex-web-local.send-with-enter.v1'
const IN_PROGRESS_SEND_MODE_KEY = 'codex-web-local.in-progress-send-mode.v1'
const DARK_MODE_KEY = 'codex-web-local.dark-mode.v1'
const DICTATION_CLICK_TO_TOGGLE_KEY = 'codex-web-local.dictation-click-to-toggle.v1'
const DICTATION_AUTO_SEND_KEY = 'codex-web-local.dictation-auto-send.v1'
const DICTATION_LANGUAGE_KEY = 'codex-web-local.dictation-language.v1'

const CHAT_WIDTH_KEY = 'codex-web-local.chat-width.v1'
const sendWithEnter = ref(loadBoolPref(SEND_WITH_ENTER_KEY, true))
const inProgressSendMode = ref<'steer' | 'queue'>(loadInProgressSendModePref())
const darkMode = ref<'system' | 'light' | 'dark'>(loadDarkModePref())
const chatWidth = ref<ChatWidthMode>(loadChatWidthPref())
const dictationClickToToggle = ref(loadBoolPref(DICTATION_CLICK_TO_TOGGLE_KEY, false))
const dictationAutoSend = ref(loadBoolPref(DICTATION_AUTO_SEND_KEY, true))
const dictationLanguage = ref(loadDictationLanguagePref())
const dictationLanguageOptions = computed(() => buildDictationLanguageOptions())
const projectZipProgressText = computed(() => {
  const { loaded, total } = projectZipExportStatus.value
  const loadedLabel = formatByteCount(loaded)
  if (total && total > 0) {
    return `${loadedLabel} / ${formatByteCount(total)}`
  }
  return loaded > 0 ? loadedLabel : t('Preparing...')
})
const projectZipProgressWidth = computed(() => {
  const { loaded, total, phase } = projectZipExportStatus.value
  if (phase === 'ready') return '100%'
  if (!total || total <= 0) return loaded > 0 ? '55%' : '20%'
  return `${Math.min(100, Math.max(5, Math.round((loaded / total) * 100)))}%`
})
const freeModeEnabled = ref(false)
const freeModeLoading = ref(false)
const freeModeCustomKey = ref('')
const freeModeHasCustomKey = ref(false)
const freeModeCustomKeyMasked = ref<string | null>(null)
const freeModeCustomKeySaving = ref(false)
const providerError = ref('')
const selectedProvider = ref<'codex' | 'openrouter' | 'opencode-zen' | 'custom'>('codex')
const providerDropdownOptions = computed(() => [
  { value: 'codex', label: t('Codex') },
  { value: 'openrouter', label: t('OpenRouter') },
  { value: 'opencode-zen', label: t('OpenCode Zen') },
  { value: 'custom', label: t('Custom endpoint') },
])
const customEndpointUrl = ref('')
const customEndpointKey = ref('')
const customEndpointWireApi = ref<'responses' | 'chat'>('responses')
const openRouterWireApi = ref<'responses' | 'chat'>('responses')
const opencodeZenKey = ref('')
const isTelegramConfigOpen = ref(false)
const telegramBotTokenDraft = ref('')
const telegramAllowedUserIdsDraft = ref('')
const telegramNotifyEnabledDraft = ref(false)
const telegramNotifyChatIdDraft = ref('')
const telegramAppUrlDraft = ref('')
const telegramConfigError = ref('')
const isTelegramSaving = ref(false)
const isTelegramTesting = ref(false)
const telegramTestError = ref('')
const savedTelegramDraft = ref('')
const telegramDraftSnapshot = () => JSON.stringify([telegramBotTokenDraft.value, telegramAllowedUserIdsDraft.value, telegramNotifyEnabledDraft.value, telegramNotifyChatIdDraft.value, telegramAppUrlDraft.value])
const telegramTestUnavailable = computed(() => {
  if (isTelegramTesting.value) return t('Sending test notification…')
  if (isTelegramSaving.value) return t('Wait until settings are saved.')
  if (!telegramBotTokenDraft.value.trim()) return t('Configure a bot token before testing.')
  const id = telegramNotifyChatIdDraft.value.trim()
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return t('Configure a valid private notification chat ID before testing.')
  if (!savedTelegramDraft.value || telegramDraftSnapshot() !== savedTelegramDraft.value) return t('Save configuration changes before testing.')
  return ''
})
const telegramNotificationStatusText = computed(() => {
  const status = telegramStatus.value.notification
  if (!status?.lastTestResult && !status?.lastSuccessAt && !status?.lastFailureAt) return t('Not verified')
  if (status.lastTestResult === 'failure') return t('Test notification failed')
  if (status.lastError) return t('Notification delivery failed')
  if (status.lastTestResult === 'success') return t('Test notification sent successfully')
  return t('Last notification sent successfully')
})
const isCreateFolderOpen = ref(false)
const createFolderDraft = ref('')
const createFolderError = ref('')
const isCreatingFolder = ref(false)
const isProjectSetupModalOpen = ref(false)
const projectSetupMode = ref<'create' | 'clone'>('create')
const projectSetupBaseDir = ref('')
const projectNameDraft = ref('')
const githubCloneUrlDraft = ref('')
const isProjectImporting = ref(false)
const projectSetupError = ref('')
const isProjectSetupSubmitting = ref(false)
const projectSetupPrimaryInputRef = ref<HTMLInputElement | null>(null)
const projectImportInputRef = ref<HTMLInputElement | null>(null)
const isExistingFolderPickerOpen = ref(false)
const existingFolderPathInputRef = ref<HTMLInputElement | null>(null)
const existingFolderFilterInputRef = ref<HTMLInputElement | null>(null)
const existingFolderPathDraft = ref('')
const existingFolderBrowsePath = ref('')
const existingFolderParentPath = ref('')
const existingFolderEntries = ref<LocalDirectoryEntry[]>([])
const existingFolderError = ref('')
const isExistingFolderLoading = ref(false)
const isOpeningExistingFolder = ref(false)
const showHiddenFolders = ref(false)
const existingFolderFilter = ref('')
const visibleFeedbackErrors = [
  desktopError,
  codexCliMissingError,
  threadBranchError,
  threadBranchCommitsError,
  accountActionError,
  providerError,
  telegramConfigError,
  createFolderError,
  projectSetupError,
  existingFolderError,
]
const hasVisibleFeedbackError = computed(() => visibleFeedbackErrors.some((entry) => entry.value.trim().length > 0))
const telegramStatus = ref<TelegramStatus>({
  configured: false,
  active: false,
  mappedChats: 0,
  mappedThreads: 0,
  allowedUsers: 0,
  allowAllUsers: false,
  lastError: '',
})
let workspaceRootsResumeTimer: ReturnType<typeof setTimeout> | null = null
let workspaceRootsResumeInProgress = false
let lastWorkspaceRootsResumeAt = 0
const visualViewportHeight = ref(typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 0)
const visualViewportOffsetTop = ref(typeof window !== 'undefined' ? window.visualViewport?.offsetTop ?? 0 : 0)
const layoutViewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
let accountStatePollTimer: number | null = null
let isAccountStatePollInFlight = false
let externalCodexAuthAvailable = false
let externalAuthImportAttempted = false
const existingFolderBrowseRequestId = ref(0)

const routeThreadId = computed(() => {
  const rawThreadId = route.params.threadId
  return typeof rawThreadId === 'string' ? rawThreadId : ''
})

const isHomeRoute = computed(() => route.name === 'home')
const isSkillsRoute = computed(() => route.name === 'skills')
const isAutomationsRoute = computed(() => route.name === 'automations')
const routeAutomationId = computed(() => {
  const raw = route.query.automationId
  return typeof raw === 'string' ? raw : ''
})
const contentTitle = computed(() => {
  if (isAutomationsRoute.value) return t('Automations')
  if (isSkillsRoute.value) return t('Skills')
  if (isHomeRoute.value) return t('Start new thread')
  return selectedThread.value?.title ?? t('Choose a thread')
})
const browserHostName =
  typeof window !== 'undefined'
    ? (window.location.hostname || window.location.host || 'codexui')
    : 'codexui'
const pageTitle = computed(() => {
  const threadTitle = selectedThread.value?.title?.trim() ?? ''
  return threadTitle || browserHostName
})
const filteredMessages = computed(() =>
  messages.value.filter((message) => {
    const type = normalizeMessageType(message.messageType, message.role)
    if (type === 'worked') return true
    if (type === 'turnActivity.live' || type === 'turnError.live' || type === 'agentReasoning.live') return false
    return true
  }),
)
const latestUserTurnId = computed(() => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message.role !== 'user') continue
    const turnId = message.turnId?.trim() ?? ''
    if (turnId.length > 0) return turnId
  }
  return ''
})
const liveOverlay = computed(() => selectedLiveOverlay.value)
const composerThreadContextId = computed(() => (isHomeRoute.value ? '__new-thread__' : selectedThreadId.value))
const composerReasoningEffort = computed(() => readReasoningEffortForThread(composerThreadContextId.value))
const composerReasoningOptions = computed(() => readReasoningOptionsForThread(composerThreadContextId.value))
const composerSelectedModelId = computed(() => readModelIdForThread(composerThreadContextId.value))
const selectedThreadPendingRequest = computed<UiServerRequest | null>(() => {
  const rows = selectedThreadServerRequests.value
  return rows.length > 0 ? rows[rows.length - 1] : null
})
const composerCwd = computed(() => {
  if (isHomeRoute.value) return newThreadCwd.value.trim()
  return selectedThread.value?.cwd?.trim() ?? ''
})
const canShowTerminalToggle = computed(() => (
  isThreadTerminalAvailable.value && (
    (isHomeRoute.value && composerCwd.value.length > 0) ||
    (route.name === 'thread' && selectedThreadId.value.length > 0)
  )
))
const canShowContentHeaderBranchDropdown = computed(() => (
  (route.name === 'thread' && selectedThreadId.value.length > 0) ||
  (isHomeRoute.value && isNewThreadCwdGitRepo.value)
))
const isComposerTerminalOpen = computed(() => (
  isHomeRoute.value ? homeTerminalOpen.value : selectedThreadTerminalOpen.value
))
const isVirtualKeyboardOpen = computed(() => {
  if (!isMobile.value) return false
  if (visualViewportHeight.value <= 0 || layoutViewportHeight.value <= 0) return false
  return layoutViewportHeight.value - visualViewportHeight.value > 120
})
const isTerminalKeyboardLayoutActive = computed(() => (
  isVirtualKeyboardOpen.value ||
  (isComposerTerminalOpen.value && isTerminalKeyboardFocusFallbackActive.value)
))
const directoryCwd = computed(() => selectedThread.value?.cwd?.trim() ?? newThreadCwd.value.trim())
const isSelectedThreadInProgress = computed(() => !isHomeRoute.value && selectedThread.value?.inProgress === true)
const showThreadContextBadge = computed(() => !isHomeRoute.value && !isSkillsRoute.value && !isAutomationsRoute.value && selectedThreadId.value.trim().length > 0)
const isAccountSwitchBlocked = computed(() =>
  isSendingMessage.value ||
  isInterruptingTurn.value ||
  isSelectedThreadInProgress.value ||
  selectedThreadServerRequests.value.length > 0,
)

function formatCompactTokenCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(Math.max(0, Math.trunc(value)))
}

function buildThreadContextTooltip(usage: UiThreadTokenUsage | null): string {
  if (!usage) {
    return t('Waiting for Codex thread/tokenUsage/updated events for this thread.')
  }

  const lines = [
    `${t('Current context usage')}: ${usage.currentContextTokens.toLocaleString()} ${t('tokens')}`,
    `${t('Cumulative thread usage')}: ${usage.total.totalTokens.toLocaleString()} ${t('tokens')}`,
  ]

  if (typeof usage.modelContextWindow === 'number') {
    lines.unshift(`${t('Model context window')}: ${usage.modelContextWindow.toLocaleString()} ${t('tokens')}`)
    lines.push(`${t('Remaining context')}: ${(usage.remainingContextTokens ?? 0).toLocaleString()} ${t('tokens')}`)
  } else {
    lines.push(t('Model context window is unavailable in the latest usage event.'))
  }

  return lines.join('\n')
}

const threadContextBadgeState = computed(() => {
  const remainingPercent = selectedThreadTokenUsage.value?.remainingContextPercent
  if (remainingPercent === null || typeof remainingPercent !== 'number') return 'pending'
  if (remainingPercent <= 10) return 'danger'
  if (remainingPercent <= 25) return 'warning'
  return 'ok'
})

const threadContextPrimaryText = computed(() => {
  const usage = selectedThreadTokenUsage.value
  if (!usage) return t('Awaiting data')
  if (typeof usage.remainingContextTokens === 'number') {
    return `${formatCompactTokenCount(usage.remainingContextTokens)} ${t('left')}`
  }
  return `${formatCompactTokenCount(usage.currentContextTokens)} ${t('used')}`
})

const threadContextSecondaryText = computed(() => {
  const usage = selectedThreadTokenUsage.value
  if (!usage) return t('Updates after the next token usage event')
  if (typeof usage.modelContextWindow === 'number') {
    return `${formatCompactTokenCount(usage.currentContextTokens)} ${t('used')} / ${formatCompactTokenCount(usage.modelContextWindow)}`
  }
  return t('Window size unavailable')
})

const threadContextTooltip = computed(() => buildThreadContextTooltip(selectedThreadTokenUsage.value))

function hasDuplicateFolderLeaf(path: string, knownPaths: string[]): boolean {
  const normalizedPath = normalizePathForUi(path).trim()
  const leafName = getPathLeafName(normalizedPath)
  if (!normalizedPath || !leafName) return false
  return knownPaths.some((knownPath) => {
    const normalizedKnownPath = normalizePathForUi(knownPath).trim()
    return normalizedKnownPath !== normalizedPath && getPathLeafName(normalizedKnownPath) === leafName
  })
}

function getFolderOptionLabel(path: string, fallbackLabel = ''): string {
  const normalizedPath = normalizePathForUi(path).trim()
  const explicitLabel = fallbackLabel.trim()
  if (explicitLabel) return explicitLabel
  const leafName = getPathLeafName(normalizedPath)
  const knownPaths = [
    ...workspaceRootOptionsState.value.order,
    ...projectGroups.value.map((group) => group.threads[0]?.cwd?.trim() ?? '').filter(Boolean),
  ]
  return hasDuplicateFolderLeaf(normalizedPath, knownPaths) ? normalizedPath : leafName
}

function getOrderedWorkspaceRootOptions(): string[] {
  const savedRoots = new Set(workspaceRootOptionsState.value.order)
  const orderedRoots = workspaceRootOptionsState.value.projectOrder.filter((item) => savedRoots.has(item))
  for (const rootPath of workspaceRootOptionsState.value.order) {
    if (!orderedRoots.includes(rootPath)) orderedRoots.push(rootPath)
  }
  return orderedRoots
}

function resolveWorkspaceRootCwd(projectName: string): string {
  const normalizedProjectName = normalizePathForUi(projectName).trim()
  if (!normalizedProjectName) return ''
  const knownPaths = [
    ...workspaceRootOptionsState.value.order,
    ...projectGroups.value.map((group) => group.threads[0]?.cwd?.trim() ?? '').filter(Boolean),
  ]
  for (const cwdRaw of workspaceRootOptionsState.value.order) {
    const cwd = normalizePathForUi(cwdRaw).trim()
    if (!cwd) continue
    const leafName = getPathLeafName(cwd)
    const orderName = hasDuplicateFolderLeaf(cwd, knownPaths) ? cwd : leafName
    if (cwd === normalizedProjectName || orderName === normalizedProjectName || leafName === normalizedProjectName) {
      return cwd
    }
  }
  return ''
}

const newThreadFolderOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = []
  const seenCwds = new Set<string>()

  for (const cwdRaw of getOrderedWorkspaceRootOptions()) {
    const cwd = cwdRaw.trim()
    if (!cwd || seenCwds.has(cwd)) continue
    seenCwds.add(cwd)
    options.push({
      value: cwd,
      label: getFolderOptionLabel(cwd, workspaceRootOptionsState.value.labels[cwd]),
    })
  }

  for (const group of projectGroups.value) {
    const cwd = group.threads[0]?.cwd?.trim() ?? ''
    if (!cwd || seenCwds.has(cwd) || isProjectlessChatPath(cwd)) continue
    seenCwds.add(cwd)
    options.push({
      value: cwd,
      label: getFolderOptionLabel(cwd, projectDisplayNameById.value[group.projectName]),
    })
  }

  const selectedCwd = newThreadCwd.value.trim()
  if (selectedCwd && !seenCwds.has(selectedCwd)) {
    options.unshift({
      value: selectedCwd,
      label: getFolderOptionLabel(selectedCwd),
    })
  }

  return options
})
const isNewThreadCwdGitRepo = computed(() => {
  const cwd = newThreadCwd.value.trim()
  return cwd ? gitRepoStatusByCwd.value[cwd] === true : false
})
const projectGitRepoByName = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}
  for (const group of projectGroups.value) {
    const cwd = resolvePreferredLocalCwd(group.projectName, group.threads[0]?.cwd?.trim() ?? '')
    result[group.projectName] = cwd ? gitRepoStatusByCwd.value[cwd] === true : false
  }
  return result
})
const newWorktreeBranchDropdownOptions = computed<Array<{ value: string; label: string }>>(() => {
  const selectedBranch = newWorktreeBaseBranch.value.trim()
  const options = [...worktreeBranchOptions.value]
  if (selectedBranch && !options.some((option) => option.value === selectedBranch)) {
    options.unshift({ value: selectedBranch, label: selectedBranch })
  }
  return options
})
const selectedWorktreeBranchLabel = computed(() => {
  const selectedBranch = newWorktreeBaseBranch.value.trim()
  if (!selectedBranch) return ''
  const selected = newWorktreeBranchDropdownOptions.value.find((option) => option.value === selectedBranch)
  return selected?.label ?? selectedBranch
})
const createFolderParentPath = computed(() => existingFolderBrowsePath.value.trim())
const isCreateFolderNameValid = computed(() => {
  const draft = createFolderDraft.value.trim()
  if (!draft) return false
  if (draft === '.' || draft === '..') return false
  return !/[\\/]/u.test(draft)
})
const canCreateFolder = computed(() => {
  return isCreateFolderNameValid.value && createFolderParentPath.value.trim().length > 0 && !existingFolderError.value
})
const isProjectNameDraftValid = computed(() => {
  const draft = projectNameDraft.value.trim()
  if (!draft) return false
  if (draft === '.' || draft === '..') return false
  return !/[\\/]/u.test(draft)
})
const canSubmitProjectSetup = computed(() => {
  const baseDir = projectSetupBaseDir.value.trim()
  if (!baseDir) return false
  if (projectSetupMode.value === 'create') return isProjectNameDraftValid.value
  return githubCloneUrlDraft.value.trim().length > 0
})
const resolvedExistingFolderPath = computed(() => {
  const draftedPath = normalizePathForUi(existingFolderPathDraft.value).trim()
  if (draftedPath) return draftedPath
  return existingFolderBrowsePath.value.trim()
})
const createFolderSubmitLabel = computed(() => {
  if (isCreatingFolder.value) return 'Creating…'
  return 'Create'
})
const projectSetupSubmitLabel = computed(() => {
  if (isProjectSetupSubmitting.value) {
    if (projectSetupMode.value === 'clone') return t('Cloning…')
    return t('Creating…')
  }
  if (projectSetupMode.value === 'clone') return t('Clone repository')
  return t('Create project')
})
const canBrowseExistingFolderParent = computed(() => {
  const current = existingFolderBrowsePath.value.trim()
  const parent = existingFolderParentPath.value.trim()
  return Boolean(current && parent && current !== parent)
})
const existingFolderDisplayEntries = computed(() => {
  const entries: Array<{ key: string; name: string; path: string; kind: 'parent' | 'directory' }> = []
  if (canBrowseExistingFolderParent.value) {
    entries.push({
      key: `parent:${existingFolderParentPath.value}`,
      name: '..',
      path: existingFolderParentPath.value,
      kind: 'parent',
    })
  }
  for (const entry of existingFolderEntries.value) {
    entries.push({
      key: `directory:${entry.path}`,
      name: entry.name,
      path: entry.path,
      kind: 'directory',
    })
  }
  return entries
})
const existingFolderFilteredEntries = computed(() => {
  const filter = existingFolderFilter.value.trim().toLowerCase()
  if (!filter) return existingFolderDisplayEntries.value
  return existingFolderDisplayEntries.value.filter((entry) =>
    entry.kind === 'parent' || entry.name.toLowerCase().includes(filter),
  )
})
const darkModeMediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const chatWidthLabel = computed(() => t(CHAT_WIDTH_PRESETS[chatWidth.value].label))
const terminalShortcutLabel = computed(() => {
  if (typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform)) {
    return '⌘J'
  }
  return 'Ctrl+J'
})
const terminalCommandPlaceholder = computed(() => (
  isComposerTerminalOpen.value ? t('Terminal') : t('Open terminal')
))
const terminalHeaderQuickCommands = computed<TerminalHeaderQuickCommand[]>(() => {
  const storedByValue = new Map(terminalStoredQuickCommands.value.map((command) => [command.value, command]))
  const combined: TerminalHeaderQuickCommand[] = [
    ...terminalProjectQuickCommands.value.map((command, index) => ({
      label: command.label,
      value: command.value,
      usageCount: 0,
      lastUsedAt: 0,
      ...(storedByValue.get(command.value) ?? {}),
      custom: false,
      sourceIndex: index,
    })),
  ]
  return combined
    .sort(compareTerminalQuickCommands)
})
const terminalHeaderDropdownOptions = computed(() => [
  { label: isComposerTerminalOpen.value ? t('Hide terminal') : t('Open terminal'), value: TOGGLE_TERMINAL_COMMAND_VALUE },
  ...terminalHeaderQuickCommands.value.map((command) => ({ label: command.label, value: command.value })),
])
const contentStyle = computed(() => {
  const preset = CHAT_WIDTH_PRESETS[chatWidth.value]
  const keyboardInset = Math.max(
    0,
    layoutViewportHeight.value - visualViewportHeight.value - visualViewportOffsetTop.value,
  )
  return {
    '--chat-column-max': preset.columnMax,
    '--chat-card-max': preset.cardMax,
    '--visual-viewport-height': visualViewportHeight.value > 0 ? `${visualViewportHeight.value}px` : '100dvh',
    '--visual-viewport-offset-top': `${Math.max(0, visualViewportOffsetTop.value)}px`,
    '--virtual-keyboard-inset': `${keyboardInset}px`,
  }
})
const telegramStatusText = computed(() => {
  if (!telegramStatus.value.configured) return t('Not configured')
  const base = telegramStatus.value.active ? t('Online') : t('Configured (offline)')
  const allowlist = telegramStatus.value.allowAllUsers
    ? t('allow all users')
    : `${telegramStatus.value.allowedUsers} ${t('allowed user(s)')}`
  const mapped = `${telegramStatus.value.mappedChats} ${t('chat(s)')}, ${telegramStatus.value.mappedThreads} ${t('thread(s)')}, ${allowlist}`
  const error = telegramStatus.value.lastError ? `, ${t('error')}: ${telegramStatus.value.lastError}` : ''
  return `${base}, ${mapped}${error}`
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onWindowKeyDown)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  window.addEventListener('pageshow', onWindowPageShow)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('resize', updateVisualViewportState)
  window.visualViewport?.addEventListener('resize', updateVisualViewportState)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportState)
  updateVisualViewportState()
  applyDarkMode()
  darkModeMediaQuery?.addEventListener('change', applyDarkMode)
  void initialize()
  void loadHomeDirectory()
  void loadWorkspaceRootOptionsState()
  void refreshDefaultProjectName()
  void loadFreeModeStatus()
  void refreshThreadTerminalStatus()
  void refreshTerminalQuickCommands()
})

watch(visibleFeedbackErrors, (values, oldValues) => {
  values.forEach((value, index) => {
    if (value === oldValues[index]) return
    const message = value.trim()
    if (message) {
      recordVisibleFailure(message)
    }
  })
})

onUnmounted(() => {
  clearInterval(telegramStatusTimer)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onWindowKeyDown)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('pageshow', onWindowPageShow)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('resize', updateVisualViewportState)
  window.visualViewport?.removeEventListener('resize', updateVisualViewportState)
  window.visualViewport?.removeEventListener('scroll', updateVisualViewportState)
  darkModeMediaQuery?.removeEventListener('change', applyDarkMode)
  if (accountStatePollTimer !== null) {
    window.clearInterval(accountStatePollTimer)
    accountStatePollTimer = null
  }
  if (threadSearchTimer) {
    clearTimeout(threadSearchTimer)
    threadSearchTimer = null
  }
  clearTerminalKeyboardFocusFallbackTimer()
  if (workspaceRootsResumeTimer !== null) clearTimeout(workspaceRootsResumeTimer)
  stopPolling()
})

function updateVisualViewportState(): void {
  if (typeof window === 'undefined') return
  layoutViewportHeight.value = Math.max(layoutViewportHeight.value, window.innerHeight)
  visualViewportHeight.value = window.visualViewport?.height ?? window.innerHeight
  visualViewportOffsetTop.value = window.visualViewport?.offsetTop ?? 0
}

watch(sidebarSearchQuery, (value) => {
  const query = value.trim()
  if (threadSearchTimer) {
    clearTimeout(threadSearchTimer)
    threadSearchTimer = null
  }
  if (!query) {
    serverMatchedThreadIds.value = null
    return
  }

  threadSearchTimer = setTimeout(() => {
    void searchThreads(query, 1000)
      .then((result) => {
        if (sidebarSearchQuery.value.trim() !== query) return
        serverMatchedThreadIds.value = result.threadIds
      })
      .catch(() => {
        if (sidebarSearchQuery.value.trim() !== query) return
        serverMatchedThreadIds.value = null
      })
  }, 220)
})

watch(isVirtualKeyboardOpen, (open) => {
  if (open) return
  isTerminalKeyboardFocusFallbackActive.value = false
})

watch(accounts, () => {
  if (typeof window === 'undefined') return
  const shouldPoll = accounts.value.some((account) => account.quotaStatus === 'loading')
  if (!shouldPoll) {
    if (accountStatePollTimer !== null) {
      window.clearInterval(accountStatePollTimer)
      accountStatePollTimer = null
    }
    return
  }
  if (accountStatePollTimer !== null) return
  accountStatePollTimer = window.setInterval(() => {
    if (isAccountStatePollInFlight) return
    isAccountStatePollInFlight = true
    void loadAccountsState({ silent: true }).finally(() => {
      isAccountStatePollInFlight = false
    })
  }, 1500)
}, { deep: true })

watch(accountRateLimitSnapshots, () => {
  void maybeImportExternalCodexAuthAccount().then((imported) => {
    if (!imported) return
    void refreshAll({
      includeSelectedThreadMessages: false,
      providerChanged: true,
      awaitAncillaryRefreshes: true,
    })
  })
}, { deep: true })

async function maybeImportExternalCodexAuthAccount(): Promise<boolean> {
  if (!externalCodexAuthAvailable) return false
  if (externalAuthImportAttempted) return false
  if (selectedProvider.value !== 'codex') return false
  if (accounts.value.length > 0) return false
  if (accountRateLimitSnapshots.value.length === 0) return false
  externalAuthImportAttempted = true
  const previousAccountsJson = JSON.stringify(accounts.value.map((account) => account.accountId).sort())
  try {
    const result = await refreshAccountsFromAuth()
    accounts.value = result.accounts
  } catch {
    await loadAccountsState({ silent: true })
  }
  const nextAccountsJson = JSON.stringify(accounts.value.map((account) => account.accountId).sort())
  return previousAccountsJson !== nextAccountsJson
}

function onSkillsChanged(): void {
  void refreshSkills({ force: true })
}

async function refreshTelegramStatus(): Promise<void> {
  try {
    telegramStatus.value = await (await import('./api/telegramGateway')).getTelegramStatus()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Telegram status'
    telegramStatus.value = {
      configured: false,
      active: false,
      mappedChats: 0,
      mappedThreads: 0,
      allowedUsers: 0,
      allowAllUsers: false,
      lastError: message,
    }
  }
}

async function refreshTelegramConfig(): Promise<void> {
  try {
    const { getTelegramConfig } = await import('./api/telegramGateway')
    const config = await getTelegramConfig()
    telegramBotTokenDraft.value = config.botToken
    telegramNotifyEnabledDraft.value = config.completionNotifications.enabled
    telegramNotifyChatIdDraft.value = config.completionNotifications.chatIds.join('')
    telegramAppUrlDraft.value = config.completionNotifications.appUrl
    telegramAllowedUserIdsDraft.value = config.allowedUserIds.map((value) => String(value)).join('\n')
    savedTelegramDraft.value = telegramDraftSnapshot()
    telegramConfigError.value = ''
  } catch (error) {
    telegramConfigError.value = error instanceof Error ? error.message : 'Failed to load Telegram configuration'
  }
}

let telegramStatusTimer: ReturnType<typeof setInterval> | undefined

function toggleSidebarSearch(): void {
  isSidebarSearchVisible.value = !isSidebarSearchVisible.value
  if (isSidebarSearchVisible.value) {
    nextTick(() => sidebarSearchInputRef.value?.focus())
  } else {
    sidebarSearchQuery.value = ''
  }
}

function clearSidebarSearch(): void {
  sidebarSearchQuery.value = ''
  sidebarSearchInputRef.value?.focus()
}

function getSidebarScrollableElement(): HTMLElement | null {
  if (sidebarScrollableRef.value) return sidebarScrollableRef.value
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.mobile-drawer .sidebar-scrollable, .sidebar-scrollable')
}

function onSidebarScroll(event?: Event): void {
  if (isSidebarCollapsed.value) return
  if (isRestoringSidebarScroll) return
  const target = event?.currentTarget
  const container = target instanceof HTMLElement ? target : getSidebarScrollableElement()
  sidebarScrollTop = container?.scrollTop ?? sidebarScrollTop
}

function restoreSidebarScrollPosition(): void {
  const requestId = ++sidebarScrollRestoreRequestId
  const targetScrollTop = sidebarScrollTop
  const maxRestoreAttempts = 90
  isRestoringSidebarScroll = true
  const finishRestore = () => {
    if (requestId === sidebarScrollRestoreRequestId) {
      sidebarScrollTop = targetScrollTop
      isRestoringSidebarScroll = false
    }
  }
  const restore = (attempt: number) => {
    if (requestId !== sidebarScrollRestoreRequestId) return
    if (isSidebarCollapsed.value) {
      finishRestore()
      return
    }

    const container = getSidebarScrollableElement()
    if (container) {
      container.scrollTop = targetScrollTop
      if (Math.abs(container.scrollTop - targetScrollTop) <= 1 || attempt >= maxRestoreAttempts) {
        finishRestore()
        return
      }
    }

    if (attempt >= maxRestoreAttempts || typeof window === 'undefined') {
      finishRestore()
      return
    }
    window.requestAnimationFrame(() => restore(attempt + 1))
  }

  void nextTick(() => restore(0))
}

function onSidebarSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isSidebarSearchVisible.value = false
    sidebarSearchQuery.value = ''
  }
}

function onSelectThread(threadId: string): void {
  if (!threadId) return
  if (route.name === 'thread' && routeThreadId.value === threadId) return
  void router.push({ name: 'thread', params: { threadId } })
  if (isMobile.value) setSidebarCollapsed(true)
}

function onSelectAutomationInPanel(automationId: string): void {
  if (route.name !== 'automations') return
  if (routeAutomationId.value === automationId) return
  void router.replace({ name: 'automations', query: automationId ? { automationId } : {} })
}

async function onEditAutomationFromPanel(payload: AutomationEditRequest): Promise<void> {
  if (isSidebarCollapsed.value) {
    setSidebarCollapsed(false)
    await nextTick()
  }
  sidebarThreadTreeRef.value?.openAutomationEditorFromPanel(payload)
}

async function onCreateAutomationFromPanel(): Promise<void> {
  if (isSidebarCollapsed.value) {
    setSidebarCollapsed(false)
    await nextTick()
  }
  sidebarThreadTreeRef.value?.openAutomationCreatorFromPanel()
}

function onAutomationsChanged(): void {
  if (route.name !== 'automations') return
  void automationsPanelRef.value?.loadAutomations()
}

async function onCopyThreadChat(threadId: string): Promise<void> {
  if (!threadId) return
  if (selectedThreadId.value !== threadId) return
  await copySelectedThreadChat()
}

function isPaymentRequiredErrorMessage(value: string | null): boolean {
  if (!value) return false
  const normalized = value.toLowerCase()
  return normalized.includes('payment required') || /\b402\b/.test(normalized)
}

function isAccountUnavailable(account: UiAccountEntry): boolean {
  return account.unavailableReason === 'payment_required' || isPaymentRequiredErrorMessage(account.quotaError)
}

async function loadAccountsState(options: { silent?: boolean } = {}): Promise<void> {
  try {
    const result = await getAccounts()
    accounts.value = result.accounts
    if (!result.accounts.some((account) => account.storageId === hoveredAccountId.value)) {
      hoveredAccountId.value = ''
    }
    if (!result.accounts.some((account) => account.storageId === confirmingRemoveAccountId.value)) {
      confirmingRemoveAccountId.value = ''
    }
  } catch (error) {
    if (options.silent === true) return
    accountActionError.value = error instanceof Error ? error.message : t('Failed to load accounts')
  }
}

function onCancelCodexLoginModal(): void {
  if (isCompletingCodexLogin.value) return
  isCodexLoginModalOpen.value = false
  codexLoginCallbackUrl.value = ''
}

async function onSubmitCodexLoginCallback(): Promise<void> {
  const callbackUrl = codexLoginCallbackUrl.value.trim()
  if (!callbackUrl) return
  await completeCodexLoginFromCallback(callbackUrl)
}

async function completeCodexLoginFromCallback(callbackUrl: string): Promise<void> {
  if (isCompletingCodexLogin.value || callbackUrl.length === 0) return
  accountActionError.value = ''
  isCompletingCodexLogin.value = true
  try {
    const result = await completeCodexLogin(callbackUrl)
    accounts.value = result.accounts
    codexLoginUrl.value = ''
    codexLoginCallbackUrl.value = ''
    isCodexLoginModalOpen.value = false
    stopPolling()
    startPolling()
    void refreshAll({
      includeSelectedThreadMessages: true,
    })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : t('Failed to complete Codex login')
  } finally {
    isCompletingCodexLogin.value = false
  }
}

function onArchiveThread(threadId: string): void {
  void archiveThreadById(threadId)
}

async function onForkThread(threadId: string): Promise<void> {
  const nextThreadId = await forkThreadById(threadId)
  if (!nextThreadId) return
  if (!isHomeRoute.value) {
    await router.push({ name: 'thread', params: { threadId: nextThreadId } })
  } else {
    await router.replace({ name: 'thread', params: { threadId: nextThreadId } })
  }
  if (isMobile.value) setSidebarCollapsed(true)
}

function isWorktreePath(cwdRaw: string): boolean {
  const cwd = cwdRaw.trim().replace(/\\/gu, '/')
  if (!cwd) return false
  return cwd.includes('/.codex/worktrees/') || cwd.includes('/.git/worktrees/')
}

function resolvePreferredLocalCwd(projectName: string, fallbackCwd = ''): string {
  const group = projectGroups.value.find((row) => row.projectName === projectName)
  if (!group) return resolveWorkspaceRootCwd(projectName) || fallbackCwd.trim()
  const nonWorktreeThread = group.threads.find((thread) => !isWorktreePath(thread.cwd))
  const candidate = nonWorktreeThread?.cwd?.trim() ?? group.threads[0]?.cwd?.trim() ?? ''
  return candidate || resolveWorkspaceRootCwd(projectName) || fallbackCwd.trim()
}

function onStartNewThread(projectName: string): void {
  const projectGroup = projectGroups.value.find((group) => group.projectName === projectName)
  const projectCwd = resolvePreferredLocalCwd(projectName, projectGroup?.threads[0]?.cwd?.trim() ?? '')
  if (projectCwd) {
    newThreadCwd.value = projectCwd
  }
  if (isMobile.value) setSidebarCollapsed(true)
  if (isHomeRoute.value) return
  void router.push({ name: 'home' })
}

function onBrowseThreadFiles(threadId: string): void {
  let targetCwd = ''
  for (const group of projectGroups.value) {
    const thread = group.threads.find((row) => row.id === threadId)
    if (thread?.cwd?.trim()) {
      targetCwd = thread.cwd.trim()
      break
    }
  }
  if (!targetCwd || typeof window === 'undefined') return
  window.open(`/codex-local-browse${encodeURI(targetCwd)}`, '_blank', 'noopener,noreferrer')
}

function getProjectCwd(projectName: string): string {
  const projectGroup = projectGroups.value.find((group) => group.projectName === projectName)
  return resolvePreferredLocalCwd(projectName, projectGroup?.threads[0]?.cwd?.trim() ?? '')
}

const projectCwdByName = computed<Record<string, string>>(() =>
  Object.fromEntries(
    projectGroups.value
      .map((group) => [group.projectName, getProjectCwd(group.projectName).trim()] as const)
      .filter(([, cwd]) => cwd.length > 0),
  ),
)

function getProjectDisplayNameForWorktree(projectName: string): string {
  return (projectDisplayNameById.value[projectName] ?? projectName).trim() || projectName
}

function toWorktreeFolderNameDraft(projectName: string): string {
  const displayName = getProjectDisplayNameForWorktree(projectName)
  const sanitized = displayName
    .replace(/[\\/]+/gu, '-')
    .replace(/[\u0000-\u001f]+/gu, '')
    .trim()
  return sanitized || 'worktree'
}

function onBrowseProjectFiles(projectName: string): void {
  const targetCwd = getProjectCwd(projectName)
  if (!targetCwd || typeof window === 'undefined') return
  window.open(`/codex-local-browse${encodeURI(targetCwd)}`, '_blank', 'noopener,noreferrer')
}

async function onSaveProject(projectName: string): Promise<void> {
  const targetCwd = getProjectCwd(projectName)
  await exportProjectZipForCwd(targetCwd)
}

async function onSaveThreadProject(threadId: string): Promise<void> {
  const targetCwd = getThreadCwd(threadId)
  await exportProjectZipForCwd(targetCwd)
}

function getThreadCwd(threadId: string): string {
  for (const group of projectGroups.value) {
    const thread = group.threads.find((row) => row.id === threadId)
    if (thread?.cwd?.trim()) return thread.cwd.trim()
  }
  return ''
}

function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

async function downloadProjectZipFallback(blob: Blob, fileName: string) {
  return projectDeferred.invoke('downloadProjectZipFallback', blob, fileName)
}

async function shareProjectZip(blob: Blob, fileName: string) {
  return projectDeferred.invoke('shareProjectZip', blob, fileName)
}

async function onCloseProjectZipExportModal() {
  return projectDeferred.invoke('onCloseProjectZipExportModal')
}

async function onDownloadProjectZipExport() {
  return projectDeferred.invoke('onDownloadProjectZipExport')
}

async function onShareProjectZipExport() {
  return projectDeferred.invoke('onShareProjectZipExport')
}

async function exportProjectZipForCwd(targetCwd: string) {
  return projectDeferred.invoke('exportProjectZipForCwd', targetCwd)
}

async function onCreateProjectWorktree(projectName: string): Promise<void> {
  const sourceCwd = getProjectCwd(projectName)
  if (!sourceCwd || typeof window === 'undefined') return
  await loadGitRepoStatus(sourceCwd)
  if (gitRepoStatusByCwd.value[sourceCwd] !== true) return

  const suggestedName = `${toWorktreeFolderNameDraft(projectName)}-`
  const worktreeName = window.prompt('New worktree folder name', suggestedName)
  if (worktreeName === null) return

  const normalizedWorktreeName = worktreeName.trim()
  if (!normalizedWorktreeName) return
  if (normalizedWorktreeName.includes('/') || normalizedWorktreeName.includes('\\') || normalizedWorktreeName === '.' || normalizedWorktreeName === '..') {
    window.alert('Worktree name must be a single folder name.')
    return
  }

  try {
    const created = await createPermanentWorktree(sourceCwd, normalizedWorktreeName)
    const normalizedPath = await openProjectRoot(created.cwd, {
      createIfMissing: false,
      label: '',
    })
    if (!normalizedPath) return

    newThreadCwd.value = normalizedPath
    newThreadRuntime.value = 'local'
    await pinProjectToTop(normalizedPath)
    await loadWorkspaceRootOptionsState()
    await refreshDefaultProjectName()
    if (isMobile.value) setSidebarCollapsed(true)
    if (!isHomeRoute.value) {
      await router.push({ name: 'home' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create worktree.'
    window.alert(message)
  }
}

function resolveSelectedThreadProjectCwd(): string {
  const thread = selectedThread.value
  if (!thread) return ''
  const projectName = thread.projectName?.trim() ?? ''
  if (!projectName) return thread.cwd?.trim() ?? ''
  return resolvePreferredLocalCwd(projectName, thread.cwd?.trim() ?? '')
}

function onStartNewThreadFromToolbar(): void {
  const resolvedCwd = resolveSelectedThreadProjectCwd()
  if (resolvedCwd) {
    newThreadCwd.value = resolvedCwd
  }
  newThreadRuntime.value = 'local'
  if (isMobile.value) setSidebarCollapsed(true)
  if (isHomeRoute.value) return
  void router.push({ name: 'home' })
}

function onStartProjectlessNewChat(): void {
  newThreadCwd.value = ''
  newThreadRuntime.value = 'local'
  if (isMobile.value) setSidebarCollapsed(true)
  if (isHomeRoute.value) return
  void router.push({ name: 'home' })
}

async function loadGitRepoStatus(cwdRaw: string): Promise<void> {
  const cwd = cwdRaw.trim()
  if (!cwd || Object.prototype.hasOwnProperty.call(gitRepoStatusByCwd.value, cwd)) return

  const existingRequest = gitRepoStatusRequestByCwd.get(cwd)
  if (existingRequest) {
    const isGitRepo = await existingRequest
    if (!Object.prototype.hasOwnProperty.call(gitRepoStatusByCwd.value, cwd)) {
      gitRepoStatusByCwd.value = {
        ...gitRepoStatusByCwd.value,
        [cwd]: isGitRepo,
      }
    }
    return
  }

  const request = getGitRepositoryStatus(cwd)
    .then((status) => status.isGitRepo)
    .catch(() => false)
    .finally(() => {
      gitRepoStatusRequestByCwd.delete(cwd)
    })
  gitRepoStatusRequestByCwd.set(cwd, request)

  const isGitRepo = await request
  if (Object.prototype.hasOwnProperty.call(gitRepoStatusByCwd.value, cwd)) return
  gitRepoStatusByCwd.value = {
    ...gitRepoStatusByCwd.value,
    [cwd]: isGitRepo,
  }
}

function onRenameProject(payload: { projectName: string; displayName: string }): void {
  renameProject(payload.projectName, payload.displayName)
}

function onRenameThread(payload: { threadId: string; title: string }): void {
  void renameThreadById(payload.threadId, payload.title)
}

async function onRemoveProject(projectName: string): Promise<void> {
  await removeProject(projectName)
  await loadWorkspaceRootOptionsState()
  void refreshDefaultProjectName()
}

function onReorderProject(payload: { projectName: string; toIndex: number }): void {
  reorderProject(payload.projectName, payload.toIndex)
}

function onRequestProjectGitStatus(projectName: string): void {
  const group = projectGroups.value.find((entry) => entry.projectName === projectName)
  const cwd = resolvePreferredLocalCwd(projectName, group?.threads[0]?.cwd?.trim() ?? '')
  void loadGitRepoStatus(cwd)
}

function onRespondServerRequest(payload: UiServerRequestReply): void {
  void handleServerRequestResponse(payload)
}

async function handleServerRequestResponse(payload: UiServerRequestReply): Promise<void> {
  const responded = await respondToPendingServerRequest(payload)
  const followUpMessageText = payload.followUpMessageText?.trim() ?? ''
  if (!responded || !followUpMessageText || isHomeRoute.value) return

  try {
    await sendMessageToSelectedThread(followUpMessageText, [], [], 'steer', [])
  } catch {
    // sendMessageToSelectedThread already surfaces the error through shared state.
  }
}

async function onForkThreadFromMessage(payload: { threadId: string; turnIndex: number }): Promise<void> {
  const forkedThreadId = await forkThreadFromTurn(payload.threadId, payload.turnIndex)
  if (!forkedThreadId) return
  await router.push({ name: 'thread', params: { threadId: forkedThreadId } })
  if (selectedThreadId.value !== forkedThreadId) {
    await selectThread(forkedThreadId)
  }
  if (isMobile.value) setSidebarCollapsed(true)
}

function setSidebarCollapsed(nextValue: boolean): void {
  if (isSidebarCollapsed.value === nextValue) return
  if (nextValue) {
    const currentScrollTop = getSidebarScrollableElement()?.scrollTop
    if (typeof currentScrollTop === 'number' && (currentScrollTop > 0 || sidebarScrollTop === 0)) {
      sidebarScrollTop = currentScrollTop
    }
  }
  isSidebarCollapsed.value = nextValue
  saveSidebarCollapsed(nextValue)
  if (!nextValue) {
    restoreSidebarScrollPosition()
  }
}

function onWindowKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  if (event.key === 'Escape' && isSettingsOpen.value) {
    isSettingsOpen.value = false
    return
  }
  if (!event.ctrlKey && !event.metaKey) return
  if (event.shiftKey || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'b') {
    event.preventDefault()
    setSidebarCollapsed(!isSidebarCollapsed.value)
    return
  }
  if (key === 'j' && route.name === 'thread' && selectedThreadId.value) {
    event.preventDefault()
    toggleComposerTerminal()
    return
  }
  if (key === 'j' && isHomeRoute.value && composerCwd.value) {
    event.preventDefault()
    toggleComposerTerminal()
  }
}

function toggleComposerTerminal(): void {
  if (!isThreadTerminalAvailable.value) return
  if (isHomeRoute.value) {
    if (!composerCwd.value) return
    homeTerminalOpen.value = !homeTerminalOpen.value
    if (!homeTerminalOpen.value) {
      resetTerminalKeyboardFocusState()
    }
    return
  }
  toggleSelectedThreadTerminal()
  if (!selectedThreadTerminalOpen.value) {
    resetTerminalKeyboardFocusState()
  }
}

function onSelectHeaderTerminalCommand(command: string): void {
  terminalHeaderDropdownValue.value = ''
  if (!command) return
  if (command === TOGGLE_TERMINAL_COMMAND_VALUE) {
    toggleComposerTerminal()
    return
  }
  void openTerminalAndRunCommand(command)
}

async function openTerminalAndRunCommand(command: string): Promise<void> {
  if (!isThreadTerminalAvailable.value || !composerCwd.value) return
  if (isHomeRoute.value) {
    homeTerminalOpen.value = true
  } else if (selectedThreadId.value) {
    setThreadTerminalOpen(selectedThreadId.value, true)
  } else {
    return
  }
  const panel = await waitForTerminalPanel()
  if (!panel) return
  try {
    await panel.runQuickCommand(command)
    recordHeaderTerminalCommandUse(command)
  } catch {
    // ThreadTerminalPanel renders the terminal-specific error in place.
  }
}

async function waitForTerminalPanel(): Promise<ThreadTerminalPanelExposed | null> {
  const routeKey = route.fullPath
  const cwd = composerCwd.value
  return new Promise((resolve) => {
    const stop = watch([homeTerminalPanelRef, threadTerminalPanelRef, () => route.fullPath, composerCwd, isComposerTerminalOpen], () => {
      if (route.fullPath !== routeKey || composerCwd.value !== cwd || !isComposerTerminalOpen.value) {
        stop(); resolve(null); return
      }
      const panel = isHomeRoute.value ? homeTerminalPanelRef.value : threadTerminalPanelRef.value
      if (panel) { stop(); resolve(panel) }
    }, { flush: 'post' })
    const panel = isHomeRoute.value ? homeTerminalPanelRef.value : threadTerminalPanelRef.value
    if (panel) { stop(); resolve(panel) }
  })
}

async function refreshTerminalQuickCommands(): Promise<void> {
  const cwd = composerCwd.value.trim()
  if (!cwd) {
    terminalProjectQuickCommands.value = []
    return
  }
  try {
    terminalProjectQuickCommands.value = await getThreadTerminalQuickCommands(cwd)
  } catch {
    terminalProjectQuickCommands.value = []
  }
}

function recordHeaderTerminalCommandUse(command: string): void {
  const normalized = normalizeTerminalQuickCommandValue(command)
  if (!normalized) return
  const existing = terminalStoredQuickCommands.value.find((row) => row.value === normalized)
  const projectCommandIndex = terminalProjectQuickCommands.value.findIndex((row) => row.value === normalized)
  const projectCommand = projectCommandIndex >= 0 ? terminalProjectQuickCommands.value[projectCommandIndex] : null
  if (!projectCommand) return
  const nextCommand: TerminalHeaderQuickCommand = {
    label: existing?.label || projectCommand?.label || normalized,
    value: normalized,
    custom: false,
    usageCount: (existing?.usageCount ?? 0) + 1,
    lastUsedAt: Date.now(),
    sourceIndex: projectCommandIndex >= 0 ? projectCommandIndex : undefined,
  }
  const next = [
    ...terminalStoredQuickCommands.value.filter((row) => row.value !== normalized),
    nextCommand,
  ]
  terminalStoredQuickCommands.value = next
  saveTerminalStoredQuickCommands(next)
}

function normalizeTerminalQuickCommandValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function compareTerminalQuickCommands(first: TerminalHeaderQuickCommand, second: TerminalHeaderQuickCommand): number {
  if (second.usageCount !== first.usageCount) return second.usageCount - first.usageCount
  if (second.lastUsedAt !== first.lastUsedAt) return second.lastUsedAt - first.lastUsedAt
  const firstSource = typeof first.sourceIndex === 'number' ? first.sourceIndex : Number.MAX_SAFE_INTEGER
  const secondSource = typeof second.sourceIndex === 'number' ? second.sourceIndex : Number.MAX_SAFE_INTEGER
  return firstSource - secondSource
}

function loadTerminalStoredQuickCommands(): TerminalHeaderQuickCommand[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TERMINAL_QUICK_COMMAND_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const commands: TerminalHeaderQuickCommand[] = []
    for (const row of parsed) {
      const record = row !== null && typeof row === 'object' && !Array.isArray(row)
        ? row as Record<string, unknown>
        : null
      const value = normalizeTerminalQuickCommandValue(readTerminalString(record?.value))
      if (!value || seen.has(value)) continue
      seen.add(value)
      commands.push({
        label: readTerminalString(record?.label) || value,
        value,
        custom: record?.custom !== false,
        usageCount: readTerminalPositiveInteger(record?.usageCount),
        lastUsedAt: readTerminalPositiveInteger(record?.lastUsedAt),
      })
    }
    return commands
  } catch {
    return []
  }
}

function saveTerminalStoredQuickCommands(commands: TerminalHeaderQuickCommand[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    TERMINAL_QUICK_COMMAND_STORAGE_KEY,
    JSON.stringify(commands.map((command) => ({
      label: command.label,
      value: command.value,
      custom: command.custom === true,
      usageCount: command.usageCount,
      lastUsedAt: command.lastUsedAt,
    }))),
  )
}

function readTerminalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readTerminalPositiveInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value))
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed))
  }
  return 0
}

function onTerminalFocusChange(focused: boolean): void {
  isTerminalInputFocused.value = focused
  if (!focused) {
    isTerminalKeyboardFocusFallbackActive.value = false
    clearTerminalKeyboardFocusFallbackTimer()
    return
  }
  isTerminalKeyboardFocusFallbackActive.value = true
  clearTerminalKeyboardFocusFallbackTimer()
  terminalKeyboardFocusFallbackTimer = setTimeout(() => {
    terminalKeyboardFocusFallbackTimer = null
    if (!isVirtualKeyboardOpen.value) {
      isTerminalKeyboardFocusFallbackActive.value = false
    }
  }, 1500)
}

function onHideHomeTerminal(): void {
  homeTerminalOpen.value = false
  resetTerminalKeyboardFocusState()
}

function onHideSelectedThreadTerminal(): void {
  if (selectedThreadId.value) {
    setThreadTerminalOpen(selectedThreadId.value, false)
  }
  resetTerminalKeyboardFocusState()
}

function resetTerminalKeyboardFocusState(): void {
  isTerminalInputFocused.value = false
  isTerminalKeyboardFocusFallbackActive.value = false
  clearTerminalKeyboardFocusFallbackTimer()
}

function clearTerminalKeyboardFocusFallbackTimer(): void {
  if (!terminalKeyboardFocusFallbackTimer) return
  clearTimeout(terminalKeyboardFocusFallbackTimer)
  terminalKeyboardFocusFallbackTimer = null
}

async function refreshThreadTerminalStatus(): Promise<void> {
  try {
    const status = await getThreadTerminalStatus()
    isThreadTerminalAvailable.value = status.available
    if (!status.available) {
      homeTerminalOpen.value = false
      if (selectedThreadId.value) {
        setThreadTerminalOpen(selectedThreadId.value, false)
      }
    }
  } catch {
    isThreadTerminalAvailable.value = false
    homeTerminalOpen.value = false
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node)) return
  if (isTerminalInputFocused.value) {
    const targetElement = target instanceof Element ? target : target.parentElement
    if (!targetElement?.closest('.thread-terminal-panel')) {
      resetTerminalKeyboardFocusState()
    }
  }
  if (!isSettingsOpen.value) return
  if (settingsPanelRef.value?.contains(target)) return
  if (settingsButtonRef.value?.contains(target)) return
  isSettingsOpen.value = false
}

function onSettingsAreaClick(event: MouseEvent): void {
  if (!isSettingsOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (settingsPanelRef.value?.contains(target)) return
  if (settingsButtonRef.value?.contains(target)) return
  isSettingsOpen.value = false
}

function onDocumentVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    lastWorkspaceRootsResumeAt = 0
    if (workspaceRootsResumeTimer !== null) clearTimeout(workspaceRootsResumeTimer)
    workspaceRootsResumeTimer = null
    return
  }
  scheduleWorkspaceRootsResume()
}

function onWindowPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleWorkspaceRootsResume()
}

function onWindowFocus(): void {
  scheduleWorkspaceRootsResume()
}

function scheduleWorkspaceRootsResume(): void {
  if (!hasInitialized.value || document.visibilityState !== 'visible') return
  if (workspaceRootsResumeInProgress || workspaceRootsResumeTimer !== null) return
  if (Date.now() - lastWorkspaceRootsResumeAt < 400) return
  workspaceRootsResumeTimer = setTimeout(() => {
    workspaceRootsResumeTimer = null
    if (document.visibilityState !== 'visible') return
    lastWorkspaceRootsResumeAt = Date.now()
    workspaceRootsResumeInProgress = true
    void refreshWorkspaceRoots().then((state) => {
      if (state) {
        workspaceRootOptionsState.value = {
          order: [...state.order], labels: { ...state.labels }, projectOrder: [...state.projectOrder],
        }
      }
    }).finally(() => { workspaceRootsResumeInProgress = false })
  }, 100)
}

function onSubmitThreadMessage(payload: { text: string; imageUrls: string[]; fileAttachments: Array<{ label: string; path: string; fsPath: string }>; skills: Array<{ name: string; path: string }>; mode: 'steer' | 'queue' }): void {
  const text = payload.text
  scheduleMobileConversationJumpToLatest()
  const editingState = editingQueuedMessageState.value
  const queueInsertIndex =
    payload.mode === 'queue'
    && editingState
    && editingState.threadId === selectedThreadId.value
      ? editingState.queueIndex
      : undefined
  editingQueuedMessageState.value = null
  if (isHomeRoute.value) {
    void submitFirstMessageForNewThread(text, payload.imageUrls, payload.skills, payload.fileAttachments)
    return
  }
  void sendMessageToSelectedThread(text, payload.imageUrls, payload.skills, payload.mode, payload.fileAttachments, queueInsertIndex,
    editingState?.threadId === selectedThreadId.value ? editingState.message.collaborationMode : undefined,
    editingState?.threadId === selectedThreadId.value ? editingState.message.generationSettings ?? null : undefined)
}

function onEditQueuedMessage(messageId: string): void {
  const queueIndex = selectedThreadQueuedMessages.value.findIndex((item) => item.id === messageId)
  const message = queueIndex >= 0 ? selectedThreadQueuedMessages.value[queueIndex] : undefined
  const composer = threadComposerRef.value
  if (!message || !composer) return

  if (composer.hasUnsavedDraft()) {
    const shouldReplace = window.confirm('Replace the current draft with this queued message for editing?')
    if (!shouldReplace) return
  }

  editingQueuedMessageState.value = selectedThreadId.value
    ? { threadId: selectedThreadId.value, queueIndex, message }
    : null
  const payload: ComposerDraftPayload = {
    text: message.text,
    imageUrls: [...message.imageUrls],
    fileAttachments: message.fileAttachments.map((attachment) => ({ ...attachment })),
    skills: message.skills.map((skill) => ({ ...skill })),
  }
  composer.hydrateDraft(payload)
  removeQueuedMessage(messageId)
}

function scheduleMobileConversationJumpToLatest(): void {
  if (!isMobile.value || isHomeRoute.value) return

  const jumpToLatest = () => {
    threadConversationRef.value?.jumpToLatest()
  }

  jumpToLatest()
  void nextTick(() => {
    jumpToLatest()
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      jumpToLatest()
      window.requestAnimationFrame(jumpToLatest)
    })
  })
}

function onSelectNewThreadFolder(cwd: string): void {
  newThreadCwd.value = cwd.trim()
  createFolderError.value = ''
}

function onSelectNewWorktreeBranch(branch: string): void {
  newWorktreeBaseBranch.value = branch.trim()
}

function canLoadBranchStateForCwd(cwd: string): boolean {
  const currentCwd = composerCwd.value.trim()
  if (!cwd || currentCwd !== cwd) return false
  return route.name === 'thread' || (route.name === 'home' && isNewThreadCwdGitRepo.value)
}

function resetThreadBranchState(): void {
  threadBranchesRequestId += 1
  threadBranchCommitsRequestId += 1
  threadCommitFilesRequestId += 1
  threadWorktreeSummaryRequestId += 1
  threadBranchOptions.value = []
  currentThreadBranch.value = null
  currentThreadHeadSha.value = null
  currentThreadHeadSubject.value = null
  currentThreadHeadDate.value = null
  isThreadDetachedHead.value = false
  isThreadWorktreeDirty.value = false
  threadWorktreeChangeSummary.value = { addedLineCount: 0, removedLineCount: 0 }
  threadBranchCommitsByBranch.value = {}
  threadBranchCommitsLoadingFor.value = ''
  threadBranchCommitsError.value = ''
  threadCommitFilesBySha.value = {}
  threadCommitFilesLoadingFor.value = ''
  threadCommitFilesError.value = ''
  threadBranchError.value = ''
  isLoadingThreadBranches.value = false
}

function loadThreadWorktreeChangeSummary(cwd: string): void {
  const targetCwd = cwd.trim()
  if (!targetCwd) {
    threadWorktreeChangeSummary.value = { addedLineCount: 0, removedLineCount: 0 }
    return
  }
  const requestId = ++threadWorktreeSummaryRequestId
  void getReviewSummary(targetCwd, 'unstaged')
    .then((summary) => {
      if (requestId !== threadWorktreeSummaryRequestId || !canLoadBranchStateForCwd(targetCwd)) return
      threadWorktreeChangeSummary.value = {
        addedLineCount: summary.addedLineCount,
        removedLineCount: summary.removedLineCount,
      }
    })
    .catch(() => {
      if (requestId !== threadWorktreeSummaryRequestId || !canLoadBranchStateForCwd(targetCwd)) return
      threadWorktreeChangeSummary.value = { addedLineCount: 0, removedLineCount: 0 }
    })
}

async function loadThreadBranches(cwd: string): Promise<void> {
  const targetCwd = cwd.trim()
  if (!targetCwd) {
    resetThreadBranchState()
    return
  }
  const requestId = ++threadBranchesRequestId
  isLoadingThreadBranches.value = true
  threadBranchError.value = ''
  try {
    const state = await getGitBranchState(targetCwd)
    if (requestId !== threadBranchesRequestId || !canLoadBranchStateForCwd(targetCwd)) return
    threadBranchOptions.value = state.options
    currentThreadBranch.value = state.currentBranch
    currentThreadHeadSha.value = state.headSha
    currentThreadHeadSubject.value = state.headSubject
    currentThreadHeadDate.value = state.headDate
    isThreadDetachedHead.value = state.detached
    isThreadWorktreeDirty.value = state.dirty
    loadThreadWorktreeChangeSummary(targetCwd)
    const defaultBranchForCommits = state.currentBranch?.trim() || state.options[0]?.value?.trim() || ''
    if (defaultBranchForCommits) loadThreadBranchCommits({ branch: defaultBranchForCommits, includeResetHistory: true })
  } catch {
    if (requestId !== threadBranchesRequestId || !canLoadBranchStateForCwd(targetCwd)) return
    threadBranchOptions.value = []
    currentThreadBranch.value = null
    currentThreadHeadSha.value = null
    currentThreadHeadSubject.value = null
    currentThreadHeadDate.value = null
    isThreadDetachedHead.value = false
    isThreadWorktreeDirty.value = false
    threadWorktreeChangeSummary.value = { addedLineCount: 0, removedLineCount: 0 }
  } finally {
    if (requestId === threadBranchesRequestId) {
      isLoadingThreadBranches.value = false
    }
  }
}

function applyThreadGitState(state: { currentBranch: string | null; headSha: string | null; headSubject: string | null; headDate: string | null; detached: boolean; dirty: boolean }): void {
  currentThreadBranch.value = state.currentBranch
  currentThreadHeadSha.value = state.headSha
  currentThreadHeadSubject.value = state.headSubject
  currentThreadHeadDate.value = state.headDate
  isThreadDetachedHead.value = state.detached
  isThreadWorktreeDirty.value = state.dirty
  loadThreadWorktreeChangeSummary(composerCwd.value)
}

function onCheckoutContentHeaderBranch(value: string): void {
  if (isSwitchingThreadBranch.value) return
  const targetBranch = value.trim()
  if (!targetBranch || targetBranch === (currentThreadBranch.value ?? '')) return
  const cwd = composerCwd.value.trim()
  if (!cwd) return

  isSwitchingThreadBranch.value = true
  threadBranchError.value = ''
  void checkoutGitBranch(cwd, targetBranch)
    .then((branch) => {
      currentThreadBranch.value = branch || targetBranch
      currentThreadHeadSha.value = null
      currentThreadHeadSubject.value = null
      currentThreadHeadDate.value = null
      isThreadDetachedHead.value = false
      isReviewPaneOpen.value = false
      return loadThreadBranches(cwd)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to switch branch'
      void loadThreadBranches(cwd).finally(() => {
        threadBranchError.value = message
      })
    })
    .finally(() => {
      isSwitchingThreadBranch.value = false
    })
}

function onResetContentHeaderBranchToCommit(payload: { branch: string; sha: string }): void {
  if (isSwitchingThreadBranch.value) return
  const targetBranch = payload.branch.trim()
  const targetSha = payload.sha.trim()
  const cwd = composerCwd.value.trim()
  if (!targetBranch || !targetSha || !cwd) return
  isSwitchingThreadBranch.value = true
  threadBranchError.value = ''
  void resetGitBranchToCommit(cwd, targetBranch, targetSha)
    .then((state) => {
      applyThreadGitState(state)
      isReviewPaneOpen.value = false
      return loadThreadBranches(cwd)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to reset branch to commit'
      void loadThreadBranches(cwd).finally(() => {
        threadBranchError.value = message
      })
    })
    .finally(() => {
      isSwitchingThreadBranch.value = false
    })
}

function loadThreadBranchCommits(payload: string | { branch: string; includeResetHistory?: boolean }): void {
  const targetBranch = (typeof payload === 'string' ? payload : payload.branch).trim()
  const includeResetHistory = typeof payload === 'string' ? true : payload.includeResetHistory !== false
  const cwd = composerCwd.value.trim()
  const cacheKey = toThreadBranchCommitsKey(targetBranch, includeResetHistory)
  if (!targetBranch || !cwd || threadBranchCommitsLoadingFor.value === cacheKey) return
  threadBranchCommitsError.value = ''
  if (threadBranchCommitsByBranch.value[cacheKey]) return
  const requestId = ++threadBranchCommitsRequestId
  threadBranchCommitsLoadingFor.value = cacheKey
  void getGitBranchCommits(cwd, targetBranch, { includeResetHistory })
    .then((commits) => {
      if (requestId !== threadBranchCommitsRequestId || !canLoadBranchStateForCwd(cwd)) return
      threadBranchCommitsByBranch.value = {
        ...threadBranchCommitsByBranch.value,
        [cacheKey]: commits,
      }
    })
    .catch((error: unknown) => {
      if (requestId !== threadBranchCommitsRequestId || !canLoadBranchStateForCwd(cwd)) return
      threadBranchCommitsError.value = error instanceof Error ? error.message : 'Failed to load branch commits'
    })
    .finally(() => {
      if (requestId === threadBranchCommitsRequestId && threadBranchCommitsLoadingFor.value === cacheKey) {
        threadBranchCommitsLoadingFor.value = ''
      }
    })
}

function loadThreadCommitFiles(sha: string): void {
  const targetSha = sha.trim()
  const cwd = composerCwd.value.trim()
  if (!targetSha || !cwd || threadCommitFilesLoadingFor.value === targetSha) return
  threadCommitFilesError.value = ''
  if (threadCommitFilesBySha.value[targetSha]) return
  const requestId = ++threadCommitFilesRequestId
  threadCommitFilesLoadingFor.value = targetSha
  void getGitCommitFiles(cwd, targetSha)
    .then((files) => {
      if (requestId !== threadCommitFilesRequestId || !canLoadBranchStateForCwd(cwd)) return
      threadCommitFilesBySha.value = {
        ...threadCommitFilesBySha.value,
        [targetSha]: files,
      }
    })
    .catch((error: unknown) => {
      if (requestId !== threadCommitFilesRequestId || !canLoadBranchStateForCwd(cwd)) return
      threadCommitFilesError.value = error instanceof Error ? error.message : 'Failed to load commit files'
    })
    .finally(() => {
      if (requestId === threadCommitFilesRequestId && threadCommitFilesLoadingFor.value === targetSha) {
        threadCommitFilesLoadingFor.value = ''
      }
    })
}

function onOpenContentHeaderCommitFile(payload: { sha: string; path: string }): void {
  const targetPath = payload.path.trim()
  const targetSha = payload.sha.trim()
  if (!targetPath || !targetSha) return
  reviewInitialFilePath.value = targetPath
  reviewInitialCommitSha.value = targetSha
  isReviewPaneOpen.value = true
}

function onToggleContentHeaderReview(): void {
  reviewInitialFilePath.value = ''
  reviewInitialCommitSha.value = ''
  isReviewPaneOpen.value = !isReviewPaneOpen.value
}

function clearCommitReviewContext(): void {
  if (!reviewInitialFilePath.value && !reviewInitialCommitSha.value) return
  reviewInitialFilePath.value = ''
  reviewInitialCommitSha.value = ''
  isReviewPaneOpen.value = false
}

async function onOpenProjectSetupModal() {
  return projectDeferred.invoke('onOpenProjectSetupModal')
}

async function onCloseProjectSetupModal() {
  return projectDeferred.invoke('onCloseProjectSetupModal')
}

async function createProjectFromSetupModal() {
  return projectDeferred.invoke('createProjectFromSetupModal')
}

async function cloneGithubRepositoryFromSetupModal() {
  return projectDeferred.invoke('cloneGithubRepositoryFromSetupModal')
}

async function onSubmitProjectSetup() {
  return projectDeferred.invoke('onSubmitProjectSetup')
}

function onChooseProjectImportZip(): void {
  openProjectImportInput(projectImportInputRef.value)
}

function openProjectImportInput(input: HTMLInputElement | null): void {
  if (isProjectImporting.value || !input) return
  input.value = ''
  input.click()
}

async function finishProjectImport(input: HTMLInputElement | null, importer: (baseDir: string) => Promise<{ path: string }>, fallbackMessage: string) {
  return projectDeferred.invoke('finishProjectImport', input, importer, fallbackMessage)
}

async function onDirectProjectImportFileChange(event: Event): Promise<void> {
  const input = event.target instanceof HTMLInputElement ? event.target : null
  const file = input?.files?.[0] ?? null
  if (!file || isProjectImporting.value) return

  await finishProjectImport(input, (baseDir) => importProjectZip(file, baseDir), 'Failed to import project.')
}

async function onOpenExistingFolder() {
  return projectDeferred.invoke('onOpenExistingFolder')
}

async function onCloseExistingFolderPanel() {
  return projectDeferred.invoke('onCloseExistingFolderPanel')
}

async function onBrowseExistingFolder(path: string) {
  return projectDeferred.invoke('onBrowseExistingFolder', path)
}

async function onToggleHiddenFolders() {
  return projectDeferred.invoke('onToggleHiddenFolders')
}

async function onRetryExistingFolderBrowse() {
  return projectDeferred.invoke('onRetryExistingFolderBrowse')
}

async function onConfirmExistingFolder(path = resolvedExistingFolderPath.value) {
  return projectDeferred.invoke('onConfirmExistingFolder', path)
}

async function onOpenCreateFolderPanel() {
  return projectDeferred.invoke('onOpenCreateFolderPanel')
}

async function onCloseCreateFolderPanel() {
  return projectDeferred.invoke('onCloseCreateFolderPanel')
}

async function onCreateFolder() {
  return projectDeferred.invoke('onCreateFolder')
}

async function applyLaunchProjectPathFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const launchProjectPath = new URLSearchParams(window.location.search).get('openProjectPath')?.trim() ?? ''
  if (!launchProjectPath) return false
  try {
    const normalizedPath = await openProjectRoot(launchProjectPath, {
      createIfMissing: false,
      label: '',
    })
    if (!normalizedPath) return false
    newThreadCwd.value = normalizedPath
    await pinProjectToTop(normalizedPath)
    await router.replace({ name: 'home' })
    await loadWorkspaceRootOptionsState()
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('openProjectPath')
    window.history.replaceState({}, '', nextUrl.toString())
    return true
  } catch {
    // If launch path is invalid, keep normal startup behavior.
    return false
  }
}

async function resolveProjectBaseDirectory(): Promise<string> {
  const baseDir = getProjectBaseDirectory()
  if (baseDir) return baseDir
  try {
    const loadedHomeDirectory = await getHomeDirectory()
    if (loadedHomeDirectory) {
      homeDirectory.value = loadedHomeDirectory
      return loadedHomeDirectory
    }
  } catch {
    // Fallback handled by empty return.
  }
  return ''
}

async function refreshDefaultProjectName(): Promise<void> {
  const baseDir = getProjectBaseDirectory()
  if (!baseDir) {
    defaultNewProjectName.value = 'New Project (1)'
    return
  }

  try {
    const suggestion = await getProjectRootSuggestion(baseDir)
    defaultNewProjectName.value = suggestion.name || 'New Project (1)'
  } catch {
    defaultNewProjectName.value = 'New Project (1)'
  }
}

function getProjectBaseDirectory(): string {
  const selected = newThreadCwd.value.trim()
  if (selected) return getPathParent(selected)
  const first = newThreadFolderOptions.value[0]?.value?.trim() ?? ''
  if (first) return getPathParent(first)
  return homeDirectory.value.trim()
}

async function loadHomeDirectory(): Promise<void> {
  try {
    homeDirectory.value = await getHomeDirectory()
  } catch {
    homeDirectory.value = ''
  }
}

async function loadWorkspaceRootOptionsState(): Promise<void> {
  try {
    const state = await getWorkspaceRootsState()
    workspaceRootOptionsState.value = {
      order: [...state.order],
      labels: { ...state.labels },
      projectOrder: [...state.projectOrder],
    }
  } catch (cause) {
    desktopError.value = cause instanceof Error ? cause.message : 'Failed to load projects'
  }
}

async function loadExistingFolderListing(path: string) {
  return projectDeferred.invoke('loadExistingFolderListing', path)
}

function joinPath(parent: string, child: string): string {
  const rawParent = normalizePathForUi(parent).trim()
  const normalizedChild = normalizePathForUi(child).trim().replace(/^[\\/]+/u, '')
  if (!rawParent || !normalizedChild) return ''
  const separator = rawParent.includes('\\') && !rawParent.includes('/') ? '\\' : '/'
  if (/^[a-zA-Z]:[\\/]?$/u.test(rawParent)) {
    return `${rawParent.slice(0, 2)}${separator}${normalizedChild}`
  }
  if (/^\/+$/u.test(rawParent)) {
    return `/${normalizedChild}`
  }
  const normalizedParent = rawParent.replace(/[\\/]+$/u, '')
  if (!normalizedParent) return ''
  return `${normalizedParent}${separator}${normalizedChild}`
}

function normalizeAbsolutePath(value: string): string {
  const normalizedValue = normalizePathForUi(value).trim()
  if (!normalizedValue) return ''

  const uncMatch = normalizedValue.match(/^\\\\([^\\/]+)[\\/]+([^\\/]+)([\\/].*)?$/u)
  if (uncMatch) {
    const [, server, share, suffix = ''] = uncMatch
    const segments = collapsePathSegments(suffix.split(/[\\/]+/u))
    return segments.length > 0
      ? `\\\\${server}\\${share}\\${segments.join('\\')}`
      : `\\\\${server}\\${share}`
  }

  const driveMatch = normalizedValue.match(/^([a-zA-Z]:)([\\/].*)?$/u)
  if (driveMatch) {
    const [, drive, suffix = ''] = driveMatch
    const separator = normalizedValue.includes('\\') && !normalizedValue.includes('/') ? '\\' : '/'
    const segments = collapsePathSegments(suffix.split(/[\\/]+/u))
    return segments.length > 0 ? `${drive}${separator}${segments.join(separator)}` : `${drive}${separator}`
  }

  if (normalizedValue.startsWith('/')) {
    const segments = collapsePathSegments(normalizedValue.split('/'))
    return segments.length > 0 ? `/${segments.join('/')}` : '/'
  }

  return normalizedValue
}

function collapsePathSegments(rawSegments: readonly string[]): string[] {
  const segments: string[] = []
  for (const rawSegment of rawSegments) {
    const segment = rawSegment.trim()
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop()
      }
      continue
    }
    segments.push(segment)
  }
  return segments
}

function onReorderQueuedMessage(payload: { draggedId: string; targetId: string }): void {
  reorderQueuedMessage(payload.draggedId, payload.targetId)
}

function onSelectModel(modelId: string): void {
  setSelectedModelIdForThread(composerThreadContextId.value, modelId)
}

function onSelectReasoningEffort(effort: ReasoningEffort | ''): void {
  setSelectedReasoningEffort(effort, composerThreadContextId.value)
}

function onSelectSpeedMode(mode: SpeedMode): void {
  void updateSelectedSpeedMode(mode)
}

function onInterruptTurn(): void {
  void interruptSelectedThreadTurn()
}

function onRollback(payload: { turnId: string }): void {
  const targetTurnId = payload.turnId.trim()
  if (targetTurnId.length > 0) {
    const rollbackUserMessage = [...filteredMessages.value]
      .reverse()
      .find((message) => (
        message.role === 'user'
        && (message.turnId?.trim() ?? '') === targetTurnId
        && message.text.trim().length > 0
      ))
    if (rollbackUserMessage?.text && threadComposerRef.value) {
      threadComposerRef.value.appendTextToDraft(rollbackUserMessage.text)
    }
  }
  void rollbackSelectedThread(payload.turnId)
}

function onImplementPlan(payload: { turnId: string }): void {
  if (isHomeRoute.value || !selectedThreadId.value) return
  setSelectedCollaborationMode('default')
  scheduleMobileConversationJumpToLatest()
  void sendMessageToSelectedThread('Implement', [], [], 'steer', [], undefined, 'default')
}

async function copySelectedThreadChat(): Promise<void> {
  if (isHomeRoute.value || isSkillsRoute.value || isAutomationsRoute.value) return
  if (!selectedThread.value || filteredMessages.value.length === 0) return
  const markdown = buildThreadMarkdown()
  try {
    await copyTextToClipboard(markdown)
  } catch {
    // Clipboard writes can be blocked by browser permissions; keep the menu action best-effort.
  }
}

function buildThreadMarkdown(): string {
  const lines: string[] = []
  const threadTitle = selectedThread.value?.title?.trim() || 'Untitled thread'
  lines.push(`# ${escapeMarkdownText(threadTitle)}`)
  lines.push('')
  lines.push(`- Exported: ${new Date().toISOString()}`)
  lines.push(`- Thread ID: ${selectedThread.value?.id ?? ''}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const message of filteredMessages.value) {
    const roleLabel = message.role ? message.role.toUpperCase() : 'MESSAGE'
    lines.push(`## ${roleLabel}`)
    lines.push('')

    const normalizedText = message.text.trim()
    if (normalizedText) {
      lines.push(normalizedText)
      lines.push('')
    }

    if (message.commandExecution) {
      lines.push('```text')
      lines.push(`command: ${message.commandExecution.command}`)
      lines.push(`status: ${message.commandExecution.status}`)
      if (message.commandExecution.cwd) {
        lines.push(`cwd: ${message.commandExecution.cwd}`)
      }
      if (message.commandExecution.exitCode !== null) {
        lines.push(`exitCode: ${message.commandExecution.exitCode}`)
      }
      lines.push(message.commandExecution.aggregatedOutput || '(no output)')
      lines.push('```')
      lines.push('')
    }

    if (message.fileAttachments && message.fileAttachments.length > 0) {
      lines.push('Attachments:')
      for (const attachment of message.fileAttachments) {
        lines.push(`- ${attachment.path}`)
      }
      lines.push('')
    }

    if (message.images && message.images.length > 0) {
      lines.push('Images:')
      for (const imageUrl of message.images) {
        lines.push(`- ${imageUrl}`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!])/g, '\\$1')
}

function loadBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key)
  if (v === null) return fallback
  return v === '1'
}

function loadDarkModePref(): 'system' | 'light' | 'dark' {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(DARK_MODE_KEY)
  if (v === 'light' || v === 'dark') return v
  return 'system'
}

function loadInProgressSendModePref(): 'steer' | 'queue' {
  if (typeof window === 'undefined') return 'steer'
  const v = window.localStorage.getItem(IN_PROGRESS_SEND_MODE_KEY)
  if (v === 'steer' || v === 'queue') return v
  return 'queue'
}

function loadChatWidthPref(): ChatWidthMode {
  if (typeof window === 'undefined') return 'standard'
  const value = window.localStorage.getItem(CHAT_WIDTH_KEY)
  return value === 'standard' || value === 'wide' || value === 'extra-wide' ? value : 'standard'
}

function toggleSendWithEnter(): void {
  sendWithEnter.value = !sendWithEnter.value
  window.localStorage.setItem(SEND_WITH_ENTER_KEY, sendWithEnter.value ? '1' : '0')
}

function cycleInProgressSendMode(): void {
  inProgressSendMode.value = inProgressSendMode.value === 'steer' ? 'queue' : 'steer'
  window.localStorage.setItem(IN_PROGRESS_SEND_MODE_KEY, inProgressSendMode.value)
}

function cycleDarkMode(): void {
  const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
  const idx = order.indexOf(darkMode.value)
  darkMode.value = order[(idx + 1) % order.length]
  window.localStorage.setItem(DARK_MODE_KEY, darkMode.value)
  applyDarkMode()
}

function cycleChatWidth(): void {
  const order: ChatWidthMode[] = ['standard', 'wide', 'extra-wide']
  const idx = order.indexOf(chatWidth.value)
  chatWidth.value = order[(idx + 1) % order.length]
  window.localStorage.setItem(CHAT_WIDTH_KEY, chatWidth.value)
}

function toggleDictationClickToToggle(): void {
  dictationClickToToggle.value = !dictationClickToToggle.value
  window.localStorage.setItem(DICTATION_CLICK_TO_TOGGLE_KEY, dictationClickToToggle.value ? '1' : '0')
}

function toggleDictationAutoSend(): void {
  dictationAutoSend.value = !dictationAutoSend.value
  window.localStorage.setItem(DICTATION_AUTO_SEND_KEY, dictationAutoSend.value ? '1' : '0')
}

async function loadFreeModeStatus(): Promise<void> {
  try {
    const previousProvider = selectedProvider.value
    const status = await getFreeModeStatus()
    freeModeEnabled.value = status.enabled
    freeModeHasCustomKey.value = status.customKey ?? false
    freeModeCustomKeyMasked.value = status.maskedKey ?? null
    if (status.enabled) {
      if (status.provider === 'opencode-zen') {
        selectedProvider.value = 'opencode-zen'
      } else if (status.provider === 'custom') {
        selectedProvider.value = 'custom'
        customEndpointUrl.value = status.customBaseUrl ?? ''
        customEndpointWireApi.value = status.wireApi === 'chat' ? 'chat' : 'responses'
      } else {
        selectedProvider.value = 'openrouter'
        openRouterWireApi.value = status.wireApi === 'chat' ? 'chat' : 'responses'
      }
    } else {
      selectedProvider.value = 'codex'
    }
    // A failed credential-service probe is unknown, not a sign-out.
    if (typeof status.hasCodexAuth === 'boolean') {
      externalCodexAuthAvailable = status.hasCodexAuth
      if (!externalCodexAuthAvailable) {
        externalAuthImportAttempted = false
      }
    }
    const providerChanged = selectedProvider.value !== previousProvider
    if (providerChanged) {
      await refreshAll({
        includeSelectedThreadMessages: false,
        providerChanged: true,
        awaitAncillaryRefreshes: true,
      })
    }
    const importedExternalAuth = await maybeImportExternalCodexAuthAccount()
    if (importedExternalAuth) {
      await refreshAll({
        includeSelectedThreadMessages: false,
        providerChanged: providerChanged || importedExternalAuth,
        awaitAncillaryRefreshes: true,
      })
    }
  } catch {
    // Ignore — free mode status unknown
  }
}

function onDictationLanguageChange(nextValue: string): void {
  const normalized = normalizeToWhisperLanguage(nextValue.trim())
  const value = normalized || 'auto'
  dictationLanguage.value = value
  window.localStorage.setItem(DICTATION_LANGUAGE_KEY, value)
}

function loadDictationLanguagePref(): string {
  if (typeof window === 'undefined') return 'auto'
  const value = window.localStorage.getItem(DICTATION_LANGUAGE_KEY)?.trim() || 'auto'
  const normalized = normalizeToWhisperLanguage(value)
  return normalized || 'auto'
}

function buildDictationLanguageOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [{ value: 'auto', label: t('Auto-detect') }]
  const seen = new Set<string>(['auto'])
  function formatLanguageLabel(value: string): string {
    const languageName = WHISPER_LANGUAGES[value] || value
    const title = languageName.charAt(0).toUpperCase() + languageName.slice(1)
    return `${title} (${value})`
  }

  for (const raw of typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []) {
    const value = normalizeToWhisperLanguage(raw)
    if (!value || seen.has(value)) continue
    seen.add(value)
    options.push({
      value,
      label: `Preferred: ${formatLanguageLabel(value)}`,
    })
  }

  for (const value of Object.keys(WHISPER_LANGUAGES)) {
    if (seen.has(value)) continue
    seen.add(value)
    options.push({
      value,
      label: formatLanguageLabel(value),
    })
  }

  const current = dictationLanguage.value.trim()
  if (current && !seen.has(current)) {
    options.push({
      value: current,
      label: formatLanguageLabel(current),
    })
  }

  return options
}

function normalizeToWhisperLanguage(raw: string): string {
  const value = raw.trim().toLowerCase()
  if (!value || value === 'auto') return ''
  if (value in WHISPER_LANGUAGES) return value
  const base = value.split('-')[0] ?? value
  if (base in WHISPER_LANGUAGES) return base
  return ''
}

function applyDarkMode(): void {
  const root = document.documentElement
  if (darkMode.value === 'dark') {
    root.classList.add('dark')
  } else if (darkMode.value === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

function loadSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

function saveSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, value ? '1' : '0')
}

function loadAccountsSectionCollapsed(): boolean {
  if (typeof window === 'undefined') return true
  const value = window.localStorage.getItem(ACCOUNTS_SECTION_COLLAPSED_STORAGE_KEY)
  if (value === null) return true
  return value === '1'
}

function toggleAccountsSectionCollapsed(): void {
  isAccountsSectionCollapsed.value = !isAccountsSectionCollapsed.value
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    ACCOUNTS_SECTION_COLLAPSED_STORAGE_KEY,
    isAccountsSectionCollapsed.value ? '1' : '0',
  )
}

function normalizeMessageType(rawType: string | undefined, role: string): string {
  const normalized = (rawType ?? '').trim()
  if (normalized.length > 0) {
    return normalized
  }
  return role.trim() || 'message'
}

function onSelectCollaborationMode(mode: 'default' | 'plan'): void {
  setSelectedCollaborationMode(mode)
}

async function initialize(): Promise<void> {
  await router.isReady()

  if (route.name === 'thread' && routeThreadId.value) {
    primeSelectedThread(routeThreadId.value)
  } else if (route.name === 'home' || route.name === 'skills' || route.name === 'automations') {
    primeSelectedThread('', { persist: false })
  }

  await refreshAll({
    includeSelectedThreadMessages: route.name === 'thread',
  })
  void loadAccountsState({ silent: true })
  await applyLaunchProjectPathFromUrl()
  hasInitialized.value = true
  await syncThreadSelectionWithRoute()
  startPolling()
}

async function syncThreadSelectionWithRoute(): Promise<void> {
  if (isRouteSyncInProgress.value) {
    hasPendingRouteSync = true
    return
  }
  isRouteSyncInProgress.value = true

  try {
    do {
      hasPendingRouteSync = false

      if (route.name === 'home' || route.name === 'skills' || route.name === 'automations') {
        if (selectedThreadId.value !== '') {
          await selectThread('')
        }
        continue
      }

      if (route.name === 'thread') {
        const threadId = routeThreadId.value
        if (!threadId) continue

        if (selectedThreadId.value !== threadId) {
          const result = await selectThread(threadId)
          if (result === 'not-found') {
            continue
          }
        } else {
          void ensureThreadMessagesLoaded(threadId, { silent: true }).catch(() => {
            // The conversation overlay receives the error from useDesktopState.
          })
        }
      }
    } while (hasPendingRouteSync)

  } finally {
    isRouteSyncInProgress.value = false
  }
}

watch(
  () =>
    [
      route.name,
      routeThreadId.value,
      isLoadingThreads.value,
      selectedThreadId.value,
    ] as const,
  async () => {
    if (!hasInitialized.value) return
    await syncThreadSelectionWithRoute()
  },
)

watch(
  () => composerCwd.value,
  () => {
    void refreshTerminalQuickCommands()
  },
)

watch(
  () => [selectedThreadId.value, composerCwd.value] as const,
  () => {
    clearCommitReviewContext()
  },
)

watch(
  () => [route.name, composerCwd.value] as const,
  ([routeName, cwd]) => {
    if (routeName !== 'thread') return
    void loadGitRepoStatus(cwd)
  },
  { immediate: true },
)

watch(
  () => selectedThreadId.value,
  async (threadId) => {
    if (!hasInitialized.value) return
    if (isRouteSyncInProgress.value) return
    if (isHomeRoute.value || isSkillsRoute.value || isAutomationsRoute.value) return

    if (!threadId) {
      if (route.name !== 'home') {
        await router.replace({ name: 'home' })
      }
      return
    }

    if (route.name === 'thread' && routeThreadId.value === threadId) return
    await router.replace({ name: 'thread', params: { threadId } })
  },
)

watch(
  () => newThreadFolderOptions.value,
  (options) => {
    if (options.length === 0) {
      newThreadCwd.value = ''
      void refreshDefaultProjectName()
      return
    }
    const selected = newThreadCwd.value.trim()
    if (selected) {
      const hasSelected = options.some((option) => option.value === selected)
      if (!hasSelected) {
        newThreadCwd.value = ''
      }
    }
    void refreshDefaultProjectName()
  },
  { immediate: true },
)

watch(
  () => newThreadCwd.value,
  () => {
    worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
    void refreshDefaultProjectName()
  },
)

watch(
  () => [route.name, newThreadCwd.value] as const,
  ([routeName, cwd]) => {
    if (routeName !== 'home') return
    void loadGitRepoStatus(cwd)
  },
  { immediate: true },
)

watch(
  isNewThreadCwdGitRepo,
  (isGitRepo) => {
    if (!isGitRepo && newThreadRuntime.value === 'worktree') {
      newThreadRuntime.value = 'local'
    }
  },
  { immediate: true },
)

watch(
  () => [newThreadRuntime.value, newThreadCwd.value] as const,
  ([runtime, cwd]) => {
    if (runtime !== 'worktree' || !isNewThreadCwdGitRepo.value) return
    void loadWorktreeBranches(cwd)
  },
  { immediate: true },
)

watch(
  () => newThreadRuntime.value,
  (runtime) => {
    if (runtime === 'local') {
      worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
      const current = newThreadCwd.value.trim()
      if (current && isWorktreePath(current)) {
        const fallbackProjectName = selectedThread.value?.projectName ?? getPathLeafName(current)
        const localCwd = resolvePreferredLocalCwd(fallbackProjectName, '')
        if (localCwd) {
          newThreadCwd.value = localCwd
        }
      }
      return
    }
    if (isNewThreadCwdGitRepo.value) {
      void loadWorktreeBranches(newThreadCwd.value)
    }
  },
)

watch(
  () => route.name,
  (name) => {
    if (name !== 'home') {
      worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
    }
    if (name !== 'thread') {
      isReviewPaneOpen.value = false
    }
  },
)

watch(
  () => selectedThreadId.value,
  () => {
    worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
  },
)

watch(
  () => [route.name, composerCwd.value, isNewThreadCwdGitRepo.value] as const,
  ([routeName, cwd, isNewThreadGitRepo]) => {
    const shouldLoadBranches = routeName === 'thread' || (routeName === 'home' && isNewThreadGitRepo)
    if (!shouldLoadBranches) {
      resetThreadBranchState()
      return
    }
    threadBranchCommitsRequestId += 1
    threadBranchCommitsByBranch.value = {}
    threadBranchCommitsLoadingFor.value = ''
    threadBranchCommitsError.value = ''
    void loadThreadBranches(cwd)
  },
  { immediate: true },
)

watch(
  pageTitle,
  (value) => {
    if (typeof document === 'undefined') return
    document.title = value
  },
  { immediate: true },
)

watch(isMobile, (mobile) => {
  if (mobile && !isSidebarCollapsed.value) {
    setSidebarCollapsed(true)
  }
}, { immediate: true })

async function submitFirstMessageForNewThread(
  text: string,
  imageUrls: string[] = [],
  skills: Array<{ name: string; path: string }> = [],
  fileAttachments: Array<{ label: string; path: string; fsPath: string }> = [],
): Promise<void> {
  try {
    worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
    let targetCwd = newThreadCwd.value
    if (newThreadRuntime.value === 'worktree') {
      worktreeInitStatus.value = {
        phase: 'running',
        title: t('Creating worktree'),
        message: t('Creating a worktree and running setup.'),
      }
      try {
        const created = await createWorktree(newThreadCwd.value, newWorktreeBaseBranch.value)
        targetCwd = created.cwd
        newThreadCwd.value = created.cwd
        worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
      } catch {
        worktreeInitStatus.value = {
          phase: 'error',
          title: t('Worktree setup failed'),
          message: t('Unable to create worktree. Try again or switch to Local project.'),
        }
        return
      }
    } else if (!targetCwd.trim()) {
      const directory = await createProjectlessThreadDirectory(text)
      targetCwd = directory.cwd
      newThreadCwd.value = directory.cwd
    }
    const threadId = await sendMessageToNewThread(text, targetCwd, imageUrls, skills, fileAttachments)
    if (!threadId) return
    await router.replace({ name: 'thread', params: { threadId } })
    scheduleMobileConversationJumpToLatest()
  } catch {
    // Error is already reflected in state.
  }
}

function buildDirectoryTryPrompt(payload: DirectoryTryItemPayload): string {
  if (payload.prompt?.trim()) return payload.prompt.trim()
  const label = payload.displayName.trim() || payload.name.trim()
  const itemType = payload.kind === 'skill'
    ? 'skill'
    : payload.kind === 'plugin'
      ? 'plugin'
      : payload.kind === 'composio'
        ? 'Composio connector'
        : 'app'
  return `Test ${label} ${itemType}. Give me a list of what it can do and one useful example.`
}

function getDirectoryTryItemKey(payload: DirectoryTryItemPayload): string {
  return `${payload.kind}:${payload.name}:${payload.skillPath ?? ''}`
}

async function onTryDirectoryItem(payload: DirectoryTryItemPayload): Promise<void> {
  if (directoryTryInFlightKey.value) return
  directoryTryInFlightKey.value = getDirectoryTryItemKey(payload)
  const text = buildDirectoryTryPrompt(payload)
  const skills = payload.attachedSkills?.length
    ? payload.attachedSkills
    : payload.kind === 'skill' && payload.skillPath
    ? [{ name: payload.name, path: payload.skillPath }]
    : []
  try {
    const targetCwd = directoryCwd.value.trim() || composerCwd.value.trim()
    const threadId = await sendMessageToNewThread(text, targetCwd, [], skills, [])
    if (!threadId) return
    await router.replace({ name: 'thread', params: { threadId } })
    scheduleMobileConversationJumpToLatest()
  } catch {
    // Error is already reflected in shared thread state.
  } finally {
    directoryTryInFlightKey.value = ''
  }
}

async function loadWorktreeBranches(sourceCwd: string): Promise<void> {
  const normalizedSourceCwd = sourceCwd.trim()
  if (!normalizedSourceCwd) {
    worktreeBranchOptions.value = []
    newWorktreeBaseBranch.value = ''
    return
  }

  isLoadingWorktreeBranches.value = true
  try {
    const options = await getWorktreeBranchOptions(normalizedSourceCwd)
    worktreeBranchOptions.value = options
    const currentSelection = newWorktreeBaseBranch.value.trim()
    const hasCurrentSelection = currentSelection.length > 0 && options.some((option) => option.value === currentSelection)
    if (!hasCurrentSelection) {
      const preferredMainOption = options.find((option) => option.value.trim() === 'main')
      newWorktreeBaseBranch.value = preferredMainOption?.value ?? options[0]?.value ?? ''
    }
  } catch {
    worktreeBranchOptions.value = []
    newWorktreeBaseBranch.value = ''
  } finally {
    isLoadingWorktreeBranches.value = false
  }
}

function toggleTelegramConfig(): void {
  isTelegramConfigOpen.value = !isTelegramConfigOpen.value
  clearInterval(telegramStatusTimer)
  if (isTelegramConfigOpen.value) {
    void refreshTelegramStatus()
    telegramStatusTimer = setInterval(() => { void refreshTelegramStatus() }, 10000)
  }
}

watch(isSettingsOpen, (open) => {
  if (open) { void refreshTelegramConfig(); void refreshTelegramStatus() }
})

const settingsContext = { RateLimitStatus, t, uiLanguage, uiLanguageOptions, setUiLanguage, worktreeName, appVersion, SETTINGS_HELP, accountRateLimitSnapshots, refreshAll, startPolling, stopPolling, feedbackMailto, prepareFeedbackLink, isAccountsSectionCollapsed, accounts, isRefreshingAccounts, isSwitchingAccounts, isStartingCodexLogin, isCompletingCodexLogin, isCodexLoginModalOpen, codexLoginUrl, codexLoginCallbackUrl, codexLoginCallbackInputRef, removingAccountId, confirmingRemoveAccountId, hoveredAccountId, accountActionError, sendWithEnter, inProgressSendMode, darkMode, chatWidth, dictationClickToToggle, dictationAutoSend, dictationLanguage, dictationLanguageOptions, freeModeEnabled, freeModeLoading, freeModeCustomKey, freeModeHasCustomKey, freeModeCustomKeyMasked, freeModeCustomKeySaving, providerError, selectedProvider, providerDropdownOptions, customEndpointUrl, customEndpointKey, customEndpointWireApi, openRouterWireApi, opencodeZenKey, isTelegramConfigOpen, telegramBotTokenDraft, telegramAllowedUserIdsDraft, telegramNotifyEnabledDraft, telegramNotifyChatIdDraft, telegramAppUrlDraft, telegramConfigError, isTelegramSaving, isTelegramTesting, telegramTestError, telegramTestUnavailable, telegramNotificationStatusText, hasVisibleFeedbackError, telegramStatus, showThreadContextBadge, isAccountSwitchBlocked, threadContextBadgeState, threadContextPrimaryText, threadContextSecondaryText, threadContextTooltip, chatWidthLabel, telegramStatusText, refreshTelegramStatus, refreshTelegramConfig, toggleTelegramConfig, isAccountUnavailable, loadAccountsState, toggleSendWithEnter, cycleInProgressSendMode, cycleDarkMode, cycleChatWidth, toggleDictationClickToToggle, toggleDictationAutoSend, loadFreeModeStatus, onDictationLanguageChange, toggleAccountsSectionCollapsed }

const projectContext = { t, refreshAll, pinProjectToTop, feedbackMailto, prepareFeedbackLink, newThreadCwd, projectZipExportStatus, defaultNewProjectName, createFolderInputRef, projectZipProgressText, projectZipProgressWidth, isCreateFolderOpen, createFolderDraft, createFolderError, isCreatingFolder, isProjectSetupModalOpen, projectSetupMode, projectSetupBaseDir, projectNameDraft, githubCloneUrlDraft, isProjectImporting, projectSetupError, isProjectSetupSubmitting, projectSetupPrimaryInputRef, isExistingFolderPickerOpen, existingFolderPathInputRef, existingFolderFilterInputRef, existingFolderPathDraft, existingFolderBrowsePath, existingFolderParentPath, existingFolderEntries, existingFolderError, isExistingFolderLoading, isOpeningExistingFolder, showHiddenFolders, existingFolderFilter, existingFolderBrowseRequestId, createFolderParentPath, isCreateFolderNameValid, canCreateFolder, isProjectNameDraftValid, canSubmitProjectSetup, resolvedExistingFolderPath, createFolderSubmitLabel, projectSetupSubmitLabel, existingFolderFilteredEntries, resolveProjectBaseDirectory, refreshDefaultProjectName, loadWorkspaceRootOptionsState, joinPath, normalizeAbsolutePath }
const projectDeferred = deferredActions(() => import('./features/projectActions').then(m => m.createProjectActions(projectContext)))
const { error: projectLoadError, retry: retryProject } = projectDeferred

const ProjectDialogs = lazyFeature(() => import('./features/ProjectDialogs.vue'))
</script>

<style scoped>
@reference "tailwindcss";

.sidebar-root {
  @apply h-full flex flex-col select-none;
}

.sidebar-root input,
.sidebar-root textarea {
  @apply select-text;
}

.sidebar-scrollable {
  @apply flex-1 min-h-0 overflow-y-auto py-4 px-2 flex flex-col gap-2;
}

.content-root {
  @apply h-full min-h-0 min-w-0 w-full flex flex-col overflow-y-hidden overflow-x-hidden bg-white;
}

.content-root.is-virtual-keyboard-open {
  height: var(--visual-viewport-height);
  max-height: var(--visual-viewport-height);
  transform: translateY(var(--visual-viewport-offset-top));
}

.sidebar-thread-controls-host {
  @apply mt-1 -translate-y-px px-2 pb-1;
}

.sidebar-search-toggle {
  @apply h-6.75 w-6.75 rounded-md border border-transparent bg-transparent text-zinc-600 flex items-center justify-center transition hover:border-zinc-200 hover:bg-zinc-50;
}

.sidebar-search-toggle[aria-pressed='true'],
.sidebar-search-toggle.is-active {
  @apply border-zinc-300 bg-zinc-100 text-zinc-700;
}

.sidebar-search-toggle-icon {
  @apply w-4 h-4;
}

.sidebar-search-bar {
  @apply flex items-center gap-1.5 mx-2 px-2 py-1 rounded-md border border-zinc-200 bg-white transition-colors focus-within:border-zinc-400;
}

.sidebar-search-bar-icon {
  @apply w-3.5 h-3.5 text-zinc-400 shrink-0;
}

.sidebar-search-input {
  @apply flex-1 min-w-0 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none border-none p-0;
}

.sidebar-search-clear {
  @apply w-4 h-4 rounded text-zinc-400 flex items-center justify-center transition hover:text-zinc-600;
}

.sidebar-search-clear-icon {
  @apply w-3.5 h-3.5;
}

.sidebar-skills-link.is-active {
  @apply border-transparent bg-zinc-100 text-zinc-950;
}

.sidebar-thread-controls-header-host {
  @apply ml-1;
}

.skills-route-header-icon {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_16px_32px_-20px_rgba(5,150,105,0.9)];
}

.automations-route-header-icon {
  @apply bg-amber-500 shadow-[0_16px_32px_-20px_rgba(245,158,11,0.9)];
}

.skills-route-header-icon :deep(svg) {
  @apply h-4.5 w-4.5;
}

.content-body {
  @apply flex-1 min-h-0 min-w-0 w-full flex flex-col gap-2 sm:gap-3 pt-1 pb-2 sm:pb-4 overflow-x-hidden;
}

.content-root.is-virtual-keyboard-open .content-body {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}

.content-root.is-virtual-keyboard-open .content-grid {
  gap: 0.5rem;
}

.content-root.is-virtual-keyboard-open .content-thread {
  min-height: 0;
}

.content-root.is-virtual-keyboard-open .composer-with-queue {
  gap: 0.375rem;
  padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
}

.content-root.is-virtual-keyboard-open .content-thread-terminal-panel {
  min-height: 0;
}

.content-root.is-virtual-keyboard-open .content-keyboard-spacer {
  display: none;
}

.content-grid {
  @apply flex-1 min-h-0 flex flex-col gap-3;
}

.content-grid-home {
  @apply overflow-y-auto;
}

.content-thread {
  @apply flex-1 min-h-0;
}

.composer-with-queue {
  @apply w-full shrink-0 px-2 sm:px-6 flex flex-col gap-2;
}

.composer-runtime-error {
  @apply flex w-full items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 shadow-sm;
}

.visible-error-with-feedback {
  @apply flex items-start justify-between gap-3;
}

.visible-error-feedback {
  @apply shrink-0 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300;
}

.content-thread-terminal-panel {
  @apply w-full;
}

.content-header-terminal-command {
  @apply max-w-48;
}

.content-header-terminal-command :deep(.composer-dropdown-trigger) {
  @apply h-8 rounded-full border border-zinc-200 bg-white px-3 text-xs text-zinc-700 outline-none transition hover:bg-zinc-50 focus:border-zinc-300;
}

.content-header-terminal-command :deep(.composer-dropdown-prefix-icon) {
  @apply h-4 w-4 text-zinc-500;
}

.content-header-terminal-command.is-open :deep(.composer-dropdown-trigger) {
  @apply border-zinc-300 bg-zinc-100 text-zinc-950;
}

.content-header-terminal-command :deep(.composer-dropdown-menu-wrap) {
  left: auto;
  right: 0;
}

.content-header-terminal-command :deep(.composer-dropdown-menu) {
  width: min(18rem, calc(100vw - 1rem));
  min-width: min(14rem, calc(100vw - 1rem));
}

.content-header-terminal-command :deep(.composer-dropdown-option) {
  @apply block truncate;
}

.content-header-terminal-command :deep(.composer-dropdown-trigger) {
  @apply rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50;
}

.content-header-terminal-command :deep(.composer-dropdown-prefix-icon),
.content-header-branch-dropdown :deep(.composer-dropdown-prefix-icon) {
  @apply h-4 w-4 text-zinc-600;
}

.content-header-terminal-command :deep(.composer-dropdown-trigger),
.content-header-branch-dropdown :deep(.composer-dropdown-trigger) {
  @apply gap-0.5;
}

.content-header-branch-dropdown :deep(.composer-dropdown-trigger) {
  @apply rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50;
}

.content-header-branch-dropdown :deep(.composer-dropdown-value) {
  @apply max-w-40 truncate;
}

.content-header-branch-dropdown :deep(.composer-dropdown-menu-wrap) {
  left: auto;
  right: 0;
}

.content-header-branch-dropdown.is-review-open :deep(.composer-dropdown-trigger) {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

.content-header-branch-dropdown.is-review-open :deep(.composer-dropdown-chevron) {
  @apply text-white;
}

.new-thread-empty {
  @apply flex-1 min-h-0 flex flex-col items-center justify-center gap-0.5 px-3 sm:px-6;
}

.new-thread-hero {
  @apply m-0 text-2xl sm:text-[2.5rem] font-normal leading-[1.05] text-zinc-900;
}

.new-thread-folder-dropdown {
  @apply text-2xl sm:text-[2.5rem] text-zinc-500;
}

.new-thread-folder-dropdown :deep(.composer-dropdown-trigger) {
  @apply h-auto p-0 text-2xl sm:text-[2.5rem] leading-[1.05];
}

.new-thread-folder-dropdown :deep(.composer-dropdown-value) {
  @apply leading-[1.05];
}

.new-thread-folder-dropdown :deep(.composer-dropdown-chevron) {
  @apply h-4 w-4 sm:h-5 sm:w-5 mt-0;
}

.new-thread-folder-selected {
  @apply mt-2 mb-0 max-w-3xl text-center text-xs text-zinc-500 break-all;
}

.new-thread-folder-actions {
  @apply mt-3 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2;
}

.new-thread-project-import-input {
  display: none;
}

.new-thread-folder-action {
  @apply inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.new-thread-folder-action-primary {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

.new-thread-project-mode-tab.is-active {
  @apply bg-white text-zinc-950 shadow-sm;
}

.new-thread-folder-action[aria-pressed='true'] {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

.new-thread-runtime-dropdown {
  @apply mt-3;
}

.new-thread-branch-select {
  @apply mt-3 w-full max-w-3xl;
}

.new-thread-branch-select-label {
  @apply m-0 mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500;
}

.new-thread-branch-dropdown :deep(.composer-dropdown-trigger) {
  @apply h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700;
}

.new-thread-branch-select-help {
  @apply mt-1 mb-0 text-xs text-zinc-500;
}

.new-thread-runtime-help {
  @apply mt-2 mb-0 max-w-3xl text-center text-xs text-zinc-500;
}

.worktree-init-status {
  @apply mt-3 flex w-full max-w-xl flex-col gap-1 rounded-xl border px-3 py-2 text-sm;
}

.worktree-init-status.is-running {
  @apply border-zinc-300 bg-zinc-50 text-zinc-700;
}

.worktree-init-status.is-error {
  @apply border-rose-300 bg-rose-50 text-rose-800;
}

.worktree-init-status-title {
  @apply font-medium;
}

.worktree-init-status-message {
  @apply break-all;
}

.sidebar-settings-area {
  @apply shrink-0 bg-slate-100 pt-2 px-2 pb-2 border-t border-zinc-200;
}

.sidebar-settings-button {
  @apply flex items-center gap-2 w-full rounded-lg border-0 bg-transparent px-2 py-2 text-sm text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 cursor-pointer;
}

.sidebar-settings-button-version {
  @apply ml-auto min-w-0 truncate text-right text-xs;
}

.sidebar-settings-icon {
  @apply w-4.5 h-4.5;
}

.sidebar-settings-panel {
  @apply mb-1 max-h-[min(70vh,36rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white;
}

.codex-login-modal-backdrop {
  @apply fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4;
}

.codex-login-modal {
  @apply flex w-full max-w-md flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl;
}

.codex-login-modal-header {
  @apply flex items-center justify-between gap-3;
}

.codex-login-modal-title {
  @apply text-base font-semibold text-zinc-900;
}

.codex-login-modal-close {
  @apply inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.codex-login-modal-copy {
  @apply text-sm leading-5 text-zinc-600;
}

.codex-login-modal-link {
  @apply min-w-0 truncate text-sm text-blue-600 hover:text-blue-700 hover:underline;
}

.codex-login-modal-input {
  @apply w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 disabled:cursor-default disabled:opacity-60;
}

.codex-login-modal-error {
  @apply rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700;
}

.codex-login-modal-actions {
  @apply flex items-center justify-end gap-2;
}

.codex-login-modal-cancel,
.codex-login-modal-submit {
  @apply rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.codex-login-modal-submit {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

:global(:root.dark) .codex-login-modal {
  @apply border-zinc-700 bg-zinc-900;
}

:global(:root.dark) .codex-login-modal-title {
  @apply text-zinc-100;
}

:global(:root.dark) .codex-login-modal-close,
:global(:root.dark) .codex-login-modal-cancel {
  @apply border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700;
}

:global(:root.dark) .codex-login-modal-copy {
  @apply text-zinc-300;
}

:global(:root.dark) .codex-login-modal-link {
  @apply text-sky-300 hover:text-sky-200;
}

:global(:root.dark) .codex-login-modal-input {
  @apply border-zinc-600 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400;
}

:global(:root.dark) .codex-login-modal-error {
  @apply bg-rose-950/40 text-rose-200;
}

:global(:root.dark) .codex-login-modal-submit {
  @apply border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-white;
}

.sidebar-settings-account-item.is-active {
  @apply border-emerald-200 bg-emerald-50;
}

.sidebar-settings-account-item.is-active .sidebar-settings-account-id {
  @apply bg-emerald-100 text-emerald-800;
}

.sidebar-settings-segmented-option.is-active {
  @apply bg-zinc-800 text-white;
}

:root.dark .sidebar-settings-segmented-option.is-active {
  @apply bg-zinc-100 text-zinc-900;
}
</style>
