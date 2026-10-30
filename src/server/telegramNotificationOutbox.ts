import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

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
}
type OutboxState = { pending: CompletionJob[]; settled: string[]; lastError: string }

/** One serialized disk writer and one delivery worker; no work blocks the app event stream. */
export class TelegramNotificationOutbox {
  private state: OutboxState = { pending: [], settled: [], lastError: '' }
  private loaded = false
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
      if (!this.loaded) {
        try {
          const parsed = JSON.parse(await readFile(this.path, 'utf8')) as OutboxState
          if (!Array.isArray(parsed.pending) || !Array.isArray(parsed.settled)) throw new Error('Invalid Telegram outbox')
          this.state = parsed
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        this.loaded = true
      }
      action()
      await mkdir(dirname(this.path), { recursive: true })
      await writeFile(`${this.path}.tmp`, JSON.stringify(this.state), { encoding: 'utf8', mode: 0o600 })
      await rename(`${this.path}.tmp`, this.path)
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
    try {
      if (!this.state.pending.length) return
      // Flush any prior failed reservation write before a job can be delivered.
      await this.change(() => {})
      const job = this.state.pending.find((entry) => entry.nextAttempt <= Date.now())
      if (!job) {
        const next = Math.min(...this.state.pending.map((entry) => entry.nextAttempt))
        delay = Number.isFinite(next) ? Math.max(1000, next - Date.now()) : 30000
        return
      }
      if (!this.eligible(job)) {
        await this.change(() => this.settle(job))
        return
      }
      try {
        if (job.text === undefined) {
          const text = await this.prepare(job)
          await this.change(() => { job.text = text })
        }
        if (!this.active) return
        if (this.eligible(job) && job.text) {
          const offset = job.offset ?? 0
          let end = Math.min(job.text.length, offset + 3500)
          // Never split a UTF-16 surrogate pair between Telegram messages.
          if (end < job.text.length && /[\uD800-\uDBFF]/.test(job.text[end - 1] ?? '')) end -= 1
          await this.send({ ...job, text: job.text.slice(offset, end) })
          await this.change(() => {
            job.offset = end
            if (end >= (job.text?.length ?? 0)) this.settle(job)
            else job.nextAttempt = Date.now() + 1000
          })
        } else {
          await this.change(() => this.settle(job))
        }
      } catch (error) {
        await this.change(() => {
          this.recordError(error)
          if (error instanceof TelegramApiError && !error.temporary) {
            this.settle(job)
          } else {
            job.attempts += 1
            const retryAfter = error instanceof TelegramApiError ? error.retryAfter * 1000 : 0
            delay = Math.max(1000, retryAfter, Math.min(300000, 1000 * 2 ** Math.min(job.attempts, 9)))
            job.nextAttempt = Date.now() + delay
          }
        })
      }
    } catch (error) {
      this.recordError(error)
      delay = 5000
    } finally {
      this.running = false
      if (this.state.pending.length) this.wake(Math.min(delay, 2147483647))
    }
  }
}
