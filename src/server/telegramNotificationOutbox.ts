import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import lockfile from 'proper-lockfile'
import { isDeepStrictEqual } from 'node:util'

export class TelegramApiError extends Error {
  constructor(message: string, readonly code: number, readonly retryAfter = 0) {
    super(message)
  }
  get temporary(): boolean { return this.code === 429 || this.code >= 500 }
  get formatting(): boolean { return this.code === 400 && /parse entities|unsupported start tag|can't find end tag/i.test(this.message) }
}

export type CompletionJob = {
  key: string
  botId: string
  chatId: number
  threadId: string
  turnId: string
  completion: boolean
  appUrl: string
  text?: string
  offset?: number
  attempts: number
  nextAttempt: number
  createdAt?: number
  completedAt?: number
  lastAttemptAt?: number
}
export const COMPLETION_MAX_AGE_MS = 24 * 60 * 60 * 1000
const COMPLETION_MAX_ATTEMPTS = 10
const lockOptions = { realpath: false, stale: 30_000, update: 5_000 }

type OutboxState = { pending: CompletionJob[]; settled: string[]; lastError: string }

/** One serialized disk writer and one delivery worker; no work blocks the app event stream. */
export class TelegramNotificationOutbox {
  private state: OutboxState = { pending: [], settled: [], lastError: '' }
  private mutation = Promise.resolve()
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private active = false

  constructor(
    private readonly path: string,
    private readonly prepare: (job: CompletionJob) => Promise<string>,
    private readonly send: (job: CompletionJob) => Promise<void>,
    private readonly eligible: (job: CompletionJob) => boolean,
  ) {}

  get lastError(): string { return this.state.lastError }

  private change(action: () => void): Promise<void> {
    const operation = this.mutation.catch(() => {}).then(async () => {
      await mkdir(dirname(this.path), { recursive: true })
      const release = await lockfile.lock(this.path, {
        ...lockOptions, retries: { retries: 100, minTimeout: 50, maxTimeout: 50 },
      })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      try {
        try {
          const parsed = JSON.parse(await readFile(this.path, 'utf8')) as OutboxState
          if (!Array.isArray(parsed.pending) || !Array.isArray(parsed.settled)) throw new Error('Invalid Telegram outbox')
          this.state = parsed
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          this.state = { pending: [], settled: [], lastError: '' }
        }
        const before = structuredClone(this.state)
        action()
        if (isDeepStrictEqual(before, this.state)) return
        await writeFile(temporary, JSON.stringify(this.state), { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, this.path)
      } finally {
        await rm(temporary, { force: true })
        await release()
      }
    })
    this.mutation = operation
    return operation
  }

  async add(jobs: CompletionJob[]): Promise<void> {
    await this.change(() => {
      const keys = new Set([...this.state.settled, ...this.state.pending.map((job) => job.key)])
      if (this.state.pending.length + jobs.filter((job) => !keys.has(job.key)).length > 1000) {
        throw new Error('Telegram notification queue is full')
      }
      for (const job of jobs) {
        if (keys.has(job.key)) continue
        this.state.pending.push(job)
        keys.add(job.key)
        console.info('[telegram-outbox] queued', { threadId: job.threadId, turnId: job.turnId, createdAt: job.createdAt, completedAt: job.completedAt, pid: process.pid })
      }
    })
    this.wake()
  }

  start(): void {
    this.active = true
    void this.change(() => {}).then(() => this.wake()).catch((error) => this.recordError(error))
  }
  stop(): void {
    this.active = false
    clearTimeout(this.timer)
  }
  recordError(error: unknown): void {
    this.state.lastError = error instanceof Error ? error.message : String(error)
  }
  private wake(delay = 0): void {
    if (!this.active || this.running) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.drain() }, delay)
    this.timer.unref?.()
  }
  private settle(job: CompletionJob): void {
    this.state.pending = this.state.pending.filter((entry) => entry.key !== job.key)
    // Bound receipt storage. Duplicate suppression covers the last 2,000 deliveries.
    this.state.settled = [...this.state.settled, job.key].slice(-2000)
  }
  private async drain(): Promise<void> {
    if (!this.active || this.running) return
    this.running = true
    let delay = 1000
    let releaseWorker: (() => Promise<void>) | undefined
    try {
      await mkdir(dirname(this.path), { recursive: true })
      try {
        releaseWorker = await lockfile.lock(`${this.path}.worker`, lockOptions)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ELOCKED') throw error
        delay = 1000
        return
      }
      await this.change(() => {})
      if (!this.state.pending.length) { delay = 5000; return }
      const job = this.state.pending.find((entry) => entry.nextAttempt <= Date.now())
      if (!job) {
        const next = Math.min(...this.state.pending.map((entry) => entry.nextAttempt))
        delay = Number.isFinite(next) ? Math.max(1000, next - Date.now()) : 30000
        return
      }
      if (!this.eligible(job) || (job.completion && (
        !Number.isFinite(job.createdAt) || Date.now() - job.createdAt! >= COMPLETION_MAX_AGE_MS ||
        (job.completedAt !== undefined && Date.now() - job.completedAt >= COMPLETION_MAX_AGE_MS) ||
        job.attempts >= COMPLETION_MAX_ATTEMPTS
      ))) {
        await this.change(() => this.settle(job))
        return
      }
      let attempted = false
      try {
        if (job.text === undefined) {
          const text = await this.prepare(job)
          await this.change(() => { const current = this.state.pending.find((entry) => entry.key === job.key); if (current) current.text = text })
          job.text = text
        }
        if (!this.active) return
        if (this.eligible(job) && job.text) {
          const offset = job.offset ?? 0
          let end = Math.min(job.text.length, offset + 3500)
          // Never split a UTF-16 surrogate pair between Telegram messages.
          if (end < job.text.length && /[\uD800-\uDBFF]/.test(job.text[end - 1] ?? '')) end -= 1
          const attemptedAt = Date.now()
          await this.change(() => {
            const current = this.state.pending.find((entry) => entry.key === job.key)
            if (current) { current.attempts += 1; current.lastAttemptAt = attemptedAt }
          })
          attempted = true
          console.info('[telegram-outbox] send', { threadId: job.threadId, turnId: job.turnId, createdAt: job.createdAt, attemptedAt, attempt: job.attempts + 1, pid: process.pid })
          await this.send({ ...job, text: job.text.slice(offset, end) })
          await this.change(() => {
            const current = this.state.pending.find((entry) => entry.key === job.key)
            if (!current) return
            current.offset = end
            if (end >= (current.text?.length ?? 0)) this.settle(current)
            else current.nextAttempt = Date.now() + 1000
          })
        } else {
          await this.change(() => this.settle(job))
        }
      } catch (error) {
        await this.change(() => {
          this.recordError(error)
          const current = this.state.pending.find((entry) => entry.key === job.key)
          if (!current) return
          if (!attempted) { current.attempts += 1; current.lastAttemptAt = Date.now() }
          console.warn('[telegram-outbox] failed', { threadId: job.threadId, turnId: job.turnId, createdAt: current.createdAt, attemptedAt: current.lastAttemptAt, attempt: current.attempts, pid: process.pid, error: this.state.lastError })
          if ((error instanceof TelegramApiError && !error.temporary) || (current.completion && current.attempts >= COMPLETION_MAX_ATTEMPTS)) {
            this.settle(job)
          } else {
            const retryAfter = error instanceof TelegramApiError ? error.retryAfter * 1000 : 0
            delay = Math.max(1000, retryAfter, Math.min(300000, 1000 * 2 ** Math.min(current.attempts, 9)))
            current.nextAttempt = Date.now() + delay
          }
        })
      }
    } catch (error) {
      this.recordError(error)
      delay = 5000
    } finally {
      if (releaseWorker) await releaseWorker().catch((error) => this.recordError(error))
      this.running = false
      this.wake(Math.min(delay, 5000))
    }
  }
}
