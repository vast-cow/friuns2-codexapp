export type TelegramCompletionConfig = {
  enabled: boolean
  chatIds: number[]
  statuses: ['completed']
  appUrl: string
}

export function normalizeTelegramCompletionConfig(value: unknown): TelegramCompletionConfig {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const chatIds = Array.isArray(record.chatIds)
    ? record.chatIds.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0).slice(0, 1)
    : []
  let appUrl = ''
  try {
    const url = new URL(typeof record.appUrl === 'string' ? record.appUrl.trim() : '')
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
      url.hash = ''
      url.search = ''
      appUrl = url.toString().replace(/\/$/, '')
    }
  } catch { /* An absent URL leaves notifications without a link. */ }
  return { enabled: record.enabled === true, chatIds, statuses: ['completed'], appUrl }
}
