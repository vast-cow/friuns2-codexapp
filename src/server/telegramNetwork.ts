import * as net from 'node:net'
import { Agent, fetch } from 'undici'

// Respect explicitly supplied Node flags while keeping Telegram's defaults local to its dispatcher.
const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} ${process.execArgv.join(' ')}`
const familyOverride = /(?:^|\s)--(?:no-)?network-family-autoselection(?:\s|=|$)/.test(nodeOptions)
const timeoutOverride = /(?:^|\s)--network-family-autoselection-attempt-timeout(?:\s|=|$)/.test(nodeOptions)
// Undici supplies the destination port; its v5 connect type incorrectly requires it here.
const connectOptions = {
  autoSelectFamily: familyOverride && typeof net.getDefaultAutoSelectFamily === 'function' ? net.getDefaultAutoSelectFamily() : true,
  autoSelectFamilyAttemptTimeout: timeoutOverride && typeof net.getDefaultAutoSelectFamilyAttemptTimeout === 'function'
    ? net.getDefaultAutoSelectFamilyAttemptTimeout() : 3000,
} as NonNullable<ConstructorParameters<typeof Agent>[0]>['connect']
const dispatcher = new Agent({ connect: connectOptions })

export function telegramFetch(url: string, init: Parameters<typeof fetch>[1]) {
  return fetch(url, { ...init, dispatcher })
}

// Only emit known connection fields: error messages and URLs may contain credentials.
export function telegramNetworkErrorDetails(error: unknown): unknown {
  const seen = new Set<unknown>()
  function visit(value: unknown, depth: number): unknown {
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return undefined
    seen.add(value)
    const item = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of ['code', 'syscall'] as const) {
      if (typeof item[key] === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(item[key])) result[key] = item[key]
    }
    if (typeof item.address === 'string' && net.isIP(item.address)) result.address = item.address
    if (typeof item.port === 'number' && Number.isInteger(item.port) && item.port >= 0 && item.port <= 65535) result.port = item.port
    if (typeof item.errno === 'number') result.errno = item.errno
    const cause = visit(item.cause, depth + 1)
    if (cause) result.cause = cause
    if (Array.isArray(item.errors)) {
      const errors = item.errors.slice(0, 10).map((entry) => visit(entry, depth + 1)).filter(Boolean)
      if (errors.length) result.errors = errors
    }
    return Object.keys(result).length ? result : undefined
  }
  return visit(error, 0)
}

/** Remove URLs and bot credentials before storing or displaying Telegram errors. */
export function redactTelegramError(message: string): string {
  return message.replace(/https?:\/\/[^\s]+/gi, '[redacted URL]').replace(/\b\d{5,}:[A-Za-z0-9_-]+/g, '[redacted token]')
}
