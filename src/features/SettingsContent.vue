<script setup lang="ts">
import ComposerDropdown from '../components/content/ComposerDropdown.vue'

import { nextTick } from 'vue'

import { removeAccount, refreshAccountsFromAuth, startCodexLogin, switchAccount } from '../api/codexGateway'
import { configureTelegramBot, sendTelegramTestNotification } from '../api/telegramGateway'
import type { UiAccountEntry, UiRateLimitWindow } from '../types/codex'

import type { TelegramStatus } from '../api/codexGateway'
import { setFreeMode, setFreeModeCustomKey, setCustomProvider } from '../api/codexGateway'

type ChatWidthMode = 'standard' | 'wide' | 'extra-wide'

export interface SettingsContext {
  RateLimitStatus: import("vue").Component
  t: (message: string, params?: Record<string, string | number>) => string
  uiLanguage: import("vue").Ref<import("../composables/useUiLanguage").UiLanguage, import("../composables/useUiLanguage").UiLanguage>
  uiLanguageOptions: { value: import("../composables/useUiLanguage").UiLanguage; label: string; }[]
  setUiLanguage: (language: import("../composables/useUiLanguage").UiLanguage) => void
  worktreeName: string
  appVersion: string
  SETTINGS_HELP: { readonly sendWithEnter: string; readonly inProgressSendMode: string; readonly appearance: string; readonly chatWidth: string; readonly dictationClickToToggle: string; readonly dictationAutoSend: string; readonly dictationLanguage: string; }
  accountRateLimitSnapshots: import("vue").Ref<{ limitId: string | null; limitName: string | null; primary: { usedPercent: number; windowDurationMins: number | null; windowMinutes: number | null; resetsAt: number | null; } | null; secondary: { usedPercent: number; windowDurationMins: number | null; windowMinutes: number | null; resetsAt: number | null; } | null; credits: { hasCredits: boolean; unlimited: boolean; balance: string | null; } | null; planType: string | null; }[], import("../types/codex").UiRateLimitSnapshot[] | { limitId: string | null; limitName: string | null; primary: { usedPercent: number; windowDurationMins: number | null; windowMinutes: number | null; resetsAt: number | null; } | null; secondary: { usedPercent: number; windowDurationMins: number | null; windowMinutes: number | null; resetsAt: number | null; } | null; credits: { hasCredits: boolean; unlimited: boolean; balance: string | null; } | null; planType: string | null; }[]>
  refreshAll: (options?: { includeSelectedThreadMessages?: boolean; awaitAncillaryRefreshes?: boolean; providerChanged?: boolean; forceThreadRefresh?: boolean; }) => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  feedbackMailto: string
  prepareFeedbackLink: (event: MouseEvent, message?: string) => void
  isAccountsSectionCollapsed: import("vue").Ref<boolean, boolean>
  accounts: import("vue").Ref<UiAccountEntry[]>
  isRefreshingAccounts: import("vue").Ref<boolean, boolean>
  isSwitchingAccounts: import("vue").Ref<boolean, boolean>
  isStartingCodexLogin: import("vue").Ref<boolean, boolean>
  isCompletingCodexLogin: import("vue").Ref<boolean, boolean>
  isCodexLoginModalOpen: import("vue").Ref<boolean, boolean>
  codexLoginUrl: import("vue").Ref<string, string>
  codexLoginCallbackUrl: import("vue").Ref<string, string>
  codexLoginCallbackInputRef: import("vue").Ref<HTMLInputElement | null, HTMLInputElement | null>
  removingAccountId: import("vue").Ref<string, string>
  confirmingRemoveAccountId: import("vue").Ref<string, string>
  hoveredAccountId: import("vue").Ref<string, string>
  accountActionError: import("vue").Ref<string, string>
  sendWithEnter: import("vue").Ref<boolean, boolean>
  inProgressSendMode: import("vue").Ref<"steer" | "queue", "steer" | "queue">
  darkMode: import("vue").Ref<"system" | "light" | "dark", "system" | "light" | "dark">
  chatWidth: import("vue").Ref<ChatWidthMode, ChatWidthMode>
  dictationClickToToggle: import("vue").Ref<boolean, boolean>
  dictationAutoSend: import("vue").Ref<boolean, boolean>
  dictationLanguage: import("vue").Ref<string, string>
  dictationLanguageOptions: import("vue").ComputedRef<{ value: string; label: string; }[]>
  freeModeEnabled: import("vue").Ref<boolean, boolean>
  freeModeLoading: import("vue").Ref<boolean, boolean>
  freeModeCustomKey: import("vue").Ref<string, string>
  freeModeHasCustomKey: import("vue").Ref<boolean, boolean>
  freeModeCustomKeyMasked: import("vue").Ref<string | null, string | null>
  freeModeCustomKeySaving: import("vue").Ref<boolean, boolean>
  providerError: import("vue").Ref<string, string>
  selectedProvider: import("vue").Ref<"codex" | "openrouter" | "opencode-zen" | "custom", "codex" | "openrouter" | "opencode-zen" | "custom">
  providerDropdownOptions: import("vue").ComputedRef<{ value: string; label: string; }[]>
  customEndpointUrl: import("vue").Ref<string, string>
  customEndpointKey: import("vue").Ref<string, string>
  customEndpointWireApi: import("vue").Ref<"responses" | "chat", "responses" | "chat">
  openRouterWireApi: import("vue").Ref<"responses" | "chat", "responses" | "chat">
  opencodeZenKey: import("vue").Ref<string, string>
  isTelegramConfigOpen: import("vue").Ref<boolean, boolean>
  telegramBotTokenDraft: import("vue").Ref<string, string>
  telegramAllowedUserIdsDraft: import("vue").Ref<string, string>
  telegramNotifyEnabledDraft: import("vue").Ref<boolean, boolean>
  telegramNotifyChatIdDraft: import("vue").Ref<string, string>
  telegramAppUrlDraft: import("vue").Ref<string, string>
  telegramConfigError: import("vue").Ref<string, string>
  isTelegramSaving: import("vue").Ref<boolean, boolean>
  isTelegramTesting: import("vue").Ref<boolean, boolean>
  telegramTestError: import("vue").Ref<string, string>
  telegramTestUnavailable: import("vue").ComputedRef<string>
  telegramNotificationStatusText: import("vue").ComputedRef<string>
  hasVisibleFeedbackError: import("vue").ComputedRef<boolean>
  telegramStatus: import("vue").Ref<TelegramStatus>
  showThreadContextBadge: import("vue").ComputedRef<boolean>
  isAccountSwitchBlocked: import("vue").ComputedRef<boolean>
  threadContextBadgeState: import("vue").ComputedRef<"pending" | "danger" | "warning" | "ok">
  threadContextPrimaryText: import("vue").ComputedRef<string>
  threadContextSecondaryText: import("vue").ComputedRef<string>
  threadContextTooltip: import("vue").ComputedRef<string>
  chatWidthLabel: import("vue").ComputedRef<string>
  telegramStatusText: import("vue").ComputedRef<string>
  refreshTelegramStatus: () => Promise<void>
  refreshTelegramConfig: () => Promise<void>
  toggleTelegramConfig: () => void
  isAccountUnavailable: (account: UiAccountEntry) => boolean
  loadAccountsState: (options?: { silent?: boolean; }) => Promise<void>
  toggleSendWithEnter: () => void
  cycleInProgressSendMode: () => void
  cycleDarkMode: () => void
  cycleChatWidth: () => void
  toggleDictationClickToToggle: () => void
  toggleDictationAutoSend: () => void
  loadFreeModeStatus: () => Promise<void>
  onDictationLanguageChange: (nextValue: string) => void
  toggleAccountsSectionCollapsed: () => void
}

const props = defineProps<{ context: SettingsContext }>()
const { RateLimitStatus, t, uiLanguage, uiLanguageOptions, setUiLanguage, worktreeName, appVersion, SETTINGS_HELP, accountRateLimitSnapshots, refreshAll, startPolling, stopPolling, feedbackMailto, prepareFeedbackLink, isAccountsSectionCollapsed, accounts, isRefreshingAccounts, isSwitchingAccounts, isStartingCodexLogin, isCompletingCodexLogin, isCodexLoginModalOpen, codexLoginUrl, codexLoginCallbackUrl, codexLoginCallbackInputRef, removingAccountId, confirmingRemoveAccountId, hoveredAccountId, accountActionError, sendWithEnter, inProgressSendMode, darkMode, chatWidth, dictationClickToToggle, dictationAutoSend, dictationLanguage, dictationLanguageOptions, freeModeEnabled, freeModeLoading, freeModeCustomKey, freeModeHasCustomKey, freeModeCustomKeyMasked, freeModeCustomKeySaving, providerError, selectedProvider, providerDropdownOptions, customEndpointUrl, customEndpointKey, customEndpointWireApi, openRouterWireApi, opencodeZenKey, isTelegramConfigOpen, telegramBotTokenDraft, telegramAllowedUserIdsDraft, telegramNotifyEnabledDraft, telegramNotifyChatIdDraft, telegramAppUrlDraft, telegramConfigError, isTelegramSaving, isTelegramTesting, telegramTestError, telegramTestUnavailable, telegramNotificationStatusText, hasVisibleFeedbackError, telegramStatus, showThreadContextBadge, isAccountSwitchBlocked, threadContextBadgeState, threadContextPrimaryText, threadContextSecondaryText, threadContextTooltip, chatWidthLabel, telegramStatusText, refreshTelegramStatus, refreshTelegramConfig, toggleTelegramConfig, isAccountUnavailable, loadAccountsState, toggleSendWithEnter, cycleInProgressSendMode, cycleDarkMode, cycleChatWidth, toggleDictationClickToToggle, toggleDictationAutoSend, loadFreeModeStatus, onDictationLanguageChange, toggleAccountsSectionCollapsed } = props.context
function shortAccountId(accountId: string): string {
  return accountId.length > 8 ? accountId.slice(-8) : accountId
}

function formatAccountMeta(account: UiAccountEntry): string {
  const segments = [account.planType || t('unknown')]
  if (account.authMode) {
    segments.unshift(account.authMode)
  }
  return segments.join(' · ')
}

function isAccountActionDisabled(account: UiAccountEntry): boolean {
  return isRefreshingAccounts.value || isSwitchingAccounts.value || isStartingCodexLogin.value || isCompletingCodexLogin.value || removingAccountId.value.length > 0
    || (account.isActive && removingAccountId.value !== account.storageId && isAccountSwitchBlocked.value)
}

function isRemoveConfirmationActive(account: UiAccountEntry): boolean {
  return confirmingRemoveAccountId.value === account.storageId
}

function isRemoveVisible(account: UiAccountEntry): boolean {
  return hoveredAccountId.value === account.storageId || isRemoveConfirmationActive(account)
}

function getAccountSwitchLabel(account: UiAccountEntry): string {
  if (isAccountUnavailable(account)) return t('Unavailable')
  if (account.isActive) return t('Active')
  if (account.canSwitch === false) return t('Switch unavailable')
  if (isSwitchingAccounts.value) return t('Switching…')
  return t('Switch')
}

function getAccountRemoveLabel(account: UiAccountEntry): string {
  if (removingAccountId.value === account.storageId) return t('Removing…')
  if (isRemoveConfirmationActive(account)) return t('Click again to remove')
  return t('Remove')
}

function onAccountCardPointerEnter(accountId: string): void {
  hoveredAccountId.value = accountId
}

function onAccountCardPointerLeave(accountId: string): void {
  if (hoveredAccountId.value === accountId) {
    hoveredAccountId.value = ''
  }
  if (removingAccountId.value === accountId) return
  if (confirmingRemoveAccountId.value === accountId) {
    confirmingRemoveAccountId.value = ''
  }
}

function pickWeeklyQuotaWindow(account: UiAccountEntry) {
  const quota = account.quotaSnapshot
  if (!quota) return null
  const windows = [quota?.primary, quota?.secondary].filter((quotaWindow): quotaWindow is UiRateLimitWindow => quotaWindow !== null)
  const exactWeekly = windows.find((quotaWindow) => quotaWindow.windowMinutes === 7 * 24 * 60)
  if (exactWeekly) {
    return exactWeekly
  }
  const longerWindow = windows
    .filter((quotaWindow) => typeof quotaWindow.windowMinutes === 'number' && quotaWindow.windowMinutes >= 7 * 24 * 60)
    .sort((first, second) => (first.windowMinutes ?? 0) - (second.windowMinutes ?? 0))[0] ?? null
  if (longerWindow) {
    return longerWindow
  }
  return quota.secondary ?? null
}

function formatResetDateCompact(resetsAt: number | null): string {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return ''
  const date = new Date(resetsAt * 1000)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatAccountQuota(account: UiAccountEntry): string {
  if (isAccountUnavailable(account)) {
    return account.quotaError || t('402 Payment Required')
  }
  const quota = account.quotaSnapshot
  const window = pickWeeklyQuotaWindow(account)
  const fallbackWindow = quota?.primary ?? quota?.secondary ?? null
  const displayWindow = window ?? fallbackWindow
  if (displayWindow) {
    const remainingPercent = Math.max(0, Math.min(100, 100 - Math.round(displayWindow.usedPercent)))
    const refreshDate = formatResetDateCompact(displayWindow.resetsAt)
    return refreshDate
      ? `${remainingPercent}% ${t('weekly remaining')} · ${refreshDate}`
      : `${remainingPercent}% ${t('weekly remaining')}`
  }
  if (quota?.credits?.unlimited) {
    return t('Unlimited credits')
  }
  if (quota?.credits?.hasCredits && quota.credits.balance) {
    return `${quota.credits.balance} ${t('credits')}`
  }
  if (account.quotaStatus === 'loading') {
    return t('Loading quota…')
  }
  if (account.quotaStatus === 'error') {
    return account.quotaError || t('Quota unavailable')
  }
  if (account.quotaStatus === 'ready' || account.quotaStatus === 'idle') {
    return t('Quota unavailable')
  }
  return t('Fetching account details…')
}

function buildAccountTitle(account: UiAccountEntry): string {
  return [
    account.email || t('Account'),
    formatAccountMeta(account),
    isAccountUnavailable(account) ? t('Unavailable account') : null,
    formatAccountQuota(account),
    account.credentialSource === 'runtime' ? t('Active Codex login') : `${t('Workspace')} ${account.accountId}`,
    account.managementReason,
  ].filter(Boolean).join('\n')
}

async function onRefreshAccounts(): Promise<void> {
  if (isRefreshingAccounts.value || isSwitchingAccounts.value || isStartingCodexLogin.value || isCompletingCodexLogin.value) return
  accountActionError.value = ''
  hoveredAccountId.value = ''
  confirmingRemoveAccountId.value = ''
  isRefreshingAccounts.value = true
  try {
    const result = await refreshAccountsFromAuth()
    accounts.value = result.accounts
    stopPolling()
    startPolling()
    void refreshAll({
      includeSelectedThreadMessages: true,
    })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : t('Failed to refresh accounts')
  } finally {
    isRefreshingAccounts.value = false
  }
}

async function onSwitchAccount(storageId: string): Promise<void> {
  if (isSwitchingAccounts.value || isRefreshingAccounts.value || isStartingCodexLogin.value || isCompletingCodexLogin.value) return
  if (isAccountSwitchBlocked.value) {
    accountActionError.value = t('Finish the current turn and pending requests before switching accounts.')
    return
  }
  accountActionError.value = ''
  hoveredAccountId.value = ''
  confirmingRemoveAccountId.value = ''
  isSwitchingAccounts.value = true
  try {
    const nextActiveAccount = await switchAccount(storageId)
    accounts.value = accounts.value.map((account) => (
      account.storageId === storageId
        ? nextActiveAccount
        : { ...account, isActive: false }
    ))
    stopPolling()
    startPolling()
    void refreshAll({
      includeSelectedThreadMessages: true,
    })
    void loadAccountsState({ silent: true })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : t('Failed to switch account')
  } finally {
    isSwitchingAccounts.value = false
  }
}

async function onStartCodexLogin(): Promise<void> {
  if (isRefreshingAccounts.value || isSwitchingAccounts.value || isStartingCodexLogin.value || isCompletingCodexLogin.value) return
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

async function onRemoveAccount(storageId: string): Promise<void> {
  if (isRefreshingAccounts.value || isSwitchingAccounts.value || isStartingCodexLogin.value || isCompletingCodexLogin.value || removingAccountId.value.length > 0) return
  const targetAccount = accounts.value.find((account) => account.storageId === storageId) ?? null
  if (!targetAccount) return
  if (confirmingRemoveAccountId.value !== storageId) {
    confirmingRemoveAccountId.value = storageId
    return
  }
  if (targetAccount.isActive && isAccountSwitchBlocked.value) {
    accountActionError.value = t('Finish the current turn and pending requests before removing the active account.')
    return
  }

  const removedWasActive = targetAccount.isActive
  accountActionError.value = ''
  confirmingRemoveAccountId.value = ''
  removingAccountId.value = storageId
  try {
    const result = await removeAccount(storageId)
    accounts.value = result.accounts
    stopPolling()
    startPolling()
    if (removedWasActive) {
      void refreshAll({
        includeSelectedThreadMessages: true,
      })
    }
    void loadAccountsState({ silent: true })
  } catch (error) {
    accountActionError.value = error instanceof Error ? error.message : t('Failed to remove account')
  } finally {
    removingAccountId.value = ''
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

function parseTelegramAllowedUserIdsInput(value: string): Array<number | '*'> {
  const rawEntries = value
    .split(/[\n,]/)
    .map((entry) => entry.trim().replace(/^(telegram|tg):/i, '').trim())
    .filter(Boolean)
  const allowAllUsers = rawEntries.includes('*')
  const normalizedUserIds = Array.from(new Set(rawEntries
    .filter((entry) => /^-?\d+$/.test(entry))
    .map((entry) => Number.parseInt(entry, 10))))
  return allowAllUsers ? ['*', ...normalizedUserIds] : normalizedUserIds
}

async function saveTelegramConfig(): Promise<void> {
  const botToken = telegramBotTokenDraft.value.trim()
  const allowedUserIds = parseTelegramAllowedUserIdsInput(telegramAllowedUserIdsDraft.value)
  if (!botToken) {
    telegramConfigError.value = t('Telegram bot token is required.')
    return
  }
  if (allowedUserIds.length === 0) {
    telegramConfigError.value = t('At least one allowed Telegram user ID or * is required.')
    return
  }

  const chatIdText = telegramNotifyChatIdDraft.value.trim()
  const chatId = Number(chatIdText)
  if ((chatIdText || telegramNotifyEnabledDraft.value) && (!/^\d+$/.test(chatIdText) || !Number.isSafeInteger(chatId) || chatId <= 0)) {
    telegramConfigError.value = t('Enter a positive private Telegram chat ID, or use /notify on in your bot chat.')
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
    await configureTelegramBot(botToken, allowedUserIds, {
      enabled: telegramNotifyEnabledDraft.value,
      chatIds: chatIdText ? [chatId] : [],
      statuses: ['completed'],
      appUrl,
    })
    telegramAllowedUserIdsDraft.value = allowedUserIds.map((value) => String(value)).join('\n')
    await Promise.all([
      refreshTelegramConfig(),
      refreshTelegramStatus(),
    ])
    window.alert(t('Telegram bot configured. Only allowlisted Telegram users can use the bridge.'))
  } catch (error) {
    telegramConfigError.value = error instanceof Error ? error.message : t('Failed to connect Telegram bot')
    void refreshTelegramStatus()
  } finally {
    isTelegramSaving.value = false
  }
}

async function onProviderChange(provider: string): Promise<void> {
  if (freeModeLoading.value) return
  freeModeLoading.value = true
  try {
    if (provider === 'codex') {
      selectedProvider.value = 'codex'
      const result = await setFreeMode(false)
      freeModeEnabled.value = result.enabled
    } else if (provider === 'openrouter') {
      selectedProvider.value = 'openrouter'
      const result = await setFreeMode(true)
      freeModeEnabled.value = result.enabled
      await setCustomProvider('', '', {
        wireApi: openRouterWireApi.value,
        provider: 'openrouter',
      })
    } else if (provider === 'opencode-zen') {
      selectedProvider.value = 'opencode-zen'
      await setCustomProvider('', opencodeZenKey.value.trim(), {
        wireApi: 'responses',
        provider: 'opencode-zen',
      })
      freeModeEnabled.value = true
    } else if (provider === 'custom') {
      selectedProvider.value = 'custom'
      if (customEndpointUrl.value.trim() && customEndpointKey.value.trim()) {
        await setCustomProvider(customEndpointUrl.value.trim(), customEndpointKey.value.trim(), {
          wireApi: customEndpointWireApi.value,
        })
        freeModeEnabled.value = true
      }
    }
    providerError.value = ''
    await refreshAll({ includeSelectedThreadMessages: false, providerChanged: true, awaitAncillaryRefreshes: true })
  } catch (err) {
    providerError.value = err instanceof Error ? err.message : 'Failed to switch provider'
  } finally {
    freeModeLoading.value = false
  }
}

async function saveCustomEndpoint(): Promise<void> {
  if (freeModeCustomKeySaving.value) return
  const url = customEndpointUrl.value.trim()
  if (!url) return
  freeModeCustomKeySaving.value = true
  try {
    providerError.value = ''
    await setCustomProvider(url, customEndpointKey.value.trim(), {
      wireApi: customEndpointWireApi.value,
    })
    freeModeEnabled.value = true
    await refreshAll({ includeSelectedThreadMessages: false, providerChanged: true, awaitAncillaryRefreshes: true })
  } catch (err) {
    providerError.value = err instanceof Error ? err.message : 'Failed to save custom endpoint'
  } finally {
    freeModeCustomKeySaving.value = false
  }
}

async function setOpenRouterWireApi(nextWireApi: 'responses' | 'chat'): Promise<void> {
  if (freeModeCustomKeySaving.value || freeModeLoading.value) return
  if (openRouterWireApi.value === nextWireApi) return
  const previousWireApi = openRouterWireApi.value
  openRouterWireApi.value = nextWireApi
  freeModeCustomKeySaving.value = true
  try {
    providerError.value = ''
    await setCustomProvider('', '', {
      wireApi: nextWireApi,
      provider: 'openrouter',
    })
    freeModeEnabled.value = true
    await refreshAll({ includeSelectedThreadMessages: false, providerChanged: true, awaitAncillaryRefreshes: true })
  } catch (err) {
    openRouterWireApi.value = previousWireApi
    providerError.value = err instanceof Error ? err.message : 'Failed to save OpenRouter API format'
  } finally {
    freeModeCustomKeySaving.value = false
  }
}

async function saveOpencodeZen(): Promise<void> {
  if (freeModeCustomKeySaving.value) return
  const key = opencodeZenKey.value.trim()
  if (!key) return
  freeModeCustomKeySaving.value = true
  try {
    providerError.value = ''
    await setCustomProvider('', key, {
      wireApi: 'responses',
      provider: 'opencode-zen',
    })
    freeModeEnabled.value = true
    await refreshAll({ includeSelectedThreadMessages: false, providerChanged: true, awaitAncillaryRefreshes: true })
  } catch (err) {
    providerError.value = err instanceof Error ? err.message : 'Failed to save OpenCode Zen config'
  } finally {
    freeModeCustomKeySaving.value = false
  }
}

async function saveFreeModeCustomKey(): Promise<void> {
  if (freeModeCustomKeySaving.value) return
  freeModeCustomKeySaving.value = true
  try {
    const key = freeModeCustomKey.value.trim()
    await setFreeModeCustomKey(key)
    freeModeCustomKey.value = ''
    await loadFreeModeStatus()
    await refreshAll({ includeSelectedThreadMessages: false })
  } catch {
    // Silently fail
  } finally {
    freeModeCustomKeySaving.value = false
  }
}

async function clearFreeModeCustomKey(): Promise<void> {
  if (freeModeCustomKeySaving.value) return
  freeModeCustomKeySaving.value = true
  try {
    await setFreeModeCustomKey('')
    freeModeCustomKey.value = ''
    await loadFreeModeStatus()
    await refreshAll({ includeSelectedThreadMessages: false })
  } catch {
    // Silently fail
  } finally {
    freeModeCustomKeySaving.value = false
  }
}
</script>
<template>
              <div class="sidebar-settings-account-section">
                <div class="sidebar-settings-account-header">
                  <div class="sidebar-settings-account-header-main">
                    <button
                      class="sidebar-settings-account-collapse"
                      type="button"
                      :aria-expanded="!isAccountsSectionCollapsed"
                      :title="isAccountsSectionCollapsed ? t('Expand accounts') : t('Collapse accounts')"
                      @click="toggleAccountsSectionCollapsed"
                    >
                      <span class="sidebar-settings-account-collapse-icon">{{ isAccountsSectionCollapsed ? '▸' : '▾' }}</span>
                    </button>
                    <span class="sidebar-settings-account-title">{{ t('Accounts') }}</span>
                    <span class="sidebar-settings-account-count">{{ accounts.length }}</span>
                  </div>
                  <button
                    class="sidebar-settings-account-refresh"
                    type="button"
                    :disabled="isRefreshingAccounts || isSwitchingAccounts || isStartingCodexLogin || isCompletingCodexLogin"
                    @click="onRefreshAccounts"
                  >
                    {{ isRefreshingAccounts ? t('Reloading…') : t('Reload') }}
                  </button>
                </div>
                <template v-if="!isAccountsSectionCollapsed">
                  <div v-if="accountActionError" class="sidebar-settings-account-error visible-error-with-feedback">
                    <span>{{ accountActionError }}</span>
                    <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, accountActionError)">{{ t('Send feedback') }}</a>
                  </div>
                  <div class="sidebar-settings-account-login">
                    <button
                      class="sidebar-settings-account-login-button"
                      type="button"
                      :disabled="isRefreshingAccounts || isSwitchingAccounts || isStartingCodexLogin || isCompletingCodexLogin"
                      @click="onStartCodexLogin"
                    >
                      {{ isStartingCodexLogin ? t('Starting login…') : t('Login') }}
                    </button>
                    <a
                      v-if="codexLoginUrl"
                      class="sidebar-settings-account-login-link"
                      :href="codexLoginUrl"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ t('Open login URL') }}
                    </a>
                  </div>
                  <p v-if="accounts.length === 0" class="sidebar-settings-account-empty">
                    {{ t('Click Login, or run `codex login`, then click reload.') }}
                  </p>
                  <div v-else class="sidebar-settings-account-list">
                  <article
                    v-for="account in accounts"
                    :key="account.storageId"
                    class="sidebar-settings-account-item"
                    :class="{
                      'is-active': account.isActive,
                      'is-unavailable': isAccountUnavailable(account),
                      'is-confirming-remove': isRemoveConfirmationActive(account),
                      'is-remove-visible': isRemoveVisible(account),
                    }"
                    :title="buildAccountTitle(account)"
                    @mouseenter="onAccountCardPointerEnter(account.storageId)"
                    @mouseleave="onAccountCardPointerLeave(account.storageId)"
                  >
                    <div class="sidebar-settings-account-main">
                      <p class="sidebar-settings-account-email">{{ account.email || t('Account') }}</p>
                      <p class="sidebar-settings-account-meta">
                        {{ formatAccountMeta(account) }}
                      </p>
                      <p class="sidebar-settings-account-quota">
                        {{ formatAccountQuota(account) }}
                      </p>
                      <p class="sidebar-settings-account-id">
                        <template v-if="account.credentialSource === 'runtime'">{{ t('Active Codex login') }}</template>
                        <template v-else>Workspace {{ shortAccountId(account.accountId) }}</template>
                      </p>
                      <p v-if="account.managementReason" class="sidebar-settings-account-meta">
                        {{ account.managementReason }}
                      </p>
                    </div>
                    <div class="sidebar-settings-account-actions">
                      <button
                        class="sidebar-settings-account-switch"
                        type="button"
                        :disabled="isAccountActionDisabled(account) || account.canSwitch === false || account.isActive || isAccountUnavailable(account)"
                        :title="account.managementReason || undefined"
                        @click="onSwitchAccount(account.storageId)"
                      >
                        {{ getAccountSwitchLabel(account) }}
                      </button>
                      <button
                        class="sidebar-settings-account-remove"
                        :class="{
                          'is-visible': isRemoveVisible(account),
                          'is-confirming': isRemoveConfirmationActive(account),
                        }"
                        type="button"
                        :disabled="isAccountActionDisabled(account) || account.canRemove === false"
                        :title="account.managementReason || undefined"
                        @click="onRemoveAccount(account.storageId)"
                      >
                        {{ getAccountRemoveLabel(account) }}
                      </button>
                    </div>
                  </article>
                  </div>
                </template>
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
                  class="sidebar-settings-provider-dropdown"
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
              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.dictationClickToToggle" @click="toggleDictationClickToToggle">
                <span class="sidebar-settings-label">{{ t('Click to toggle dictation') }}</span>
                <span class="sidebar-settings-toggle" :class="{ 'is-on': dictationClickToToggle }" />
              </button>
              <button class="sidebar-settings-row" type="button" :title="SETTINGS_HELP.dictationAutoSend" @click="toggleDictationAutoSend">
                <span class="sidebar-settings-label">{{ t('Auto send dictation') }}</span>
                <span class="sidebar-settings-toggle" :class="{ 'is-on': dictationAutoSend }" />
              </button>
              <a
                v-if="hasVisibleFeedbackError"
                class="sidebar-settings-row sidebar-settings-feedback-row"
                :href="feedbackMailto"
                @click="prepareFeedbackLink"
              >
                <span class="sidebar-settings-label">{{ t('Send feedback') }}</span>
                <span class="sidebar-settings-value">{{ t('Issue detected') }}</span>
              </a>

              <div class="sidebar-settings-row sidebar-settings-row--select" :title="t('Choose the API provider for the Codex backend')">
                <span class="sidebar-settings-label">{{ t('Provider') }}</span>
                <ComposerDropdown
                  class="sidebar-settings-provider-dropdown"
                  :model-value="selectedProvider"
                  :options="providerDropdownOptions"
                  :placeholder="t('Provider')"
                  :disabled="freeModeLoading"
                  menu-align="end"
                  @update:model-value="onProviderChange"
                />
              </div>
              <div v-if="providerError" class="sidebar-settings-row sidebar-settings-error">
                <span>{{ providerError }}</span>
                <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, providerError)">{{ t('Send feedback') }}</a>
              </div>
              <div v-if="selectedProvider === 'openrouter'" class="sidebar-settings-row sidebar-settings-row--input">
                <div class="sidebar-settings-provider-info">
                  <span class="sidebar-settings-label">{{ t('OpenRouter API key') }}</span>
                  <a
                    class="sidebar-settings-provider-link"
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ t('Get API key') }}</a>
                </div>
                <div class="sidebar-settings-key-group">
                  <template v-if="freeModeHasCustomKey && !freeModeCustomKey">
                    <span class="sidebar-settings-key-masked">{{ freeModeCustomKeyMasked }}</span>
                    <button
                      class="sidebar-settings-key-clear"
                      type="button"
                      :disabled="freeModeCustomKeySaving"
                      :title="t('Remove custom key, use community keys')"
                      @click="clearFreeModeCustomKey"
                    >&#x2715;</button>
                  </template>
                  <template v-else>
                    <input
                      v-model="freeModeCustomKey"
                      class="sidebar-settings-key-input"
                      type="password"
                      :placeholder="t('sk-or-v1-... (optional, uses free keys if empty)')"
                      @keydown.enter="saveFreeModeCustomKey"
                    />
                    <button
                      class="sidebar-settings-key-save"
                      type="button"
                      :disabled="freeModeCustomKeySaving || !freeModeCustomKey.trim()"
                      @click="saveFreeModeCustomKey"
                    >{{ freeModeCustomKeySaving ? '...' : t('Set') }}</button>
                  </template>
                </div>
                <div class="sidebar-settings-row sidebar-settings-row--select" style="margin-top: 4px; padding: 0">
                  <span class="sidebar-settings-label">{{ t('API format') }}</span>
                  <div class="sidebar-settings-segmented" role="group" :aria-label="t('OpenRouter API format')">
                    <button
                      type="button"
                      class="sidebar-settings-segmented-option"
                      :class="{ 'is-active': openRouterWireApi === 'responses' }"
                      :disabled="freeModeCustomKeySaving || freeModeLoading"
                      @click="setOpenRouterWireApi('responses')"
                    >
                      Responses
                    </button>
                    <button
                      type="button"
                      class="sidebar-settings-segmented-option"
                      :class="{ 'is-active': openRouterWireApi === 'chat' }"
                      :disabled="freeModeCustomKeySaving || freeModeLoading"
                      @click="setOpenRouterWireApi('chat')"
                    >
                      Completions
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="selectedProvider === 'opencode-zen'" class="sidebar-settings-row sidebar-settings-row--input">
                <div class="sidebar-settings-provider-info">
                  <span class="sidebar-settings-label">{{ t('OpenCode Zen API key') }}</span>
                  <a
                    class="sidebar-settings-provider-link"
                    href="https://opencode.ai/auth"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ t('Get API key') }}</a>
                </div>
                <div class="sidebar-settings-key-group">
                  <input
                    v-model="opencodeZenKey"
                    class="sidebar-settings-key-input"
                    type="password"
                    :placeholder="t('sk-...')"
                    @keydown.enter="saveOpencodeZen"
                  />
                  <button
                    class="sidebar-settings-key-save"
                    type="button"
                    :disabled="freeModeCustomKeySaving || !opencodeZenKey.trim()"
                    @click="saveOpencodeZen"
                  >{{ freeModeCustomKeySaving ? '...' : t('Save') }}</button>
                </div>
              </div>
              <div v-if="selectedProvider === 'custom'" class="sidebar-settings-row sidebar-settings-row--input">
                <span class="sidebar-settings-label">{{ t('Custom endpoint URL') }}</span>
                <div class="sidebar-settings-key-group">
                  <input
                    v-model="customEndpointUrl"
                    class="sidebar-settings-key-input"
                    type="url"
                    :placeholder="t('https://api.example.com/v1')"
                    @keydown.enter="saveCustomEndpoint"
                  />
                </div>
                <span class="sidebar-settings-label" style="margin-top: 4px">{{ t('API key') }}</span>
                <div class="sidebar-settings-key-group">
                  <input
                    v-model="customEndpointKey"
                    class="sidebar-settings-key-input"
                    type="password"
                    :placeholder="t('Bearer token (optional)')"
                    @keydown.enter="saveCustomEndpoint"
                  />
                  <button
                    class="sidebar-settings-key-save"
                    type="button"
                    :disabled="freeModeCustomKeySaving || !customEndpointUrl.trim()"
                    @click="saveCustomEndpoint"
                  >{{ freeModeCustomKeySaving ? '...' : t('Save') }}</button>
                </div>
                <div class="sidebar-settings-row sidebar-settings-row--select" style="margin-top: 4px; padding: 0">
                  <span class="sidebar-settings-label">{{ t('API format') }}</span>
                  <div class="sidebar-settings-segmented" role="group" :aria-label="t('Custom endpoint API format')">
                    <button
                      type="button"
                      class="sidebar-settings-segmented-option"
                      :class="{ 'is-active': customEndpointWireApi === 'responses' }"
                      @click="customEndpointWireApi = 'responses'"
                    >
                      Responses
                    </button>
                    <button
                      type="button"
                      class="sidebar-settings-segmented-option"
                      :class="{ 'is-active': customEndpointWireApi === 'chat' }"
                      @click="customEndpointWireApi = 'chat'"
                    >
                      Completions
                    </button>
                  </div>
                </div>
              </div>
              <div class="sidebar-settings-row sidebar-settings-row--select" :title="SETTINGS_HELP.dictationLanguage">
                <span class="sidebar-settings-label">{{ t('Dictation language') }}</span>
                <ComposerDropdown
                  class="sidebar-settings-language-dropdown"
                  :model-value="dictationLanguage"
                  :options="dictationLanguageOptions"
                  :placeholder="t('Auto-detect')"
                  open-direction="up"
                  :enable-search="true"
                  :search-placeholder="t('Search language...')"
                  @update:model-value="onDictationLanguageChange"
                />
              </div>
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
                  <span class="sidebar-settings-field-label">{{ t('Allowed Telegram user IDs') }}</span>
                  <textarea
                    v-model="telegramAllowedUserIdsDraft"
                    class="sidebar-settings-textarea"
                    rows="3"
                    placeholder="123456789&#10;987654321"
                    spellcheck="false"
                  />
                </label>
                <div class="sidebar-settings-field-help">
                  {{ t('Put one Telegram user ID per line or separate them with commas. Use `*` to allow all Telegram users. Unauthorized users will see their own ID in the rejection message so they can copy it here.') }}
                </div>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label inline-flex items-center gap-1"><input v-model="telegramNotifyEnabledDraft" type="checkbox" />{{ t('All completed tasks') }}</span>
                </label>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label">{{ t('Private notification chat ID') }}</span>
                  <input v-model="telegramNotifyChatIdDraft" class="sidebar-settings-input" type="text" inputmode="numeric" placeholder="123456789" />
                </label>
                <label class="sidebar-settings-field">
                  <span class="sidebar-settings-field-label">{{ t('App URL reachable from your phone') }}</span>
                  <input v-model="telegramAppUrlDraft" class="sidebar-settings-input" type="url" placeholder="https://your-app.example" />
                </label>
                <p class="sidebar-settings-field-help">{{ t('Notifies successful turns observed by this running backend. Use /notify on or /notify off in a private bot chat. A finished turn does not guarantee the whole task succeeded.') }}</p>
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
                  <a class="visible-error-feedback" :href="feedbackMailto" @click="prepareFeedbackLink($event, telegramConfigError)">{{ t('Send feedback') }}</a>
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
            </template>

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

.sidebar-automations-link-icon {
  @apply bg-amber-500;
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

.automations-route-header-icon {
  @apply bg-amber-500 shadow-[0_16px_32px_-20px_rgba(245,158,11,0.9)];
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

.content-root.is-virtual-keyboard-open .content-thread-terminal-panel {
  min-height: 0;
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

.sidebar-settings-account-header-main {
  @apply flex items-center gap-2;
}

.sidebar-settings-account-collapse {
  @apply inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100;
}

.sidebar-settings-account-collapse-icon {
  @apply text-[11px] leading-none;
}

.sidebar-settings-account-title {
  @apply text-sm font-medium text-zinc-800;
}

.sidebar-settings-account-count {
  @apply rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-600;
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

.sidebar-settings-account-list {
  @apply flex flex-col gap-2;
}

.sidebar-settings-account-item {
  @apply flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2;
}

.sidebar-settings-account-item.is-active {
  @apply border-emerald-200 bg-emerald-50;
}

.sidebar-settings-account-item.is-unavailable {
  @apply border-rose-200 bg-rose-50;
}

.sidebar-settings-account-main {
  @apply min-w-0 flex-1;
}

.sidebar-settings-account-actions {
  @apply flex w-24 shrink-0 flex-col items-end gap-1.5;
}

.sidebar-settings-account-email {
  @apply truncate text-sm text-zinc-800;
}

.sidebar-settings-account-meta {
  @apply truncate text-[11px] text-zinc-500;
}

.sidebar-settings-account-quota {
  @apply truncate text-[11px] text-zinc-600;
}

.sidebar-settings-account-id {
  @apply mt-1 inline-flex max-w-full rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700;
}

.sidebar-settings-account-item.is-active .sidebar-settings-account-id {
  @apply bg-emerald-100 text-emerald-800;
}

.sidebar-settings-account-item.is-unavailable .sidebar-settings-account-id {
  @apply bg-rose-100 text-rose-800;
}

.sidebar-settings-account-switch {
  @apply min-w-[4.75rem] shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-center text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.sidebar-settings-account-remove {
  @apply invisible shrink-0 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] leading-4 text-zinc-500 opacity-0 pointer-events-none transition-colors hover:bg-amber-50 disabled:cursor-default disabled:opacity-60;
}

.sidebar-settings-account-remove.is-visible {
  @apply visible opacity-100 pointer-events-auto;
}

.sidebar-settings-account-remove.is-confirming {
  @apply border-amber-300 bg-amber-50 text-amber-700 font-medium;
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

.sidebar-settings-key-group {
  @apply flex items-center gap-1.5 w-full;
}

.sidebar-settings-key-input {
  @apply flex-1 min-w-0 text-xs rounded border border-zinc-200 bg-white px-2 py-1 outline-none transition-colors placeholder:text-zinc-400;
}

.sidebar-settings-key-input:focus {
  @apply border-zinc-400;
}

.sidebar-settings-key-save {
  @apply shrink-0 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default;
}

.sidebar-settings-key-masked {
  @apply flex-1 min-w-0 text-xs text-zinc-500 font-mono truncate;
}

.sidebar-settings-key-clear {
  @apply shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-zinc-200 text-xs text-zinc-400 transition-colors hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-40;
}

.sidebar-settings-provider-dropdown {
  @apply min-w-0 max-w-44;
}

.sidebar-settings-provider-dropdown :deep(.composer-dropdown-trigger) {
  @apply h-auto rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700;
}

.sidebar-settings-provider-dropdown :deep(.composer-dropdown-value) {
  @apply max-w-36;
}

.sidebar-settings-segmented {
  @apply inline-flex items-center rounded-md border border-zinc-200 bg-white p-0.5;
}

.sidebar-settings-segmented-option {
  @apply rounded px-2 py-1 text-xs text-zinc-600 transition-colors;
}

.sidebar-settings-segmented-option.is-active {
  @apply bg-zinc-800 text-white;
}

.sidebar-settings-provider-info {
  @apply flex items-center justify-between w-full;
}

.sidebar-settings-provider-link {
  @apply text-xs text-blue-600 hover:text-blue-700 underline shrink-0;
}

:root.dark .sidebar-settings-segmented {
  @apply border-zinc-600 bg-zinc-800;
}

:root.dark .sidebar-settings-segmented-option {
  @apply text-zinc-300;
}

:root.dark .sidebar-settings-segmented-option.is-active {
  @apply bg-zinc-100 text-zinc-900;
}

:root.dark .sidebar-settings-provider-link {
  @apply text-blue-400 hover:text-blue-300;
}

:root.dark .sidebar-settings-key-input {
  @apply border-zinc-600 bg-zinc-800 text-zinc-200 placeholder:text-zinc-500;
}

:root.dark .sidebar-settings-key-input:focus {
  @apply border-zinc-500;
}

:root.dark .sidebar-settings-key-save {
  @apply border-zinc-600 bg-zinc-700 text-zinc-200 hover:bg-zinc-600;
}

:root.dark .sidebar-settings-key-masked {
  @apply text-zinc-400;
}

:root.dark .sidebar-settings-key-clear {
  @apply border-zinc-600 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500;
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

.project-zip-modal-backdrop {
  @apply fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4;
}

.project-zip-modal {
  @apply flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-2xl;
}

.project-zip-modal-header {
  @apply flex items-center justify-between gap-3;
}

.project-zip-modal-title {
  @apply text-base font-semibold;
}

.project-zip-modal-close {
  @apply inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.project-zip-modal-copy {
  @apply min-h-5 truncate text-sm text-zinc-600;
}

.project-zip-modal-error {
  @apply rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900;
}

.project-zip-progress-label {
  @apply flex items-center justify-between gap-3 text-sm font-semibold;
}

.project-zip-progress-label span:last-child {
  @apply shrink-0 text-xs font-medium text-zinc-500;
}

.project-zip-progress-track {
  @apply h-2 overflow-hidden rounded-full bg-zinc-100;
}

.project-zip-progress-fill {
  @apply h-full rounded-full bg-emerald-600 transition-all duration-150;
}

.project-zip-modal-actions {
  @apply flex items-center justify-end gap-2;
}

.project-zip-modal-cancel,
.project-zip-modal-action {
  @apply rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60;
}

.project-zip-modal-action-primary {
  @apply border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800;
}

:root.dark .project-zip-modal {
  @apply border-zinc-700 bg-zinc-900 text-zinc-100;
}

:root.dark .project-zip-modal-close,
:root.dark .project-zip-modal-cancel,
:root.dark .project-zip-modal-action {
  @apply border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800;
}

:root.dark .project-zip-modal-copy {
  @apply text-zinc-400;
}

:root.dark .project-zip-modal-error {
  @apply border-amber-900/60 bg-amber-950/40 text-amber-100;
}

:root.dark .project-zip-modal-action-primary {
  @apply border-zinc-100 bg-zinc-100 text-zinc-950 hover:bg-white;
}

:root.dark .project-zip-progress-label span:last-child {
  @apply text-zinc-400;
}

:root.dark .project-zip-progress-track {
  @apply bg-zinc-800;
}

:root.dark .project-zip-progress-fill {
  @apply bg-emerald-500;
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
