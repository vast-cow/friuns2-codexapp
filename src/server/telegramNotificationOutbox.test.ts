import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPLETION_MAX_AGE_MS, TelegramApiError, TelegramNotificationOutbox, type CompletionJob } from './telegramNotificationOutbox.js'

const dirs: string[] = []
const workers: TelegramNotificationOutbox[] = []
afterEach(async () => {
  workers.forEach((worker) => worker.stop())
  workers.length = 0
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'telegram-outbox-'))
  dirs.push(dir)
  return join(dir, 'outbox.json')
}
function job(overrides: Partial<CompletionJob> = {}): CompletionJob {
  return { key: 'key', botId: 'bot', chatId: 1, threadId: 'thread', turnId: 'turn', completion: true, appUrl: '', attempts: 0, nextAttempt: 0, createdAt: Date.now(), ...overrides }
}
async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for outbox')
}
async function state(path: string) { return JSON.parse(await readFile(path, 'utf8')) }
function worker(path: string, send: (job: CompletionJob) => Promise<void>) {
  const instance = new TelegramNotificationOutbox(path, async () => 'message', send, () => true)
  workers.push(instance)
  return instance
}

describe('Telegram notification outbox', () => {
  it('serializes workers and reads receipts written by other instances', async () => {
    const path = await setup()
    await writeFile(path, JSON.stringify({ pending: [job()], settled: [], lastError: '' }))
    const send = vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 100)) })
    const a = worker(path, send); const b = worker(path, send)
    a.start(); b.start()
    await waitFor(async () => (await state(path)).settled.length === 1)
    await b.add([job()])
    expect(send).toHaveBeenCalledTimes(1)
    expect((await state(path)).pending).toHaveLength(0)
  })
  it('drops expired and timestamp-free legacy completion jobs', async () => {
    const path = await setup()
    await writeFile(path, JSON.stringify({ pending: [job({ key: 'old', createdAt: Date.now() - COMPLETION_MAX_AGE_MS }), job({ key: 'legacy', createdAt: undefined })], settled: [], lastError: '' }))
    const send = vi.fn(async () => {})
    worker(path, send).start()
    await waitFor(async () => (await state(path)).settled.length === 2)
    expect(send).not.toHaveBeenCalled()
  })
  it('persists attempt metadata and stops at the retry limit', async () => {
    const path = await setup()
    await writeFile(path, JSON.stringify({ pending: [job({ attempts: 9 })], settled: [], lastError: '' }))
    const send = vi.fn(async () => { throw new TelegramApiError('unavailable', 503) })
    worker(path, send).start()
    await waitFor(async () => (await state(path)).settled.length === 1)
    expect((await state(path)).pending).toHaveLength(0)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
