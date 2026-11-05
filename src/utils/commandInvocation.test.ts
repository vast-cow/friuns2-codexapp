import { afterEach, expect, it } from 'vitest'
import { getSpawnInvocation } from './commandInvocation'

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform) })
it('runs Linux commands directly', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' })
  expect(getSpawnInvocation('codex', ['--version'])).toEqual({ command: 'codex', args: ['--version'] })
})
it('wraps Windows npm commands and quotes paths with spaces', () => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  expect(getSpawnInvocation('npm', ['install', '-g', '--prefix', 'C:\\User Files\\npm', '@openai/codex'])).toEqual({
    command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm install -g --prefix "C:\\User Files\\npm" @openai/codex'],
  })
})
it('runs Windows Codex executables directly', () => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  expect(getSpawnInvocation('C:\\Codex\\codex.exe', ['--version'])).toEqual({ command: 'C:\\Codex\\codex.exe', args: ['--version'] })
})
