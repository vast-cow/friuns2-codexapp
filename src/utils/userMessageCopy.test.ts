import { describe, expect, it } from 'vitest'
import { buildUserMessageCopyText } from './userMessageCopy'

describe('buildUserMessageCopyText', () => {
  it('preserves the original text and formats attachments', () => {
    const text = '  **hello**\n\n```js\ncode()\n```\n'
    expect(buildUserMessageCopyText({ id: '1', role: 'user', text, images: [' image.png '] }))
      .toBe(`${text}\n\nImages:\nimage.png`)
    expect(buildUserMessageCopyText({ id: '2', role: 'user', text })).toBe(text)
  })

  it('copies attachment-only messages without extra whitespace', () => {
    expect(buildUserMessageCopyText({ id: '1', role: 'user', text: '', images: ['image.png'] }))
      .toBe('Images:\nimage.png')
  })
})
