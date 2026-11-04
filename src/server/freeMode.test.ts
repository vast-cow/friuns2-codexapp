import { describe, expect, it } from 'vitest'
import { FREE_MODE_DEFAULT_MODEL, OPENCODE_ZEN_DEFAULT_MODEL, isExplicitProviderState, getFreeModeConfigArgs, getProviderCompatibilityConfigArgs, type FreeModeState } from './freeMode'

const zen: FreeModeState = { enabled: true, provider: 'opencode-zen', apiKey: null, model: OPENCODE_ZEN_DEFAULT_MODEL }
describe('explicit provider authentication', () => {
  it('does not accept missing, disabled, keyless OpenRouter or old shared-key configuration', () => {
    for (const state of [null, { ...zen, enabled: false }, { ...zen, provider: 'openrouter' as const }, { ...zen, provider: 'openrouter' as const, apiKey: 'old-shared', customKey: false }]) {
      expect(isExplicitProviderState(state)).toBe(false)
      if (state) expect(getFreeModeConfigArgs(state, 4173)).toEqual([])
    }
  })
  it('preserves explicitly configured keyless Zen and custom endpoints', () => {
    expect(isExplicitProviderState(zen)).toBe(true)
    expect(getFreeModeConfigArgs(zen, 4173)).toContain('model_provider="opencode_zen"')
    expect(isExplicitProviderState({ ...zen, provider: 'custom', customBaseUrl: 'http://localhost:8000/v1' })).toBe(true)
    expect(isExplicitProviderState({ ...zen, provider: 'custom' })).toBe(false)
  })
  it('preserves personal OpenRouter keys', () => {
    const state: FreeModeState = { enabled: true, apiKey: 'personal-test-key', customKey: true, provider: 'openrouter', model: FREE_MODE_DEFAULT_MODEL }
    expect(isExplicitProviderState(state)).toBe(true)
    expect(getFreeModeConfigArgs(state, 4173)).toContain('model_provider="openrouter_free"')
    expect(getFreeModeConfigArgs(state, 4173)).toContain('model_providers.openrouter_free.base_url="http://127.0.0.1:4173/codex-api/openrouter-proxy/v1"')
  })
  it('registers legacy thread compatibility without selecting Zen as active provider', () => {
    expect(getProviderCompatibilityConfigArgs(4173)).not.toContain('model_provider="opencode_zen"')
  })
})
