const KNOWN_TEXT_EXTENSIONS = new Set(['md', 'txt', 'csv', 'json', 'yaml', 'yml', 'log'])

export const normalizeDocumentName = (name) => {
  const cleaned = String(name || '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[\\/:\*\?"<>\|]+/g, '')
    .replace(/\s+/g, '_')

  if (!cleaned) return ''

  const parts = cleaned.split('.')
  const extension = parts.length > 1 ? parts.at(-1).toLowerCase() : ''

  if (KNOWN_TEXT_EXTENSIONS.has(extension)) return cleaned
  return `${cleaned}.md`
}

export const formatBytes = (bytes = 0) => {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`

  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1)
  return `${rounded} ${units[unitIndex]}`
}
