import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ensureCodexInstalled } from './ensureCodexInstalled'
import { resolveCodexCommand } from '../commandResolution'
import { spawnSyncCommand } from '../utils/commandInvocation'

vi.mock('../commandResolution', () => ({
  resolveCodexCommand: vi.fn(),
  getUserNpmPrefix: () => '/user/npm',
  getNpmGlobalBinDir: () => '/user/npm/bin',
  prependPathEntry: (path: string, entry: string) => `${entry}:${path}`,
}))
vi.mock('../utils/commandInvocation', () => ({ spawnSyncCommand: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubEnv('PATH', '/original')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
const result = (status: number | null) => ({ status }) as ReturnType<typeof spawnSyncCommand>

it('uses an existing CLI without installation', () => {
  vi.mocked(resolveCodexCommand).mockReturnValue('codex')
  expect(ensureCodexInstalled()).toBe('codex')
  expect(spawnSyncCommand).not.toHaveBeenCalled()
})
it('installs only the official CLI and resolves it once after installation', () => {
  vi.mocked(resolveCodexCommand).mockReturnValueOnce(null).mockReturnValueOnce('codex')
  vi.mocked(spawnSyncCommand).mockReturnValue(result(0))
  expect(ensureCodexInstalled()).toBe('codex')
  expect(spawnSyncCommand).toHaveBeenCalledExactlyOnceWith('npm', ['install', '-g', '@openai/codex'], { stdio: 'inherit' })
  expect(resolveCodexCommand).toHaveBeenCalledTimes(2)
})
it('retries a failed global install with the user prefix and updates PATH', () => {
  vi.mocked(resolveCodexCommand).mockReturnValueOnce(null).mockReturnValueOnce('/user/npm/bin/codex')
  vi.mocked(spawnSyncCommand).mockReturnValueOnce(result(1)).mockReturnValueOnce(result(0))
  expect(ensureCodexInstalled()).toBe('/user/npm/bin/codex')
  expect(spawnSyncCommand).toHaveBeenNthCalledWith(2, 'npm', ['install', '-g', '--prefix', '/user/npm', '@openai/codex'], { stdio: 'inherit' })
  expect(process.env.PATH).toBe('/user/npm/bin:/original')
})
it('reports a failed user-prefix install without further attempts', () => {
  vi.mocked(resolveCodexCommand).mockReturnValue(null)
  vi.mocked(spawnSyncCommand).mockReturnValue(result(null))
  expect(() => ensureCodexInstalled()).toThrow('failed with exit code -1')
  expect(spawnSyncCommand).toHaveBeenCalledTimes(2)
})
it('reports a successful install that does not expose a usable binary', () => {
  vi.mocked(resolveCodexCommand).mockReturnValue(null)
  vi.mocked(spawnSyncCommand).mockReturnValue(result(0))
  expect(() => ensureCodexInstalled()).toThrow('binary is still not available in PATH')
})
