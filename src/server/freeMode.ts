export const FREE_MODE_PROVIDER_ID = 'openrouter-free'
export const FREE_MODE_BASE_URL = 'https://openrouter.ai/api/v1'
const FREE_MODE_RUNTIME_PROVIDER_ID = 'openrouter_free'

const FALLBACK_FREE_MODELS = [
  'openrouter/free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-coder:free',
]

let cachedFreeModels: string[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10 * 60 * 1000
let freeModelsRefreshPromise: Promise<string[]> | null = null

async function fetchFreeModelsFromOpenRouter(): Promise<string[]> {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models')
    if (!resp.ok) return cachedFreeModels ?? FALLBACK_FREE_MODELS
    const json = (await resp.json()) as { data: Array<{ id: string }> }
    const ids = json.data
      .filter((m) => m.id.endsWith(':free') || m.id === 'openrouter/free')
      .map((m) => m.id)
    if (ids.length === 0) return cachedFreeModels ?? FALLBACK_FREE_MODELS
    const sorted = ['openrouter/free', ...ids.filter((id) => id !== 'openrouter/free')]
    cachedFreeModels = sorted
    cacheTimestamp = Date.now()
    return sorted
  } catch {
    return cachedFreeModels ?? FALLBACK_FREE_MODELS
  }
}

export async function getFreeModels(): Promise<string[]> {
  if (cachedFreeModels && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFreeModels
  }
  return fetchFreeModelsFromOpenRouter()
}

export function getCachedFreeModels(): string[] {
  return cachedFreeModels ?? FALLBACK_FREE_MODELS
}

export function refreshFreeModelsInBackground(): void {
  if (cachedFreeModels && Date.now() - cacheTimestamp < CACHE_TTL_MS) return
  if (freeModelsRefreshPromise) return
  freeModelsRefreshPromise = fetchFreeModelsFromOpenRouter()
    .finally(() => {
      freeModelsRefreshPromise = null
    })
}

export const FREE_MODE_DEFAULT_MODEL = 'openrouter/free'

export const FREE_MODE_STATE_FILE = 'webui-custom-providers.json'

export const CUSTOM_PROVIDER_ID = 'custom-endpoint'
export const OPENCODE_ZEN_PROVIDER_ID = 'opencode-zen'
const CUSTOM_RUNTIME_PROVIDER_ID = 'custom_endpoint'
const OPENCODE_ZEN_RUNTIME_PROVIDER_ID = 'opencode_zen'
export const OPENCODE_ZEN_BASE_URL = 'https://opencode.ai/zen/v1'
export const OPENCODE_ZEN_DEFAULT_MODEL = 'muse-spark-1.3-contributor-free'

export type WireApi = 'responses' | 'chat'

export interface FreeModeState {
  enabled: boolean
  apiKey: string | null
  model: string
  customKey?: boolean
  provider?: 'openrouter' | 'custom' | 'opencode-zen'
  customBaseUrl?: string
  wireApi?: WireApi
  providerKeys?: Record<string, string>
  personalOpenRouterKey?: boolean
}

export const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required. Sign in with Codex, set OPENAI_API_KEY, or configure your own provider in Settings.'

export function isExplicitProviderState(state: FreeModeState | null): boolean {
  if (!state?.enabled) return false
  if (state.provider === 'opencode-zen') return true
  if (state.provider === 'custom') return Boolean(state.customBaseUrl?.trim())
  // Old shared-key states must never be used as personal credentials.
  return state.provider === 'openrouter' && state.customKey === true && Boolean(state.apiKey?.trim())
}

export function getFreeModeEnvVars(state: FreeModeState): Record<string, string> {
  if (!state.enabled) return {}

  if (state.provider === 'opencode-zen' && state.apiKey) {
    return { OPENCODE_ZEN_API_KEY: state.apiKey }
  }

  if (state.provider === 'custom' && state.customBaseUrl && state.apiKey) {
    return { CUSTOM_ENDPOINT_API_KEY: state.apiKey }
  }

  return {}
}

export function filterOpenCodeZenModelsForAuthState(modelIds: string[], apiKey: string | null | undefined): string[] {
  if (apiKey?.trim()) return modelIds
  return modelIds.filter((id) => id === OPENCODE_ZEN_DEFAULT_MODEL || id.endsWith('-free'))
}

function getOpenCodeZenProviderConfigArgs(serverPort?: number): string[] {
  const providerConfigKey = `model_providers.${OPENCODE_ZEN_RUNTIME_PROVIDER_ID}`
  const baseUrl = serverPort
    ? `http://127.0.0.1:${serverPort}/codex-api/zen-proxy/v1`
    : OPENCODE_ZEN_BASE_URL
  const authArgs: string[] = serverPort
    ? ['-c', `${providerConfigKey}.experimental_bearer_token="zen-proxy-token"`]
    : ['-c', `${providerConfigKey}.env_key="OPENCODE_ZEN_API_KEY"`]

  return [
    '-c', `${providerConfigKey}.name="OpenCode Zen"`,
    '-c', `${providerConfigKey}.base_url="${baseUrl}"`,
    '-c', `${providerConfigKey}.wire_api="responses"`,
    ...authArgs,
  ]
}

export function getProviderCompatibilityConfigArgs(serverPort?: number): string[] {
  return getOpenCodeZenProviderConfigArgs(serverPort)
}

export function getFreeModeConfigArgs(state: FreeModeState, serverPort?: number): string[] {
  if (!isExplicitProviderState(state)) return []

  if (state.provider === 'opencode-zen') {
    const model = state.model?.trim() || OPENCODE_ZEN_DEFAULT_MODEL
    return [
      '-c', `model="${model}"`,
      '-c', `model_provider="${OPENCODE_ZEN_RUNTIME_PROVIDER_ID}"`,
      ...getOpenCodeZenProviderConfigArgs(serverPort),
    ]
  }

  if (state.provider === 'custom' && state.customBaseUrl) {
    const providerConfigKey = `model_providers.${CUSTOM_RUNTIME_PROVIDER_ID}`
    const baseUrl = serverPort
      ? `http://127.0.0.1:${serverPort}/codex-api/custom-proxy/v1`
      : state.customBaseUrl
    const wireApi = serverPort ? 'responses' : (state.wireApi || 'responses')
    const authArgs: string[] = serverPort
      ? ['-c', `${providerConfigKey}.experimental_bearer_token="custom-proxy-token"`]
      : ['-c', `${providerConfigKey}.env_key="CUSTOM_ENDPOINT_API_KEY"`]
    const modelArgs: string[] = state.model?.trim()
      ? ['-c', `model="${state.model.trim()}"`]
      : []
    return [
      ...modelArgs,
      '-c', `model_provider="${CUSTOM_RUNTIME_PROVIDER_ID}"`,
      '-c', `${providerConfigKey}.name="Custom Endpoint"`,
      '-c', `${providerConfigKey}.base_url="${baseUrl}"`,
      '-c', `${providerConfigKey}.wire_api="${wireApi}"`,
      ...authArgs,
    ]
  }

  if (!state.apiKey) return []
  const providerConfigKey = `model_providers.${FREE_MODE_RUNTIME_PROVIDER_ID}`
  const baseUrl = serverPort
    ? `http://127.0.0.1:${serverPort}/codex-api/openrouter-proxy/v1`
    : FREE_MODE_BASE_URL
  const bearerToken = serverPort ? 'openrouter-proxy-token' : state.apiKey
  return [
    '-c', `model="${state.model}"`,
    '-c', `model_provider="${FREE_MODE_RUNTIME_PROVIDER_ID}"`,
    '-c', `${providerConfigKey}.name="OpenRouter Free"`,
    '-c', `${providerConfigKey}.base_url="${baseUrl}"`,
    '-c', `${providerConfigKey}.wire_api="responses"`,
    '-c', `${providerConfigKey}.experimental_bearer_token="${bearerToken}"`,
  ]
}
