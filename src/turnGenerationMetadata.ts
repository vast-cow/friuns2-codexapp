export type GenerationMetadataSource = 'execution' | 'submitted'

export type TurnGenerationMetadata = {
  model?: string
  // null means explicitly unspecified; absent means unknown. "none" is a value.
  effort?: string | null
  modelSource?: GenerationMetadataSource
  effortSource?: GenerationMetadataSource
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

export function readGenerationMetadata(value: unknown): TurnGenerationMetadata | undefined {
  const row = record(value)
  if (!row) return undefined
  const model = typeof row.model === 'string' ? row.model.trim() : ''
  const effort = typeof row.effort === 'string' ? row.effort.trim() : row.effort
  const result: TurnGenerationMetadata = {}
  if (model && (row.modelSource === 'execution' || row.modelSource === 'submitted')) {
    result.model = model
    result.modelSource = row.modelSource
  }
  if ((effort === null || (typeof effort === 'string' && effort))
    && (row.effortSource === 'execution' || row.effortSource === 'submitted')) {
    result.effort = effort
    result.effortSource = row.effortSource
  }
  return Object.keys(result).length ? result : undefined
}

export function submittedGenerationMetadata(params: unknown): TurnGenerationMetadata {
  const row = record(params)
  const settings = record(record(row?.collaborationMode)?.settings)
  const model = settings?.model ?? row?.model
  const effort = settings && 'reasoning_effort' in settings ? settings.reasoning_effort : row?.effort
  return {
    ...(typeof model === 'string' && model.trim() ? { model: model.trim(), modelSource: 'submitted' as const } : {}),
    effort: typeof effort === 'string' && effort.trim() ? effort.trim() : null,
    effortSource: 'submitted',
  }
}

export function generationMetadataLabel(metadata?: TurnGenerationMetadata): string {
  const model = metadata?.model ?? 'Model unknown'
  const effort = metadata?.effort === null ? 'unspecified' : metadata?.effort ?? 'unknown'
  return `${model}${metadata?.modelSource === 'submitted' ? ' (sent setting)' : ''} · reasoning: ${effort}${metadata?.effortSource === 'submitted' ? ' (sent setting)' : ''}`
}
