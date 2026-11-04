import { expect, it } from 'vitest'
import { normalizeQueuedGenerationSettings } from './queuedGenerationSettings'
it('keeps saved Codex model and reasoning settings without provider state', () => {
  expect(normalizeQueuedGenerationSettings({ model: 'gpt-test', effort: 'high', providerId: 'openai' })).toEqual({ model: 'gpt-test', effort: 'high' })
})
it('marks legacy alternative-provider queue entries instead of silently replaying them', () => {
  const settings = normalizeQueuedGenerationSettings({ model: 'legacy-model', effort: 'low', providerId: 'custom_endpoint' })
  expect(settings).toEqual({ model: 'legacy-model', effort: 'low', unsupportedProvider: 'custom_endpoint' })
  expect(normalizeQueuedGenerationSettings(settings)).toEqual(settings)
})
