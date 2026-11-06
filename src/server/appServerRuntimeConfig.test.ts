import { expect, it } from 'vitest'
import { applyCodexThreadConfig, buildAppServerArgs } from './appServerRuntimeConfig'
it('rejects process launch configuration', () => expect(() => buildAppServerArgs()).toThrow('externally managed'))
it.each(['thread/start', 'thread/resume', 'thread/fork'])('inherits server configuration and preserves explicit choices for %s', method => {
  const params = { modelProvider: 'custom', approvalPolicy: 'on-request', sandbox: 'read-only' }
  expect(applyCodexThreadConfig(method, params)).toBe(params)
})
