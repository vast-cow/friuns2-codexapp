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

          <SidebarThreadTree :groups="projectGroups" :project-display-name-by-id="projectDisplayNameById"
            :project-git-repo-by-name="projectGitRepoByName"
            v-if="!isSidebarCollapsed"
            :selected-thread-id="selectedThreadId" :is-loading="isLoadingThreads"
            :is-thread-list-fully-loaded="isThreadListFullyLoaded"
            :search-query="sidebarSearchQuery"
            :search-matched-thread-ids="serverMatchedThreadIds"
            @select="onSelectThread"
            @archive="onArchiveThread" @start-new-thread="onStartNewThread" @rename-project="onRenameProject"
            @browse-thread-files="onBrowseThreadFiles"
            @browse-project-files="onBrowseProjectFiles"
            @request-project-git-status="onRequestProjectGitStatus"
            @create-project-worktree="onCreateProjectWorktree"
            @rename-thread="onRenameThread"
            @fork-thread="onForkThread"
            @remove-project="onRemoveProject" @reorder-project="onReorderProject"
            @copy-thread-chat="onCopyThreadChat"
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
              <div class="sidebar-settings-account-section">
                <div class="sidebar-settings-account-header">
                  <span class="sidebar-settings-account-title">{{ t('Codex account') }}</span>
                  <button class="sidebar-settings-account-refresh" type="button" :disabled="isRefreshingCodexAuth || isStartingCodexLogin || isCompletingCodexLogin" @click="onRefreshCodexAuth">{{ isRefreshingCodexAuth ? t('Reloading…') : t('Reload') }}</button>
                </div>
                <p class="sidebar-settings-account-empty">{{ codexAuthAvailable === true ? t('Signed in to Codex') : codexAuthAvailable === false ? t('Click Login, or run `codex login`, then click reload.') : t('Codex authentication status unavailable. Reload or use Codex CLI.') }}</p>
                <div v-if="accountActionError" class="sidebar-settings-account-error">{{ accountActionError }}</div>
                <div class="sidebar-settings-account-login">
                  <button class="sidebar-settings-account-login-button" type="button" :disabled="codexAuthAvailable === true || isCodexAuthChangeBlocked || isRefreshingCodexAuth || isStartingCodexLogin || isCompletingCodexLogin" @click="onStartCodexLogin">{{ isStartingCodexLogin ? t('Starting login…') : t('Login') }}</button>
                  <button v-if="codexAuthAvailable === true" class="sidebar-settings-account-login-button" type="button" :disabled="isCodexAuthChangeBlocked || isRefreshingCodexAuth" @click="onLogoutCodex">{{ t('Logout') }}</button>
                  <a v-if="codexLoginUrl" class="sidebar-settings-account-login-link" :href="codexLoginUrl" target="_blank" rel="noreferrer">{{ t('Open login URL') }}</a>
                </div>
              </div>

              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.sendWithEnter" @click="toggleSendWithEnter">
                <span class="sidebar-settings-label">{{ t('Require ⌘ + enter to send') }}</span>
                <span class="sidebar-settings-toggle" :class="{ 'is-on': !sendWithEnter }" />
              </button>
              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.inProgressSendMode" @click="cycleInProgressSendMode">
                <span class="sidebar-settings-label">{{ t('When busy, send as') }}</span>
                <span class="sidebar-settings-value">{{ inProgressSendMode === 'steer' ? t('Steer') : t('Queue') }}</span>
              </button>
              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.appearance" @click="cycleDarkMode">
                <span class="sidebar-settings-label">{{ t('Appearance') }}</span>
                <span class="sidebar-settings-value">{{ darkMode === 'system' ? t('System') : darkMode === 'dark' ? t('Dark') : t('Light') }}</span>
              </button>
              <div class="sidebar-settings-row sidebar-settings-row--select" :title="t('Choose the interface language for the app.')">
                <span class="sidebar-settings-label">{{ t('UI language') }}</span>
                <ComposerDropdown
                  class="sidebar-settings-picker-dropdown"
                  :model-value="uiLanguage"
                  :options="uiLanguageOptions"
                  :placeholder="t('UI language')"
                  menu-align="end"
                  @update:model-value="setUiLanguage($event as 'en' | 'zh-CN')"
                />
              </div>
              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.chatWidth" @click="cycleChatWidth">
                <span class="sidebar-settings-label">{{ t('Chat width') }}</span>
                <span class="sidebar-settings-value">{{ chatWidthLabel }}</span>
              </button>
              <button class="sidebar-settings-row" type="button" aria-live="polite" @click="toggleTelegramConfig">
                <span class="sidebar-settings-label">{{ t('Telegram') }}</span>
                <span class="sidebar-settings-value">{{ telegramStatusText }}</span>
              </button>
              <div v-if="isTelegramConfigOpen" class="sidebar-settings-telegram-panel">
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label">{{ t('Bot token') }}</span>
                  <input
                    v-model="telegramBotTokenDraft"
                    class="sidebar-settings-input"
                    type="password"
                    placeholder="123456:ABCDEF"
                    autocomplete="off"
                    spellcheck="false"
                  >
                </label>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label inline-flex items-center gap-1"><input v-model="telegramNotifyEnabledDraft" type="checkbox" />{{ t('Enable completion notifications') }}</span>
                </label>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label">{{ t('Destination chat ID') }}</span>
                  <input v-model="telegramNotifyChatIdDraft" class="sidebar-settings-input" type="text" inputmode="numeric" placeholder="123456789" />
                </label>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label">{{ t('App URL reachable from your phone') }}</span>
                  <input v-model="telegramAppUrlDraft" class="sidebar-settings-input" type="url" placeholder="https://your-app.example" />
                </label>
                <p class="sidebar-settings-field-help">{{ t('Notifies successful turns observed by this running backend. A finished turn does not guarantee the whole task succeeded.') }}</p>
                <div class="sidebar-settings-field-help" role="status">
                  <p>{{ t('Notification status') }}: {{ telegramNotificationStatusText }}</p>
                  <p v-if="telegramStatus.notification?.lastTestAt">{{ t('Last test') }}: {{ new Date(telegramStatus.notification.lastTestAt).toLocaleString() }}</p>
                  <p v-if="telegramStatus.notification?.lastSuccessAt">{{ t('Last notification sent') }}: {{ new Date(telegramStatus.notification.lastSuccessAt).toLocaleString() }}</p>
                  <p v-if="telegramStatus.notification?.lastFailureAt">{{ t('Last notification failure') }}: {{ new Date(telegramStatus.notification.lastFailureAt).toLocaleString() }}</p>
                  <p v-if="telegramStatus.notification?.pendingCount">{{ t('Pending notifications') }}: {{ telegramStatus.notification.pendingCount }} ({{ t('retrying') }}: {{ telegramStatus.notification.retryingCount }})</p>
                  <p v-if="telegramStatus.notification?.lastError">{{ t('Notification delivery failed') }}: {{ telegramStatus.notification.lastError }}</p>
                  <template v-if="telegramStatus.notification?.lastTestResult === 'failure'">
                    <p>{{ t('Check the bot token, chat ID, network connection, DNS, and proxy settings.') }}</p>
                    <p>{{ t('Technical details') }}: {{ telegramStatus.notification.lastTestError }}</p>
                  </template>
                  <p v-if="telegramTestUnavailable">{{ telegramTestUnavailable }}</p>
                  <p v-if="telegramTestError">{{ telegramTestError }}</p>
                  <p>{{ t('A successful test means Telegram accepted the message; it does not guarantee display on your device.') }}</p>
                </div>
                <button class="sidebar-settings-telegram-save" type="button" :disabled="Boolean(telegramTestUnavailable)" @click="sendTelegramTest">
                  {{ isTelegramTesting ? t('Sending test notification…') : telegramStatus.notification?.lastTestResult === 'failure' ? t('Retry Test Notification') : t('Send Test Notification') }}
                </button>
                <div v-if="telegramConfigError" class="sidebar-settings-telegram-error">
                  <span>{{ telegramConfigError }}</span>
                </div>
                <div class="sidebar-settings-telegram-actions">
                  <button
                    class="sidebar-settings-telegram-save"
                    type="button"
                    :disabled="isTelegramSaving"
                    @click="saveTelegramConfig"
                  >
                    {{ isTelegramSaving ? t('Saving…') : t('Save Telegram config') }}
                  </button>
                </div>
              </div>
              <div
                v-if="showThreadContextBadge"
                class="sidebar-settings-row sidebar-settings-context-row"
                :data-state="threadContextBadgeState"
                :title="threadContextTooltip"
              >
                <span class="sidebar-settings-label">{{ t('Context') }}</span>
                <span class="sidebar-settings-context-value" :data-state="threadContextBadgeState">
                  {{ threadContextPrimaryText }}
                  <span class="sidebar-settings-context-meta">{{ threadContextSecondaryText }}</span>
                </span>
              </div>
              <div class="sidebar-settings-rate-limits">
                <RateLimitStatus :snapshots="accountRateLimitSnapshots" />
              </div>
              <div class="sidebar-settings-build-label" :aria-label="t('Worktree name and version')">
                WT {{ worktreeName }} · v{{ appVersion }}
              </div>
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
          'is-virtual-keyboard-open': isVirtualKeyboardOpen,
        }"
        :style="contentStyle"
      >
        <span v-if="isVirtualKeyboardOpen" class="content-keyboard-spacer" aria-hidden="true" />
        <ContentHeader :title="contentTitle" :accent="isSkillsRoute">
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
                </div>
                <Teleport to="body">
                  <div v-if="isExistingFolderPickerOpen" class="new-thread-open-folder-overlay" @click.self="onCloseExistingFolderPanel">
                    <div class="new-thread-open-folder" role="dialog" aria-modal="true" :aria-label="t('Select folder')" @keydown.esc.prevent="onCloseExistingFolderPanel">
                      <div class="new-thread-open-folder-header">
                        <p class="new-thread-open-folder-title">{{ t('Select folder') }}</p>
                        <button class="new-thread-open-folder-close" type="button" @click="onCloseExistingFolderPanel">
                          {{ t('Cancel') }}
                        </button>
                      </div>
                      <p class="new-thread-open-folder-label">{{ t('Current folder') }}</p>
                      <div class="new-thread-open-folder-current">
                        <input
                          ref="existingFolderPathInputRef"
                          v-model="existingFolderPathDraft"
                          class="new-thread-open-folder-path"
                          type="text"
                          :placeholder="t('Current folder')"
                          :title="existingFolderPathDraft || t('Unavailable')"
                          :disabled="isExistingFolderLoading || isOpeningExistingFolder"
                          @keydown.enter.prevent="onRetryExistingFolderBrowse"
                          @keydown.esc.prevent="onCloseExistingFolderPanel"
                        />
                      </div>
                      <div class="new-thread-open-folder-actions">
                        <button
                          class="new-thread-folder-action"
                          type="button"
                          :disabled="!resolvedExistingFolderPath || isExistingFolderLoading || isOpeningExistingFolder"
                          @click="onRetryExistingFolderBrowse"
                        >
                          {{ t('Browse') }}
                        </button>
                        <button
                          class="new-thread-folder-action new-thread-folder-action-primary"
                          type="button"
                          :disabled="!resolvedExistingFolderPath || isExistingFolderLoading || isOpeningExistingFolder"
                          @click="onConfirmExistingFolder()"
                        >
                          {{ isOpeningExistingFolder ? t('Opening…') : t('Select') }}
                        </button>
                      </div>
                      <div class="new-thread-open-folder-actions">
                        <label class="new-thread-open-folder-toggle">
                          <input
                            v-model="showHiddenFolders"
                            class="new-thread-open-folder-toggle-input"
                            type="checkbox"
                            @change="onToggleHiddenFolders"
                          />
                          <span>{{ t('Show hidden folders') }}</span>
                        </label>
                        <button
                          class="new-thread-folder-action"
                          :class="{ 'new-thread-folder-action-primary': isCreateFolderOpen }"
                          type="button"
                          :aria-pressed="isCreateFolderOpen"
                          :disabled="!existingFolderBrowsePath || isExistingFolderLoading || isOpeningExistingFolder || isCreatingFolder || (!!existingFolderError && !isCreateFolderOpen)"
                          @click="onOpenCreateFolderPanel"
                        >
                          {{ t('New folder') }}
                        </button>
                      </div>
                      <div v-if="isCreateFolderOpen" class="new-thread-open-folder-create">
                        <div class="new-thread-open-folder-create-composer">
                          <input
                            ref="createFolderInputRef"
                            v-model="createFolderDraft"
                            class="new-thread-open-folder-create-input"
                            type="text"
                            :placeholder="t('Folder name')"
                            @keydown.enter.prevent="onCreateFolder"
                            @keydown.esc.prevent="onCloseCreateFolderPanel"
                          />
                          <button
                            class="new-thread-folder-action new-thread-folder-action-primary new-thread-open-folder-create-submit"
                            type="button"
                            :disabled="!canCreateFolder || isCreatingFolder"
                            @click="onCreateFolder"
                          >
                            {{ createFolderSubmitLabel }}
                          </button>
                        </div>
                        <div v-if="createFolderError" class="new-thread-open-folder-error">
                          <span>{{ createFolderError }}</span>
                        </div>
                      </div>
                      <input
                        ref="existingFolderFilterInputRef"
                        v-model="existingFolderFilter"
                        class="new-thread-open-folder-filter"
                        type="text"
                        :placeholder="t('Filter folders...')"
                        @keydown.esc.prevent="onCloseExistingFolderPanel"
                      />
                      <div v-if="existingFolderError" class="new-thread-open-folder-error-actions">
                        <div class="new-thread-open-folder-error">
                          <span>{{ existingFolderError }}</span>
                        </div>
                        <button
                          class="new-thread-folder-action"
                          type="button"
                          :disabled="isExistingFolderLoading || isOpeningExistingFolder"
                          @click="onRetryExistingFolderBrowse"
                        >
                          {{ t('Retry') }}
                        </button>
                      </div>
                      <p v-if="isExistingFolderLoading" class="new-thread-open-folder-status">{{ t('Loading folders…') }}</p>
                      <p v-else-if="!existingFolderError && existingFolderFilteredEntries.length === 0" class="new-thread-open-folder-status">
                        {{ existingFolderFilter.trim() ? t('No folders match this filter.') : t('No subfolders found here.') }}
                      </p>
                      <ul v-else-if="existingFolderFilteredEntries.length > 0" class="new-thread-open-folder-list">
                        <li v-for="entry in existingFolderFilteredEntries" :key="entry.key" class="new-thread-open-folder-item">
                          <button
                            class="new-thread-open-folder-item-main"
                            type="button"
                            :title="entry.path"
                            :disabled="isExistingFolderLoading || isOpeningExistingFolder"
                            @click="onBrowseExistingFolder(entry.path)"
                          >
                            <span class="new-thread-open-folder-item-name">{{ entry.name }}</span>
                          </button>
                          <button
                            v-if="entry.kind === 'directory'"
                            class="new-thread-open-folder-item-open"
                            type="button"
                            :disabled="isExistingFolderLoading || isOpeningExistingFolder"
                            @click="onConfirmExistingFolder(entry.path)"
                          >
                            {{ t('Select') }}
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </Teleport>
                <Teleport to="body">
                  <div v-if="isProjectSetupModalOpen" class="new-thread-open-folder-overlay" @click.self="onCloseProjectSetupModal">
                    <div class="new-thread-project-modal" role="dialog" aria-modal="true" :aria-label="t('Create or clone project')" @keydown.esc.prevent="onCloseProjectSetupModal">
                      <div class="new-thread-open-folder-header">
                        <p class="new-thread-open-folder-title">{{ t('Create or clone project') }}</p>
                        <button class="new-thread-open-folder-close" type="button" :disabled="isProjectSetupSubmitting" @click="onCloseProjectSetupModal">
                          {{ t('Cancel') }}
                        </button>
                      </div>
                      <div class="new-thread-project-mode-tabs" role="tablist" :aria-label="t('Project source')">
                        <button
                          class="new-thread-project-mode-tab"
                          :class="{ 'is-active': projectSetupMode === 'create' }"
                          type="button"
                          role="tab"
                          :aria-selected="projectSetupMode === 'create'"
                          :disabled="isProjectSetupSubmitting"
                          @click="projectSetupMode = 'create'"
                        >
                          {{ t('New project') }}
                        </button>
                        <button
                          class="new-thread-project-mode-tab"
                          :class="{ 'is-active': projectSetupMode === 'clone' }"
                          type="button"
                          role="tab"
                          :aria-selected="projectSetupMode === 'clone'"
                          :disabled="isProjectSetupSubmitting"
                          @click="projectSetupMode = 'clone'"
                        >
                          {{ t('Clone from GitHub') }}
                        </button>
                      </div>
                      <label class="new-thread-project-field">
                        <span class="new-thread-open-folder-label">{{ t('Destination folder') }}</span>
                        <input
                          v-model="projectSetupBaseDir"
                          class="new-thread-open-folder-path"
                          type="text"
                          :disabled="isProjectSetupSubmitting"
                          :placeholder="t('Destination folder')"
                        />
                      </label>
                      <label v-if="projectSetupMode === 'create'" class="new-thread-project-field">
                        <span class="new-thread-open-folder-label">{{ t('Project name') }}</span>
                        <input
                          ref="projectSetupPrimaryInputRef"
                          v-model="projectNameDraft"
                          class="new-thread-open-folder-create-input"
                          type="text"
                          :disabled="isProjectSetupSubmitting"
                          :placeholder="t('Project name')"
                          @keydown.enter.prevent="onSubmitProjectSetup"
                        />
                      </label>
                      <label v-else-if="projectSetupMode === 'clone'" class="new-thread-project-field">
                        <span class="new-thread-open-folder-label">{{ t('GitHub repository URL') }}</span>
                        <input
                          ref="projectSetupPrimaryInputRef"
                          v-model="githubCloneUrlDraft"
                          class="new-thread-open-folder-create-input"
                          type="url"
                          :disabled="isProjectSetupSubmitting"
                          placeholder="https://github.com/owner/repo"
                          @keydown.enter.prevent="onSubmitProjectSetup"
                        />
                      </label>
                      <div v-if="projectSetupError" class="new-thread-open-folder-error">
                        <span>{{ projectSetupError }}</span>
                      </div>
                      <div class="new-thread-project-modal-actions">
                        <button class="new-thread-folder-action" type="button" :disabled="isProjectSetupSubmitting" @click="onCloseProjectSetupModal">
                          {{ t('Cancel') }}
                        </button>
                        <button
                          class="new-thread-folder-action new-thread-folder-action-primary"
                          type="button"
                          :disabled="!canSubmitProjectSetup || isProjectSetupSubmitting"
                          @click="onSubmitProjectSetup"
                        >
                          {{ projectSetupSubmitLabel }}
                        </button>
                      </div>
                    </div>
                  </div>
                </Teleport>
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
                </div>
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
                  :is-turn-in-progress="false"
                  :is-stop-pending="false"
                  :is-interrupting-turn="false" :send-with-enter="sendWithEnter" :in-progress-submit-mode="inProgressSendMode"
                  @submit="onSubmitThreadMessage"
                  @update:selected-collaboration-mode="onSelectCollaborationMode"
                  @update:selected-model="onSelectModel"
                  @update:selected-reasoning-effort="onSelectReasoningEffort"
                  @update:selected-speed-mode="onSelectSpeedMode" />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="content-grid">
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
                  @implement-plan="onImplementPlan" />
              </div>

              <div class="composer-with-queue">
                <div v-if="codexCliMissingError" class="composer-runtime-error" role="alert">
                  <span>{{ t(codexCliMissingError) }}</span>
                </div>
                <QueuedMessages
                  :messages="selectedThreadQueuedMessages"
                  @edit="onEditQueuedMessage"
                  @steer="steerQueuedMessage"
                  @delete="removeQueuedMessage"
                  @reorder="onReorderQueuedMessage"
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
                  :is-turn-in-progress="isSelectedThreadInProgress"
                  :is-stop-pending="isSelectedThreadInterruptPending"
                  :is-interrupting-turn="isInterruptingTurn"
                  :has-queue-above="selectedThreadQueuedMessages.length > 0"
                  :send-with-enter="sendWithEnter" :in-progress-submit-mode="inProgressSendMode"
                  @update:selected-collaboration-mode="onSelectCollaborationMode"
                  @submit="onSubmitThreadMessage" @update:selected-model="onSelectModel"
                  @update:selected-reasoning-effort="onSelectReasoningEffort"
                  @update:selected-speed-mode="onSelectSpeedMode"
                  @edit-goal="threadGoalPanelRef?.edit()"
                  @interrupt="onInterruptTurn" />
              </div>
            </div>
          </template>
        </section>
      </section>
    </template>
  </DesktopLayout>
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
      <div v-if="accountActionError" class="codex-login-modal-error">
        <span>{{ accountActionError }}</span>
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
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DesktopLayout from './components/layout/DesktopLayout.vue'
import SidebarThreadTree from './components/sidebar/SidebarThreadTree.vue'
import ContentHeader from './components/content/ContentHeader.vue'
import ThreadGoalPanel from './components/content/ThreadGoalPanel.vue'
import ThreadComposer from './components/content/ThreadComposer.vue'
import ThreadPendingRequestPanel from './components/content/ThreadPendingRequestPanel.vue'
import QueuedMessages from './components/content/QueuedMessages.vue'
import RateLimitStatus from './components/content/RateLimitStatus.vue'
import ComposerDropdown from './components/content/ComposerDropdown.vue'
import ComposerRuntimeDropdown from './components/content/ComposerRuntimeDropdown.vue'
import SidebarThreadControls from './components/sidebar/SidebarThreadControls.vue'
import IconTablerBolt from './components/icons/IconTablerBolt.vue'
import IconTablerSearch from './components/icons/IconTablerSearch.vue'
import IconTablerSettings from './components/icons/IconTablerSettings.vue'
import IconTablerX from './components/icons/IconTablerX.vue'
import { useDesktopState } from './composables/useDesktopState'
import { useMobile } from './composables/useMobile'
import { useUiLanguage } from './composables/useUiLanguage'
import {
  cloneGithubRepository,
  configureTelegramBot,
  createPermanentWorktree,
  createWorktree,
  createProjectlessThreadDirectory,
  getGitRepositoryStatus,
  getWorktreeBranchOptions,
  completeCodexLogin,
  logoutCodex,
  createLocalDirectory,
  getHomeDirectory,
  getTelegramConfig,
  getProjectRootSuggestion,
  getTelegramStatus,
  sendTelegramTestNotification,
  getWorkspaceRootsState,
  listLocalDirectories,
  openProjectRoot,
  startCodexLogin,
  searchThreads,
} from './api/codexGateway'
import type { ReasoningEffort, SpeedMode, UiServerRequest, UiServerRequestReply, UiThreadTokenUsage } from './types/codex'
import type { ComposerDraftPayload, ThreadComposerExposed } from './components/content/ThreadComposer.vue'
import type { LocalDirectoryEntry, TelegramStatus, WorktreeBranchOption } from './api/codexGateway'
import { getCodexAuthenticationStatus } from './api/codexGateway'
import { getPathLeafName, getPathParent, isProjectlessChatPath, normalizePathForUi } from './pathUtils.js'
import { copyTextToClipboard } from './utils/clipboard'

const ThreadConversation = defineAsyncComponent(() => import('./components/content/ThreadConversation.vue'))
const DirectoryHub = defineAsyncComponent(() => import('./components/content/DirectoryHub.vue'))
const { t, uiLanguage, uiLanguageOptions, setUiLanguage } = useUiLanguage()

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'codex-web-local.sidebar-collapsed.v1'
const worktreeName = import.meta.env.VITE_WORKTREE_NAME ?? 'unknown'
const appVersion = import.meta.env.VITE_APP_VERSION ?? 'unknown'
const SETTINGS_HELP = {
  sendWithEnter: t('When enabled, press Enter to send. When disabled, use Command+Enter to send.'),
  inProgressSendMode: t('If a turn is still running, choose whether a new prompt should steer the current turn or be queued.'),
  appearance: t('Switch between system theme, light mode, and dark mode.'),
  chatWidth: t('Choose how wide the conversation column and composer can grow on desktop screens.'),
} as const

type ChatWidthMode = 'standard' | 'wide' | 'extra-wide'

type DirectoryTryItemPayload = {
  kind: 'app' | 'plugin' | 'skill'
  name: string
  displayName: string
  skillPath?: string
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

const {
  projectGroups,
  projectDisplayNameById,
  selectedThread,
  selectedThreadTokenUsage,
  selectedThreadServerRequests,
  selectedLiveOverlay,
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
const homeThreadComposerRef = ref<ThreadComposerExposed | null>(null)
const threadGoalPanelRef = ref<InstanceType<typeof ThreadGoalPanel> | null>(null)
const threadComposerRef = ref<ThreadComposerExposed | null>(null)
const threadConversationRef = ref<{ jumpToLatest: () => void } | null>(null)
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
let sidebarScrollTop = 0
let sidebarScrollRestoreRequestId = 0
let isRestoringSidebarScroll = false
const defaultNewProjectName = ref('New Project (1)')
const homeDirectory = ref('')
const isSettingsOpen = ref(false)
const createFolderInputRef = ref<HTMLInputElement | null>(null)
const isStartingCodexLogin = ref(false)
const isCompletingCodexLogin = ref(false)
const isCodexLoginModalOpen = ref(false)
const codexLoginUrl = ref('')
const codexLoginCallbackUrl = ref('')
const codexLoginCallbackInputRef = ref<HTMLInputElement | null>(null)
const accountActionError = ref('')
const codexAuthAvailable = ref<boolean | null>(null)
const isRefreshingCodexAuth = ref(false)
const SEND_WITH_ENTER_KEY = 'codex-web-local.send-with-enter.v1'
const IN_PROGRESS_SEND_MODE_KEY = 'codex-web-local.in-progress-send-mode.v1'
const DARK_MODE_KEY = 'codex-web-local.dark-mode.v1'

const CHAT_WIDTH_KEY = 'codex-web-local.chat-width.v1'
const sendWithEnter = ref(loadBoolPref(SEND_WITH_ENTER_KEY, true))
const inProgressSendMode = ref<'steer' | 'queue'>(loadInProgressSendModePref())
const darkMode = ref<'system' | 'light' | 'dark'>(loadDarkModePref())
const chatWidth = ref<ChatWidthMode>(loadChatWidthPref())
const isTelegramConfigOpen = ref(false)
const telegramBotTokenDraft = ref('')
const telegramNotifyEnabledDraft = ref(false)
const telegramNotifyChatIdDraft = ref('')
const telegramAppUrlDraft = ref('')
const telegramConfigError = ref('')
const isTelegramSaving = ref(false)
const isTelegramTesting = ref(false)
const telegramTestError = ref('')
const savedTelegramDraft = ref('')
const telegramDraftSnapshot = () => JSON.stringify([telegramBotTokenDraft.value, telegramNotifyEnabledDraft.value, telegramNotifyChatIdDraft.value, telegramAppUrlDraft.value])
const telegramTestUnavailable = computed(() => {
  if (isTelegramTesting.value) return t('Sending test notification…')
  if (isTelegramSaving.value) return t('Wait until settings are saved.')
  if (!telegramBotTokenDraft.value.trim()) return t('Configure a bot token before testing.')
  const id = telegramNotifyChatIdDraft.value.trim()
  if (!/^-?\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) === 0) return t('Configure a valid destination chat ID before testing.')
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
const projectSetupError = ref('')
const isProjectSetupSubmitting = ref(false)
const projectSetupPrimaryInputRef = ref<HTMLInputElement | null>(null)
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
const telegramStatus = ref<TelegramStatus>({
  configured: false,
  active: false,
  lastError: '',
})
let workspaceRootsResumeTimer: ReturnType<typeof setTimeout> | null = null
let workspaceRootsResumeInProgress = false
let lastWorkspaceRootsResumeAt = 0
const visualViewportHeight = ref(typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 0)
const visualViewportOffsetTop = ref(typeof window !== 'undefined' ? window.visualViewport?.offsetTop ?? 0 : 0)
const layoutViewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
let existingFolderBrowseRequestId = 0

const routeThreadId = computed(() => {
  const rawThreadId = route.params.threadId
  return typeof rawThreadId === 'string' ? rawThreadId : ''
})

const isHomeRoute = computed(() => route.name === 'home')
const isSkillsRoute = computed(() => route.name === 'skills')
const contentTitle = computed(() => {
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
const isVirtualKeyboardOpen = computed(() => {
  if (!isMobile.value) return false
  if (visualViewportHeight.value <= 0 || layoutViewportHeight.value <= 0) return false
  return layoutViewportHeight.value - visualViewportHeight.value > 120
})
const directoryCwd = computed(() => selectedThread.value?.cwd?.trim() ?? newThreadCwd.value.trim())
const isSelectedThreadInProgress = computed(() => !isHomeRoute.value && selectedThread.value?.inProgress === true)
const showThreadContextBadge = computed(() => !isHomeRoute.value && !isSkillsRoute.value && selectedThreadId.value.trim().length > 0)
const isCodexAuthChangeBlocked = computed(() =>
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
  return base
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
  void refreshTelegramConfig()
  void refreshTelegramStatus()
  void loadCodexAuthStatus()
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
  if (threadSearchTimer) {
    clearTimeout(threadSearchTimer)
    threadSearchTimer = null
  }
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
})

function onSkillsChanged(): void {
  void refreshSkills({ force: true })
}

async function refreshTelegramStatus(): Promise<void> {
  try {
    telegramStatus.value = await getTelegramStatus()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Telegram status'
    telegramStatus.value = {
      configured: false,
      active: false,
      lastError: message,
    }
  }
}

async function refreshTelegramConfig(): Promise<void> {
  try {
    const config = await getTelegramConfig()
    telegramBotTokenDraft.value = config.botToken
    telegramNotifyEnabledDraft.value = config.completionNotifications.enabled
    telegramNotifyChatIdDraft.value = config.completionNotifications.chatIds.join('')
    telegramAppUrlDraft.value = config.completionNotifications.appUrl
    savedTelegramDraft.value = telegramDraftSnapshot()
    telegramConfigError.value = ''
  } catch (error) {
    telegramConfigError.value = error instanceof Error ? error.message : 'Failed to load Telegram configuration'
  }
}

let telegramStatusTimer: ReturnType<typeof setInterval> | undefined
function toggleTelegramConfig(): void {
  isTelegramConfigOpen.value = !isTelegramConfigOpen.value
  clearInterval(telegramStatusTimer)
  if (isTelegramConfigOpen.value) {
    void refreshTelegramStatus()
    telegramStatusTimer = setInterval(() => { void refreshTelegramStatus() }, 10000)
  }
}

async function sendTelegramTest(): Promise<void> {
  if (telegramTestUnavailable.value) return
  isTelegramTesting.value = true
  telegramTestError.value = ''
  try {
    await sendTelegramTestNotification()
  } catch (error) {
    telegramTestError.value = error instanceof Error ? error.message : t('Test notification failed')
  } finally {
    await refreshTelegramStatus()
    isTelegramTesting.value = false
  }
}

async function saveTelegramConfig(): Promise<void> {
  const botToken = telegramBotTokenDraft.value.trim()
  if (!botToken) {
    telegramConfigError.value = t('Telegram bot token is required.')
    return
  }
  const chatIdText = telegramNotifyChatIdDraft.value.trim()
  const chatId = Number(chatIdText)
  if ((chatIdText || telegramNotifyEnabledDraft.value) && (!/^-?\d+$/.test(chatIdText) || !Number.isSafeInteger(chatId) || chatId === 0)) {
    telegramConfigError.value = t('Enter a nonzero destination Telegram chat ID.')
    return
  }
  const appUrl = telegramAppUrlDraft.value.trim()
  if (appUrl) {
    try {
      const url = new URL(appUrl)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL')
    } catch {
      telegramConfigError.value = t('Enter a valid HTTP or HTTPS app URL.')
      return
    }
  }
  isTelegramSaving.value = true
  telegramConfigError.value = ''
  try {
    await configureTelegramBot(botToken, {
      enabled: telegramNotifyEnabledDraft.value,
      chatIds: chatIdText ? [chatId] : [],
      appUrl,
    })
    await Promise.all([
      refreshTelegramConfig(),
      refreshTelegramStatus(),
    ])
  } catch (error) {
    telegramConfigError.value = error instanceof Error ? error.message : t('Failed to connect Telegram bot')
    void refreshTelegramStatus()
  } finally {
    isTelegramSaving.value = false
  }
}

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

async function onStartCodexLogin(): Promise<void> {
  if (isRefreshingCodexAuth.value || isStartingCodexLogin.value || isCompletingCodexLogin.value) return
  accountActionError.value = ''
  codexLoginCallbackUrl.value = ''
  isStartingCodexLogin.value = true
  try {
    const loginUrl = await startCodexLogin()
    codexLoginUrl.value = loginUrl
    isCodexLoginModalOpen.value = true
    window.open(loginUrl, '_blank', 'noopener,noreferrer')
    await nextTick()
    codexLoginCallbackInputRef.value?.focus()
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : t('Failed to start Codex login')
  } finally {
    isStartingCodexLogin.value = false
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
    await completeCodexLogin(callbackUrl)
    codexAuthAvailable.value = true
    await loadCodexAuthStatus()
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
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node)) return
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
  existingFolderBrowseRequestId += 1
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

async function loadExistingFolderListing(path: string): Promise<void> {
  const requestId = ++existingFolderBrowseRequestId
  const normalizedRequestedPath = normalizePathForUi(path).trim()
  existingFolderPathDraft.value = normalizedRequestedPath
  existingFolderBrowsePath.value = normalizedRequestedPath
  existingFolderError.value = ''
  isExistingFolderLoading.value = true

  try {
    const listing = await listLocalDirectories(path, { showHidden: showHiddenFolders.value })
    if (requestId !== existingFolderBrowseRequestId) return
    existingFolderPathDraft.value = listing.path
    existingFolderBrowsePath.value = listing.path
    existingFolderParentPath.value = listing.parentPath
    existingFolderEntries.value = listing.entries
  } catch (error) {
    if (requestId !== existingFolderBrowseRequestId) return
    existingFolderError.value = error instanceof Error ? error.message : 'Failed to load local folders.'
    existingFolderParentPath.value = getPathParent(existingFolderBrowsePath.value)
    existingFolderEntries.value = []
    onCloseCreateFolderPanel()
  } finally {
    if (requestId === existingFolderBrowseRequestId) {
      isExistingFolderLoading.value = false
    }
  }
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
  if (isHomeRoute.value || isSkillsRoute.value) return
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

async function loadCodexAuthStatus(): Promise<void> {
  try {
    const status = await getCodexAuthenticationStatus()
    if (typeof status === 'boolean') codexAuthAvailable.value = status
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : 'Unable to read Codex authentication status.'
  }
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
  } else if (route.name === 'home' || route.name === 'skills') {
    primeSelectedThread('', { persist: false })
  }

  await refreshAll({
    includeSelectedThreadMessages: route.name === 'thread',
  })
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

      if (route.name === 'home' || route.name === 'skills') {
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
    if (isHomeRoute.value || isSkillsRoute.value) return

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
  },
)

watch(
  () => selectedThreadId.value,
  () => {
    worktreeInitStatus.value = { phase: 'idle', title: '', message: '' }
  },
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
  const label = payload.displayName.trim() || payload.name.trim()
  const itemType = payload.kind === 'skill'
    ? 'skill'
    : payload.kind === 'plugin'
      ? 'plugin'
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
  const skills = payload.kind === 'skill' && payload.skillPath
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

async function onRefreshCodexAuth(): Promise<void> {
  if (isRefreshingCodexAuth.value) return
  isRefreshingCodexAuth.value = true
  accountActionError.value = ''
  try {
    await loadCodexAuthStatus()
    await refreshAll({ includeSelectedThreadMessages: false })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : 'Failed to refresh authentication'
  } finally {
    isRefreshingCodexAuth.value = false
  }
}
async function onLogoutCodex(): Promise<void> {
  if (isCodexAuthChangeBlocked.value || isRefreshingCodexAuth.value) return
  isRefreshingCodexAuth.value = true
  accountActionError.value = ''
  try {
    await logoutCodex()
    codexAuthAvailable.value = false
    await loadCodexAuthStatus()
    await refreshAll({ includeSelectedThreadMessages: false })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : 'Failed to log out'
  } finally {
    isRefreshingCodexAuth.value = false
  }
}
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

.sidebar-skills-link {
  @apply mx-2 flex items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-2.5 text-left text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 cursor-pointer;
}

.sidebar-skills-link.is-active {
  @apply border-transparent bg-zinc-100 text-zinc-950;
}

.sidebar-skills-link-icon {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white;
}

.sidebar-skills-link-icon :deep(svg) {
  @apply h-5 w-5;
}

.sidebar-skills-link-copy {
  @apply flex min-w-0 flex-col;
}

.sidebar-skills-link-title {
  @apply truncate text-sm font-semibold leading-5 tracking-[-0.01em];
}

.sidebar-skills-link-subtitle {
  @apply truncate text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500;
}

.sidebar-thread-controls-header-host {
  @apply ml-1;
}

.skills-route-header-icon {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_16px_32px_-20px_rgba(5,150,105,0.9)];
}

.skills-route-header-icon :deep(svg) {
  @apply h-4.5 w-4.5;
}

:global(:root.dark) .sidebar-skills-link-title {
  @apply text-zinc-50;
}

:global(:root.dark) .sidebar-skills-link-subtitle {
  @apply text-zinc-400;
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

.content-root.is-virtual-keyboard-open .content-keyboard-spacer {
  display: none;
}



.content-error {
  @apply m-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700;
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

.new-thread-folder-action {
  @apply inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.new-thread-folder-action-primary {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

.new-thread-open-folder-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4;
}

.new-thread-open-folder {
  @apply flex w-full max-w-3xl max-h-[90vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-xl;
}

.new-thread-project-modal {
  @apply flex w-full max-w-xl max-h-[90vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-xl;
}

.new-thread-open-folder-header {
  @apply flex items-center justify-between gap-3;
}

.new-thread-open-folder-title {
  @apply m-0 text-sm font-semibold text-zinc-900;
}

.new-thread-open-folder-close {
  @apply border-0 bg-transparent p-0 text-sm text-zinc-500 transition hover:text-zinc-800;
}

.new-thread-open-folder-label {
  @apply m-0 text-xs font-medium uppercase tracking-wide text-zinc-500;
}

.new-thread-open-folder-current {
  @apply flex items-start gap-2;
}

.new-thread-open-folder-path {
  @apply min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-700 outline-none transition focus:border-zinc-400;
}

.new-thread-open-folder-actions {
  @apply flex flex-wrap items-center gap-2;
}

.new-thread-project-mode-tabs {
  @apply grid grid-cols-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1;
}

.new-thread-project-mode-tab {
  @apply inline-flex h-9 items-center justify-center rounded-lg border-0 bg-transparent px-3 text-sm font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 disabled:cursor-default disabled:opacity-60;
}

.new-thread-project-mode-tab.is-active {
  @apply bg-white text-zinc-950 shadow-sm;
}

.new-thread-project-field {
  @apply flex flex-col gap-1.5;
}

.new-thread-project-modal-actions {
  @apply mt-1 flex flex-wrap justify-end gap-2;
}

.new-thread-open-folder-toggle {
  @apply inline-flex items-center gap-2 text-sm text-zinc-600;
}

.new-thread-open-folder-toggle-input {
  @apply relative h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-zinc-300 bg-white outline-none transition;
}

.new-thread-open-folder-toggle-input:focus-visible {
  box-shadow: 0 0 0 3px rgb(228 228 231);
}

.new-thread-open-folder-toggle-input:checked {
  border-color: rgb(24 24 27);
  background-color: rgb(255 255 255);
}

.new-thread-open-folder-toggle-input::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border-right: 2px solid rgb(24 24 27);
  border-bottom: 2px solid rgb(24 24 27);
  transform: rotate(45deg);
  opacity: 0;
}

.new-thread-open-folder-toggle-input:checked::after {
  opacity: 1;
}

.new-thread-open-folder-filter {
  @apply w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400;
}

.new-thread-open-folder-create {
  @apply flex flex-col gap-2;
}

.new-thread-open-folder-create-composer {
  @apply flex items-center gap-2;
}

.new-thread-open-folder-create-input {
  @apply w-full min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400;
}

.new-thread-open-folder-create-submit {
  @apply shrink-0;
}

.new-thread-folder-action[aria-pressed='true'] {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

.new-thread-open-folder-status {
  @apply m-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600;
}

.new-thread-open-folder-error {
  @apply m-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700;
}

.new-thread-open-folder-error-actions {
  @apply flex flex-wrap items-start gap-2;
}

.new-thread-open-folder-list {
  @apply m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0 pr-3;
  scrollbar-gutter: stable;
  scrollbar-color: rgb(161 161 170) rgb(244 244 245);
  scrollbar-width: thin;
}

.new-thread-open-folder-list::-webkit-scrollbar {
  width: 10px;
}

.new-thread-open-folder-list::-webkit-scrollbar-track {
  background: rgb(244 244 245);
  border-radius: 9999px;
}

.new-thread-open-folder-list::-webkit-scrollbar-thumb {
  background: rgb(161 161 170);
  border-radius: 9999px;
  border: 2px solid rgb(244 244 245);
}

.new-thread-open-folder-list::-webkit-scrollbar-thumb:hover {
  background: rgb(113 113 122);
}

.new-thread-open-folder-item {
  @apply grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1;
}

.new-thread-open-folder-item-main {
  @apply min-w-0 truncate rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left text-sm font-medium leading-5 text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-100;
}

.new-thread-open-folder-item-main:disabled,
.new-thread-open-folder-item-open:disabled {
  @apply cursor-default opacity-60;
}

.new-thread-open-folder-item-name {
  @apply block truncate;
}

.new-thread-open-folder-item-open {
  @apply inline-flex h-7 items-center justify-center rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50;
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

.sidebar-settings-row {
  @apply flex items-center justify-between w-full px-3 py-2.5 text-sm text-zinc-700 border-0 bg-transparent transition hover:bg-zinc-50 cursor-pointer;
}

.sidebar-settings-row--select {
  @apply cursor-default items-center gap-2;
}

.sidebar-settings-language-dropdown {
  @apply min-w-0 max-w-52;
}

.sidebar-settings-language-dropdown :deep(.composer-dropdown-trigger) {
  @apply h-auto rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700;
}

.sidebar-settings-language-dropdown :deep(.composer-dropdown-value) {
  @apply max-w-32;
}

.sidebar-settings-row + .sidebar-settings-row {
  @apply border-t border-zinc-100;
}

.sidebar-settings-telegram-panel {
  @apply border-t border-zinc-100 bg-zinc-50/70 px-3 py-3;
}

.sidebar-settings-field {
  @apply flex flex-col gap-1.5;
}

.sidebar-settings-field + .sidebar-settings-field {
  @apply mt-3;
}

.sidebar-settings-field-label {
  @apply text-xs font-medium text-zinc-700;
}

.sidebar-settings-input,
.sidebar-settings-textarea {
  @apply w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200;
}

.sidebar-settings-textarea {
  @apply min-h-20 resize-y font-mono text-xs;
}

.sidebar-settings-field-help {
  @apply mt-2 text-xs leading-5 text-zinc-500;
}

.sidebar-settings-telegram-error {
  @apply mt-2 rounded-md bg-rose-50 px-2.5 py-2 text-xs text-rose-700;
}

.sidebar-settings-telegram-actions {
  @apply mt-3 flex items-center justify-end;
}

.sidebar-settings-telegram-save {
  @apply rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.sidebar-settings-account-section {
  @apply border-t border-zinc-100 bg-zinc-50/60 px-3 py-3;
}

.sidebar-settings-account-header {
  @apply mb-2 flex items-center justify-between gap-2;
}




.sidebar-settings-account-title {
  @apply text-sm font-medium text-zinc-800;
}


.sidebar-settings-account-error {
  @apply mb-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700;
}

.sidebar-settings-account-refresh {
  @apply shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.sidebar-settings-account-login {
  @apply mb-2 flex items-center gap-2;
}

.sidebar-settings-account-login-button {
  @apply shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.sidebar-settings-account-login-link {
  @apply min-w-0 truncate text-xs text-blue-600 hover:text-blue-700 hover:underline;
}

.sidebar-settings-account-empty {
  @apply text-xs text-zinc-500;
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

















.sidebar-settings-label {
  @apply text-left;
}

.sidebar-settings-value {
  @apply text-xs text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5;
}


.sidebar-settings-toggle {
  @apply relative w-9 h-5 rounded-full bg-zinc-300 transition-colors shrink-0;
}

.sidebar-settings-toggle::after {
  content: '';
  @apply absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm;
}

.sidebar-settings-toggle.is-on {
  @apply bg-zinc-800;
}

.sidebar-settings-toggle.is-on::after {
  transform: translateX(16px);
}

.sidebar-settings-row--input {
  @apply flex flex-col gap-1 py-1.5;
}

.sidebar-settings-error {
  @apply text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 break-words;
}







.sidebar-settings-picker-dropdown {
  @apply min-w-0 max-w-44;
}

.sidebar-settings-picker-dropdown :deep(.composer-dropdown-trigger) {
  @apply h-auto rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700;
}

.sidebar-settings-picker-dropdown :deep(.composer-dropdown-value) {
  @apply max-w-36;
}















.settings-panel-enter-active,
.settings-panel-leave-active {
  transition: all 150ms ease;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.sidebar-settings-context-row {
  @apply cursor-default;
}

.sidebar-settings-context-value {
  @apply text-xs font-semibold text-zinc-700 text-right;
}

.sidebar-settings-context-value[data-state='ok'] {
  @apply text-emerald-700;
}

.sidebar-settings-context-value[data-state='warning'] {
  @apply text-amber-700;
}

.sidebar-settings-context-value[data-state='danger'] {
  @apply text-rose-700;
}

.sidebar-settings-context-meta {
  @apply block text-[11px] font-normal text-zinc-500;
}

.sidebar-settings-rate-limits {
  @apply border-t border-zinc-200 px-2 pt-2;
}

.sidebar-settings-build-label {
  @apply border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500;
}

</style>
