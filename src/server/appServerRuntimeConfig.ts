const SANDBOX_MODES = new Set([
  'read-only',
  'workspace-write',
  'danger-full-access',
] as const)

const APPROVAL_POLICIES = new Set([
  'untrusted',
  'on-failure',
  'on-request',
  'never',
] as const)

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
export type CodexApprovalPolicy = 'untrusted' | 'on-failure' | 'on-request' | 'never'

export function buildAppServerArgs(): string[] {
  throw new Error('App-server is externally managed; process launch arguments are unsupported')
}

export function parseSandboxMode(value: string): CodexSandboxMode | null {
  const candidate = value.trim().toLowerCase()
  return SANDBOX_MODES.has(candidate as CodexSandboxMode) ? candidate as CodexSandboxMode : null
}

export function parseApprovalPolicy(value: string): CodexApprovalPolicy | null {
  const candidate = value.trim().toLowerCase()
  return APPROVAL_POLICIES.has(candidate as CodexApprovalPolicy) ? candidate as CodexApprovalPolicy : null
}

/** External server defaults and explicit per-thread choices pass through unchanged. */
export function applyCodexThreadConfig(method: string, params: unknown): unknown {
  return params
}
