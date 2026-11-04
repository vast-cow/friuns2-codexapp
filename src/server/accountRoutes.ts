import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { recordCodexAuthStatus } from './codexAuthStatus.js'

type AppServerLike = {
  dispose(): void
}

type AccountRouteContext = {
  appServer: AppServerLike
}

const LOGIN_URL_TIMEOUT_MS = 15 * 1000

const LOGIN_CALLBACK_TIMEOUT_MS = 20 * 1000

const LOGIN_COMPLETION_TIMEOUT_MS = 10 * 1000

let activeLogin: {
  proc: ChildProcessWithoutNullStreams
  loginUrl: string | null
  output: string
  exited: boolean
  exitCode: number | null
  exitSignal: NodeJS.Signals | null
  exitPromise: Promise<void>
} | null = null

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function setJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const rawBody = await new Promise<string>((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
  return asRecord(rawBody.length > 0 ? JSON.parse(rawBody) : {})
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload instanceof Error && payload.message.trim().length > 0) {
    return payload.message
  }
  const record = asRecord(payload)
  const error = record?.error
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim()
  }
  if (typeof record?.message === 'string' && record.message.trim().length > 0) {
    return record.message.trim()
  }
  return fallback
}

function extractLoginUrl(output: string): string | null {
  const match = output.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\?\S+/u)
  return match?.[0] ?? null
}

function isLocalCallbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:') return false
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]' || parsed.hostname === '::1'
  } catch {
    return false
  }
}

async function waitForLoginUrl(): Promise<string> {
  if (activeLogin?.loginUrl) return activeLogin.loginUrl

  return await new Promise<string>((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (!activeLogin) {
        clearInterval(timer)
        reject(new Error('Login process is not running.'))
        return
      }
      if (activeLogin.loginUrl) {
        clearInterval(timer)
        resolve(activeLogin.loginUrl)
        return
      }
      if (activeLogin.exited) {
        clearInterval(timer)
        reject(new Error(activeLogin.output.trim() || 'codex login exited before returning a login URL.'))
        return
      }
      if (Date.now() - startedAt > LOGIN_URL_TIMEOUT_MS) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for codex login URL.'))
      }
    }, 100)
  })
}

async function startCodexLogin(): Promise<string> {
  if (activeLogin && !activeLogin.exited) {
    return await waitForLoginUrl()
  }

  const proc = spawn('codex', ['login'], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  proc.stdin.end()

  activeLogin = {
    proc,
    loginUrl: null,
    output: '',
    exited: false,
    exitCode: null,
    exitSignal: null,
    exitPromise: new Promise<void>((resolve) => {
      proc.once('error', () => resolve())
      proc.once('exit', (code, signal) => {
        if (activeLogin?.proc === proc) {
          activeLogin.exited = true
          activeLogin.exitCode = code
          activeLogin.exitSignal = signal
        }
        resolve()
      })
    }),
  }

  const appendOutput = (chunk: Buffer | string) => {
    if (!activeLogin || activeLogin.proc !== proc) return
    activeLogin.output += chunk.toString()
    activeLogin.loginUrl = activeLogin.loginUrl ?? extractLoginUrl(activeLogin.output)
  }

  proc.stdout.on('data', appendOutput)
  proc.stderr.on('data', appendOutput)
  proc.once('error', (error) => {
    if (!activeLogin || activeLogin.proc !== proc) return
    activeLogin.exited = true
    activeLogin.output += error.message
  })

  try {
    return await waitForLoginUrl()
  } catch (error) {
    if (activeLogin?.proc === proc && !activeLogin.exited) {
      proc.kill('SIGTERM')
    }
    activeLogin = null
    throw error
  }
}

async function curlLoginCallback(callbackUrl: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOGIN_CALLBACK_TIMEOUT_MS)
  try {
    const response = await fetch(callbackUrl, {
      redirect: 'manual',
      signal: controller.signal,
    })
    if (response.status >= 400) {
      throw new Error(`Login callback returned HTTP ${response.status}.`)
    }
  } finally {
    clearTimeout(timer)
  }
}

async function waitForLoginCompletion(): Promise<void> {
  const login = activeLogin
  if (!login) throw new Error('Login process is not running.')
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      login.exitPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out waiting for Codex login to finish.')), LOGIN_COMPLETION_TIMEOUT_MS)
      }),
    ])
    if (login.exitCode !== 0) throw new Error('Codex login did not complete successfully. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}

function stopActiveLogin(): void {
  if (!activeLogin) return
  if (!activeLogin.exited) {
    activeLogin.proc.kill('SIGTERM')
  }
  activeLogin = null
}

export async function handleAccountRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  context: AccountRouteContext,
): Promise<boolean> {
  const { appServer } = context

  if (req.method === 'POST' && url.pathname === '/codex-api/accounts/login/start') {
    try {
      const loginUrl = await startCodexLogin()
      setJson(res, 200, {
        ok: true,
        data: {
          loginUrl,
        },
      })
    } catch (error) {
      setJson(res, 500, {
        error: 'account_login_start_failed',
        message: getErrorMessage(error, 'Failed to start codex login'),
      })
    }
    return true
  }

  if (req.method === 'POST' && url.pathname === '/codex-api/accounts/login/complete') {
    try {
      const payload = await readJsonBody(req)
      const callbackUrl = typeof payload?.callbackUrl === 'string' ? payload.callbackUrl.trim() : ''
      if (!callbackUrl) {
        setJson(res, 400, { error: 'missing_callback_url', message: 'Paste the localhost callback URL from the browser.' })
        return true
      }
      if (!isLocalCallbackUrl(callbackUrl)) {
        setJson(res, 400, { error: 'invalid_callback_url', message: 'The callback URL must use http://localhost or http://127.0.0.1.' })
        return true
      }
      if (!activeLogin || (activeLogin.exited && activeLogin.exitCode !== 0)) {
        setJson(res, 409, { error: 'login_not_running', message: 'Start Codex login before submitting the callback URL.' })
        return true
      }

      if (!activeLogin.exited) await curlLoginCallback(callbackUrl)
      // Successful CLI exit confirms the selected credential backend has committed login.
      await waitForLoginCompletion()
      stopActiveLogin()
      recordCodexAuthStatus(true)
      appServer.dispose()
      setJson(res, 200, { ok: true })
    } catch (error) {
      setJson(res, 500, {
        error: 'account_login_complete_failed',
        message: getErrorMessage(error, 'Failed to complete Codex login'),
      })
    }
    return true
  }

  return false
}
