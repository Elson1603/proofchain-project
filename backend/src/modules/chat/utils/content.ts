const MAX_MESSAGE_LENGTH = Number(process.env.MESSAGE_MAX_LENGTH ?? 8000)

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function sanitizeMessageContent(input?: string) {
  if (!input) {
    return ''
  }

  return input
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
    .replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char)
}

export function assertMessageContent(content: string, messageType: string) {
  if (messageType !== 'FILE' && !content.trim()) {
    throw new Error('Message content is required')
  }
}
