
import { normalizeTelegramCompletionConfig, type TelegramCompletionConfig } from '../telegramCompletionConfig'

import { getErrorMessageFromPayload, TelegramConfig, TelegramStatus } from './codexGateway'

export async function configureTelegramBot(
  botToken: string,
  allowedUserIds: Array<number | '*'>,
  completionNotifications?: TelegramCompletionConfig,
): Promise<void> {
  const response = await fetch('/codex-api/telegram/configure-bot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      botToken,
      allowedUserIds,
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
  const rawAllowedUserIds = Array.isArray(data.allowedUserIds) ? data.allowedUserIds : []
  const allowedUserIds: Array<number | '*'> = []
  for (const value of rawAllowedUserIds) {
    if (value === '*') {
      allowedUserIds.push('*')
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      allowedUserIds.push(Math.trunc(value))
    }
  }
  return {
    botToken: typeof data.botToken === 'string' ? data.botToken : '',
    completionNotifications: normalizeTelegramCompletionConfig(data.completionNotifications),
    allowedUserIds,
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
    mappedChats: typeof data.mappedChats === 'number' ? data.mappedChats : 0,
    mappedThreads: typeof data.mappedThreads === 'number' ? data.mappedThreads : 0,
    allowedUsers: typeof data.allowedUsers === 'number' ? data.allowedUsers : 0,
    allowAllUsers: data.allowAllUsers === true,
    lastError: typeof data.lastError === 'string' ? data.lastError : '',
    notification: data.notification && typeof data.notification === 'object' ? data.notification as TelegramStatus['notification'] : undefined,
  }
}
