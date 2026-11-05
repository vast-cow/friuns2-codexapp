import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import { redactTelegramError, telegramFetch } from './telegramNetwork.js'
import { normalizeTelegramCompletionConfig } from '../telegramCompletionConfig.js'
import { COMPLETION_MAX_AGE_MS, TelegramApiError, TelegramNotificationOutbox, type CompletionJob } from './telegramNotificationOutbox.js'

type AppServerLike = {
  rpc: (method: string, params: unknown) => Promise<unknown>
  onNotification: (listener: (value: { method: string; params: unknown }) => void) => () => void
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export class TelegramNotificationService {
  private token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
  private completionNotifications = normalizeTelegramCompletionConfig(undefined)
  private unsubscribe: (() => void) | undefined
  private active = false
  private testInProgress = false
  private lastTestRequestAt = 0
  private readonly outbox: TelegramNotificationOutbox

  constructor(private readonly appServer: AppServerLike, options: { outboxPath?: string } = {}) {
    this.outbox = new TelegramNotificationOutbox(
      options.outboxPath ?? join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'telegram-notification-outbox.json'),
      (job) => this.prepareCompletionMessage(job),
      (job) => this.sendMessageRequest(job.chatId, job.text ?? ''),
      (job) => job.completion && job.botId === this.token.split(':')[0] &&
        this.completionNotifications.enabled && this.completionNotifications.chatIds.includes(job.chatId),
    )
  }

  start(): void {
    if (!this.token || !this.completionNotifications.enabled || !this.completionNotifications.chatIds.length || this.active) return
    this.active = true
    this.outbox.start()
    this.unsubscribe = this.appServer.onNotification((notification) => {
      void this.handleNotification(notification).catch((error) => this.outbox.recordError(error))
    })
  }

  stop(): void {
    this.active = false
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.outbox.stop()
  }

  configureCompletionNotifications(config: unknown): void {
    this.stop()
    this.completionNotifications = normalizeTelegramCompletionConfig(config)
    this.outbox.setStatusKey(this.notificationStatusKey())
    this.start()
  }

  configureToken(token: string): void {
    this.stop()
    this.token = token.trim()
    this.outbox.setStatusKey(this.notificationStatusKey())
  }

  private notificationStatusKey(): string {
    const chatId = this.completionNotifications.chatIds[0] ?? 0
    const digest = createHash('sha256').update(JSON.stringify([this.token, this.completionNotifications])).digest('hex')
    return `${this.token.split(':')[0]}:${chatId}:${digest}`
  }

  async sendTestNotification(): Promise<void> {
    const chatId = this.completionNotifications.chatIds[0]
    if (!this.token || !Number.isSafeInteger(chatId) || chatId === 0) throw new Error('Configure a bot token and destination chat ID first')
    if (this.testInProgress || Date.now() - this.lastTestRequestAt < 5000) throw new Error('Please wait before sending another test notification')
    this.testInProgress = true
    this.lastTestRequestAt = Date.now()
    const startedAt = this.lastTestRequestAt
    const key = this.notificationStatusKey()
    try {
      await this.outbox.reserveTest(key, startedAt)
    } catch (error) {
      this.testInProgress = false
      throw error
    }
    try {
      if (key !== this.notificationStatusKey()) throw new Error('Telegram configuration changed; save and try again')
      try {
        await this.sendMessageRequest(chatId, 'Codex notification test: Telegram accepted this message.')
      } catch (error) {
        await this.outbox.recordTest(key, startedAt, error)
        throw new Error(redactTelegramError(error instanceof Error ? error.message : String(error)))
      }
      await this.outbox.recordTest(key, startedAt)
    } finally {
      this.testInProgress = false
    }
  }

  async getStatus() {
    return { configured: Boolean(this.token), active: this.active, lastError: this.outbox.lastError, notification: await this.outbox.status() }
  }

  private async sendMessageRequest(chatId: number, text: string): Promise<void> {
    await this.callTelegramApi('sendMessage', { chat_id: chatId, text })
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`
  }

  private async callTelegramApi(method: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await telegramFetch(this.apiUrl(method), {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const parsed = asRecord(await response.json())
    const ok = parsed?.ok === true
    if (!response.ok || !ok) {
      const description = typeof parsed?.description === 'string' ? parsed.description : ''
      const statusPart = `${String(response.status)} ${response.statusText}`.trim()
      throw new TelegramApiError(description || statusPart || `Telegram API ${method} failed`,
        typeof parsed?.error_code === 'number' ? parsed.error_code : response.status,
        Number(asRecord(parsed?.parameters)?.retry_after) || 0)
    }
    return parsed ?? {}
  }

  private extractThreadId(notification: { method: string; params: unknown }): string {
    const params = asRecord(notification.params)
    if (!params) return ''
    const directThreadId = typeof params.threadId === 'string' ? params.threadId : ''
    if (directThreadId) return directThreadId
    const turn = asRecord(params.turn)
    const turnThreadId = typeof turn?.threadId === 'string' ? turn.threadId : ''
    return turnThreadId
  }

  private extractTurnId(notification: { method: string; params: unknown }): string {
    const params = asRecord(notification.params)
    if (!params) return ''
    const directTurnId = typeof params.turnId === 'string' ? params.turnId : ''
    if (directTurnId) return directTurnId
    const turn = asRecord(params.turn)
    const turnId = typeof turn?.id === 'string' ? turn.id : ''
    return turnId
  }

  private async handleNotification(notification: { method: string; params: unknown }): Promise<void> {
    if (notification.method !== 'turn/completed') return
    const threadId = this.extractThreadId(notification)
    const turnId = this.extractTurnId(notification)
    if (!threadId || !turnId) return
    const turn = asRecord(asRecord(notification.params)?.turn)
    const params = asRecord(notification.params)
    const timestamp = turn?.completedAt ?? params?.completedAt
    const parsedTime = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN
    const completedAt = Number.isFinite(parsedTime) ? parsedTime : undefined
    const createdAt = Date.now()
    const fresh = completedAt === undefined || createdAt - completedAt < COMPLETION_MAX_AGE_MS
    const subscribers = new Set(fresh && this.completionNotifications.enabled && turn?.status === 'completed'
      ? this.completionNotifications.chatIds : [])
    const targets = subscribers
    if (!targets.size) return
    const botId = this.token.split(':')[0] ?? ''
    await this.outbox.add(Array.from(targets, (chatId) => ({
      key: JSON.stringify([botId, chatId, threadId, turnId]),
      botId, chatId, threadId, turnId,
      completion: subscribers.has(chatId),
      appUrl: this.completionNotifications.appUrl,
      attempts: 0, nextAttempt: 0, createdAt, completedAt,
    })))
  }

  private async prepareCompletionMessage(job: CompletionJob): Promise<string> {
    let thread: Record<string, unknown> | null = null
    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      const response = asRecord(await Promise.race([
        this.appServer.rpc('thread/read', { threadId: job.threadId, includeTurns: false }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Telegram thread lookup timed out')), 15000)
        }),
      ]).finally(() => clearTimeout(timer)))
      thread = asRecord(response?.thread)
    } catch {
      // Completion alerts still deliver even if the thread was deleted or cannot be read.
      // Fall back to the conversation ID.
    }
    const title = String(thread?.name || thread?.preview || job.threadId).replace(/\s+/g, ' ').slice(0, 200)
    const project = typeof thread?.cwd === 'string' ? basename(thread.cwd).slice(0, 100) : ''
    const link = job.appUrl ? `${job.appUrl}/#/thread/${encodeURIComponent(job.threadId)}` : ''
    return [
      'Codex turn completed', `Task: ${title}`, project ? `Project: ${project}` : '',
      link ? `Open conversation: ${link}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 3500)
  }

}
