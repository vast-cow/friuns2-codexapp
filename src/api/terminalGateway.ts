

import { ThreadTerminalSession, asRecord, readString, readBoolean, ThreadTerminalAttachInput, fetchTerminalJson } from './codexGateway'

function normalizeThreadTerminalSession(value: unknown): ThreadTerminalSession | null {
  const record = asRecord(value)
  if (!record) return null
  const id = readString(record.id)
  const threadId = readString(record.threadId)
  const cwd = readString(record.cwd)
  const shell = readString(record.shell)
  if (!id || !threadId || !cwd || !shell) return null
  return {
    id,
    threadId,
    cwd,
    shell,
    buffer: typeof record.buffer === 'string' ? record.buffer : '',
    truncated: readBoolean(record.truncated) ?? false,
  }
}

export async function attachThreadTerminal(input: ThreadTerminalAttachInput): Promise<ThreadTerminalSession> {
  const payload = await fetchTerminalJson('/codex-api/thread-terminal/attach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const session = normalizeThreadTerminalSession(asRecord(payload)?.session)
  if (!session) throw new Error('Terminal attach response was malformed')
  return session
}

export async function sendThreadTerminalInput(sessionId: string, data: string): Promise<void> {
  await fetchTerminalJson('/codex-api/thread-terminal/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, data }),
  })
}

export async function resizeThreadTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  await fetchTerminalJson('/codex-api/thread-terminal/resize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, cols, rows }),
  })
}

export async function closeThreadTerminal(sessionId: string): Promise<void> {
  await fetchTerminalJson('/codex-api/thread-terminal/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}

export async function getThreadTerminalSnapshot(threadId: string): Promise<ThreadTerminalSession | null> {
  const payload = await fetchTerminalJson(`/codex-api/thread-terminal-snapshot?threadId=${encodeURIComponent(threadId)}`)
  return normalizeThreadTerminalSession(asRecord(payload)?.session)
}
