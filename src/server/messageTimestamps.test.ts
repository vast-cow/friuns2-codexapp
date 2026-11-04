import { describe, it, expect } from 'vitest'
import { sessionMessageTimes, mergeMessageTimes } from './messageTimestamps'
import { readMessageTimestamp, formatMessageTimestamp } from '../messageTimestamps'

describe('message timestamps', () => {
  it('uses submission and completion evidence independently and survives rereads', () => {
    const row = (type: string, payload: unknown, timestamp = '2026-11-05T00:12:00Z') => JSON.stringify({ type, payload, timestamp })
    const raw = [row('event_msg', { type: 'task_started', turn_id: 'a' }),
      row('event_msg', { type: 'user_message' }),
      row('event_msg', { type: 'task_complete', turn_id: 'a' }, '2026-11-05T00:13:00Z'),
      row('event_msg', { type: 'task_started', turn_id: 'b' }), '{broken'].join('\n')
    const times = sessionMessageTimes(raw)
    expect(times.get('a')).toEqual({ submittedAt: '2026-11-05T00:12:00.000Z', completedAt: '2026-11-05T00:13:00.000Z' })
    expect(times.get('b')?.completedAt).toBeUndefined()
    expect(mergeMessageTimes([{ id: 'a' }, { id: 'unknown' }], times)).toEqual(mergeMessageTimes([{ id: 'a' }, { id: 'unknown' }], sessionMessageTimes(raw)))
    expect(mergeMessageTimes([{ id: 'unknown' }], times)).toEqual([{ id: 'unknown' }])
  })
  it('formats local calendar fields and omits missing or invalid dates', () => {
    expect(formatMessageTimestamp(new Date(2026, 10, 5, 9, 7).toISOString())).toBe('2026/11/05 09:07')
    expect(formatMessageTimestamp(undefined)).toBe('')
    expect(formatMessageTimestamp('invalid')).toBe('')
    expect(readMessageTimestamp('2026-11-05T09:07:00')).toBeUndefined()
    expect(readMessageTimestamp('2026-11-05T09:07:00+09:00')).toBe('2026-11-05T00:07:00.000Z')
  })
})

it('does not attach orphan events or reuse timing across turns', () => {
  const row = (payload: unknown, timestamp = '2026-11-05T00:12:00Z') => JSON.stringify({ type: 'event_msg', payload, timestamp })
  const times = sessionMessageTimes([
    row({ type: 'user_message' }),
    row({ type: 'task_started', turn_id: 'a' }),
    row({ type: 'user_message' }),
    row({ type: 'user_message' }, '2026-11-05T00:12:30Z'),
    row({ type: 'task_complete', turn_id: 'a' }, '2026-11-05T00:13:00Z'),
    row({ type: 'user_message' }),
    row({ type: 'task_started', turn_id: 'b' }),
    row({ type: 'user_message' }, 'invalid'),
  ].join('\n'))
  expect(times.get('a')).toEqual({ submittedAt: '2026-11-05T00:12:00.000Z', completedAt: '2026-11-05T00:13:00.000Z' })
  expect(times.get('b')?.submittedAt).toBeUndefined()
  expect(times.has('')).toBe(false)
})
