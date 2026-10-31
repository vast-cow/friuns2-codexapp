import type { UiMessage } from '../types/codex'

export function buildUserMessageCopyText(message: UiMessage): string {
  const sections: string[] = []
  if (message.text) sections.push(message.text)
  const files = (message.fileAttachments ?? []).map((file) => file.path.trim()).filter(Boolean)
  const images = (message.images ?? []).map((image) => image.trim()).filter(Boolean)
  if (files.length) sections.push(`Files:\n${files.join('\n')}`)
  if (images.length) sections.push(`Images:\n${images.join('\n')}`)
  return sections.join('\n\n')
}
