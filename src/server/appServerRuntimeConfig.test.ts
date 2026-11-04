import { describe, expect, it } from 'vitest'
import { applyCodexThreadConfig, buildAppServerArgs } from './appServerRuntimeConfig'

describe('app-server runtime config', () => {
  it('enables Codex memories by default for spawned app-server processes', () => {
    const args = buildAppServerArgs()
    const featureIndex = args.indexOf('features.memories=true')

    expect(featureIndex).toBeGreaterThan(0)
    expect(args[featureIndex - 1]).toBe('-c')
  })

  it('can disable Codex memories through runtime configuration', () => {
    process.env.CODEXUI_MEMORIES = 'false'
    try {
      const args = buildAppServerArgs()
      const featureIndex = args.indexOf('features.memories=false')

      expect(featureIndex).toBeGreaterThan(0)
      expect(args[featureIndex - 1]).toBe('-c')
      expect(args).not.toContain('features.memories=true')
    } finally {
      delete process.env.CODEXUI_MEMORIES
    }
  })
})

it('always selects the official Codex provider without compatibility proxies', () => {
  const args = buildAppServerArgs()
  expect(args).toContain('model_provider="openai"')
  expect(args.join(' ')).not.toMatch(/openrouter|opencode|custom_endpoint|proxy/)
})

it.each(['thread/start', 'thread/resume', 'thread/fork'])('uses official Codex for %s without mutating supplied metadata', (method) => {
  const params = { threadId: 'history', modelProvider: 'legacy-endpoint', model: 'gpt-test' }
  expect(applyCodexThreadConfig(method, params)).toEqual({ ...params, modelProvider: 'openai' })
  expect(params.modelProvider).toBe('legacy-endpoint')
})
it('preserves history reads, turn settings and tool approval payloads', () => {
  const params = { threadId: 'history', model: 'gpt-test', effort: 'high', approvalPolicy: 'on-request' }
  for (const method of ['thread/read', 'turn/start', 'account/read', 'account/logout']) expect(applyCodexThreadConfig(method, params)).toBe(params)
})
