const INJECTION_PATTERNS = [
  /ignore (previous|above|all) instructions?/gi,
  /you are now/gi,
  /new instructions?:/gi,
  /system:/gi,
  /<\|im_start\|>/gi,
  /\[INST\]/gi,
]

export function sanitizeForPrompt(input: string): string {
  if (typeof input !== 'string') return ''
  let sanitized = input.slice(0, 2000)
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }
  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

export function sanitizeArray(items: string[]): string[] {
  return items.map(sanitizeForPrompt)
}
