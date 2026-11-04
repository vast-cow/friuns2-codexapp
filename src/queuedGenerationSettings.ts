import type { ReasoningEffort } from './types/codex.js'

/** Submission-time settings; absence on a queue entry identifies a legacy record. */
export type QueuedGenerationSettings = {
  model: string
  effort: ReasoningEffort | ''
  providerId: string
}

export function normalizeQueueProvider(value: string): string {
  const provider = value.trim().toLowerCase().replace(/_/g, '-')
  return provider === 'codex' ? 'openai' : provider
}

export function normalizeQueuedGenerationSettings(value: unknown): QueuedGenerationSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  const providerId = typeof record.providerId === 'string' ? normalizeQueueProvider(record.providerId) : ''
  const effort = record.effort
  if (!model || !providerId || typeof effort !== 'string'
    || !['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)) return undefined
  return { model, providerId, effort: effort as QueuedGenerationSettings['effort'] }
}
