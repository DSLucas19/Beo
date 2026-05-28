const titleCase = (value) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const buildMentionItems = (files = [], projectFiles = []) => {
  const seen = new Set()
  const items = []

  const addFiles = (sourceFiles, source) => {
    sourceFiles.forEach(file => {
      const label = file?.path || file?.name
      if (!label || seen.has(label)) return
      seen.add(label)
      items.push({ label, source })
    })
  }

  addFiles(files, 'Company Documents')
  addFiles(projectFiles, 'Project Files')

  return items
}

export const getMentionQuery = (text, caret) => {
  const beforeCaret = text.slice(0, caret)
  const atIndex = beforeCaret.lastIndexOf('@')

  if (atIndex === -1) {
    return { active: false, query: '', start: -1, end: caret }
  }

  const query = beforeCaret.slice(atIndex + 1)
  if (/\s/.test(query)) {
    return { active: false, query: '', start: -1, end: caret }
  }

  return { active: true, query, start: atIndex, end: caret }
}

export const insertMention = (text, caret, fileName) => {
  const mention = getMentionQuery(text, caret)
  const insertText = `@${fileName}`
  const start = mention.active ? mention.start : caret
  const end = mention.active ? mention.end : caret
  const nextChar = text.slice(end, end + 1)
  const needsSpace = nextChar && nextChar !== ' '
  const replacement = needsSpace ? `${insertText} ` : insertText

  return {
    text: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
    caret: start + replacement.length + (nextChar === ' ' ? 1 : 0)
  }
}

export const getRecipientOptions = (departments = []) => {
  const tabs = ['secretary_chat', ...departments]
  const seen = new Set()

  return tabs
    .filter(tab => {
      if (!tab || seen.has(tab)) return false
      seen.add(tab)
      return true
    })
    .map(tab => ({
      tab,
      label: getRecipientLabel(tab),
      avatar: tab === 'secretary_chat' ? 'S' : titleCase(tab.replace(/^dep_/, '')).charAt(0)
    }))
}

export const getRecipientLabel = (tab) => {
  if (tab === 'secretary_chat') return 'Secretary'
  if (tab?.startsWith('dep_')) return titleCase(tab.replace(/^dep_/, ''))
  if (tab?.startsWith('proj_')) return titleCase(tab.replace(/^proj_/, ''))
  return titleCase(tab || 'Secretary')
}
