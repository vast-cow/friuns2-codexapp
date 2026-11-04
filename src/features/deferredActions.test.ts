import { describe, expect, it, vi } from 'vitest'
import { deferredActions } from './deferredActions'

describe('deferred feature actions', () => {
  it('shares a controller download across actions and keeps the captured target', async () => {
    let release!: (controller: { open: (target: string) => void }) => void
    const load = vi.fn(() => new Promise<{ open: (target: string) => void }>(resolve => { release = resolve }))
    const actions = deferredActions(load)
    const open = vi.fn()
    const first = actions.invoke('open', 'original-thread')
    const second = actions.invoke('open', 'another-thread')
    release({ open })
    await Promise.all([first, second])
    expect(load).toHaveBeenCalledTimes(1)
    expect(open.mock.calls).toEqual([['original-thread'], ['another-thread']])
  })

  it('retries a rejected import with the original action arguments', async () => {
    const open = vi.fn()
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ open })
    const actions = deferredActions<{ open: (target: string) => void }>(load)
    await actions.invoke('open', 'retained-thread')
    expect(actions.error.value).toBe('offline')
    await actions.retry()
    expect(open).toHaveBeenCalledWith('retained-thread')
    expect(actions.error.value).toBe('')
    await actions.invoke('open', 'reopened-thread')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
