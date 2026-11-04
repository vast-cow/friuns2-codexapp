import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type CredentialRpc = { rpc(method: string, params: unknown): Promise<unknown> }
export type ChatgptFeatureAuth = { accessToken: string; accountId?: string }

export class CodexCredentialError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message)
    this.name = 'CodexCredentialError'
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function credentialRpc(appServer: CredentialRpc, method: string, params: unknown): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      appServer.rpc(method, params),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Credential request timed out')), 5000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function readCodexCredentialStore(appServer: CredentialRpc): Promise<string> {
  try {
    const response = record(await credentialRpc(appServer, 'config/read', { includeLayers: false }))
    const config = record(response?.config)
    if (config) return text(config.cli_auth_credentials_store) ?? 'file'
  } catch { /* Never forward raw RPC errors that may contain credential data. */ }
  throw new CodexCredentialError(503, 'credential_store_unavailable', 'Codex credential storage could not be determined. Try again after reconnecting Codex.')
}

export async function requireFileCredentialStore(readStore: () => Promise<string>): Promise<void> {
  if (await readStore() !== 'file') {
    throw new CodexCredentialError(501, 'external_auth_refresh_unsupported', 'External token refresh requires file credential storage. This login is managed by Codex; use Codex-managed authentication and refresh instead.')
  }
}

function tokenAccountId(token: string): string | undefined {
  try {
    const payload = record(JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')))
    return text(record(payload?.['https://api.openai.com/auth'])?.chatgpt_account_id)
  } catch { return undefined }
}

function unsupported(): CodexCredentialError {
  return new CodexCredentialError(501, 'chatgpt_feature_credentials_unsupported', 'This Codex version or login does not expose the credentials required for transcription and private connector logos. Manage authentication through Codex.')
}

function methodUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /method not found|unknown method|unknown variant.*getAuthStatus|unsupported.*getAuthStatus/i.test(message)
}

const inFlight = new WeakMap<CredentialRpc, { home: string; promise: Promise<ChatgptFeatureAuth> }>()

/** Server-internal only. No token is written, logged, or returned to an HTTP client. */
export async function readChatgptFeatureAuth(appServer: CredentialRpc): Promise<ChatgptFeatureAuth> {
  const home = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  const pending = inFlight.get(appServer)
  if (pending?.home === home) return pending.promise
  const promise = (async (): Promise<ChatgptFeatureAuth> => {
    let account: Record<string, unknown> | null
    try {
      const payload = record(await credentialRpc(appServer, 'account/read', { refreshToken: false }))
      if (!payload || !('account' in payload)) throw new Error('Missing account status')
      account = record(payload.account)
      if (!account) {
        if (payload.requiresOpenaiAuth === false) throw unsupported()
        throw new CodexCredentialError(401, 'codex_not_signed_in', 'Codex reports no signed-in account. Sign in with Codex to use this ChatGPT feature.')
      }
    } catch (error) {
      if (error instanceof CodexCredentialError) throw error
      throw new CodexCredentialError(503, 'codex_account_unavailable', 'Codex account status could not be read. Reconnect Codex and try again.')
    }
    if (account.type !== 'chatgpt') {
      throw new CodexCredentialError(422, 'chatgpt_account_required', 'This feature requires a ChatGPT account. Use Codex authentication for chat.')
    }

    let status: Record<string, unknown> | null
    try {
      status = record(await credentialRpc(appServer, 'getAuthStatus', { includeToken: true, refreshToken: false }))
    } catch (error) {
      if (!methodUnavailable(error)) {
        throw new CodexCredentialError(503, 'codex_feature_credentials_unavailable', 'Codex could not provide credentials for this feature. Retry after reconnecting Codex.')
      }
      // Compatibility for old Codex versions only, and only for confirmed file storage.
      // Never read a leftover auth.json when the backend is Keyring/auto/ephemeral/unknown.
      if (await readCodexCredentialStore(appServer) !== 'file') throw unsupported()
      try {
        const auth = record(JSON.parse(await readFile(join(home, 'auth.json'), 'utf8')))
        const tokens = record(auth?.tokens)
        const accessToken = text(tokens?.access_token)
        if (accessToken) return { accessToken, accountId: text(tokens?.account_id) ?? tokenAccountId(accessToken) }
      } catch { /* Missing/unreadable file is a feature limitation, not proof of sign-out. */ }
      throw unsupported()
    }
    const accessToken = text(status?.authToken)
    if (!accessToken) throw unsupported() // Respect an explicit refusal to release a token.
    if (status?.authMethod !== 'chatgpt' && status?.authMethod !== 'chatgptAuthTokens') throw unsupported()
    return { accessToken, accountId: tokenAccountId(accessToken) }
  })()
  const entry = { home, promise }
  inFlight.set(appServer, entry)
  try { return await promise } finally {
    if (inFlight.get(appServer) === entry) inFlight.delete(appServer)
  }
}

/** Public RPC proxy must expose metadata only, regardless of requested parameters. */
export async function readPublicAuthStatus(appServer: CredentialRpc, params: unknown): Promise<unknown> {
  try {
    const status = record(await credentialRpc(appServer, 'getAuthStatus', { ...record(params), includeToken: false }))
    return {
      authMethod: text(status?.authMethod) ?? null,
      authToken: null,
      requiresOpenaiAuth: typeof status?.requiresOpenaiAuth === 'boolean' ? status.requiresOpenaiAuth : null,
    }
  } catch {
    throw new CodexCredentialError(503, 'codex_auth_status_unavailable', 'Codex authentication status could not be read. Reconnect Codex and try again.')
  }
}
