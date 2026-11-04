import type { ReasoningEffort } from './types/codex.js'

/** Submission-time settings; absence on a queue entry identifies a legacy record. */
export type QueuedGenerationSettings = {
  model: string
  effort: ReasoningEffort | ''
  /** Read-only compatibility marker: never silently execute an old alternative-provider queue item. */
  unsupportedProvider?: string
}

export function normalizeQueuedGenerationSettings(value: unknown): QueuedGenerationSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  const legacyProvider = typeof record.providerId === 'string' ? record.providerId.trim().toLowerCase() : ''
  const unsupportedProvider = typeof record.unsupportedProvider === 'string' ? record.unsupportedProvider
    : legacyProvider && !['codex', 'openai'].includes(legacyProvider) ? legacyProvider : ''
  const effort = record.effort
  if (!model || typeof effort !== 'string'
    || !['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)) return undefined
  return { model, effort: effort as QueuedGenerationSettings['effort'], ...(unsupportedProvider ? { unsupportedProvider } : {}) }
}
