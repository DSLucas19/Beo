import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore, getTabRole } from '../store/workspaceStore'
import { 
  ChevronDownIcon, 
  FileTextIcon, 
  SendIcon, 
  SparklesIcon, 
  UserIcon,
  BriefcaseIcon,
  CpuIcon,
  CheckCircle2Icon,
  XCircleIcon,
  UsersIcon,
  UserCheckIcon
} from 'lucide-react'
import {
  buildMentionItems,
  getMentionQuery,
  getRecipientLabel,
  getRecipientOptions,
  insertMention
} from '../utils/chatInteractions'

const DEFAULT_DEPARTMENT_TABS = ['dep_planning', 'dep_engineering', 'dep_marketing', 'dep_finance']

const PRIVATE_AGENTS = [
  { id: 'secretary', label: 'Secretary', avatar: 'S' },
  { id: 'planner', label: 'Planner', avatar: 'P' },
  { id: 'developer', label: 'Developer', avatar: 'D' },
  { id: 'marketer', label: 'Marketer', avatar: 'M' },
  { id: 'finance', label: 'Finance', avatar: 'F' }
]

export default function ChatPane() {
  const {
    activeTab,
    chatMessages,
    departments,
    files,
    projectFiles,
    sendMessage,
    isSending,
    fetchMessages,
    fetchFiles,
    selectTab,
    loadFileContent,
    inboxItems,
    fetchInbox,
    approveItem,
    rejectItem,
    agents,
    fetchAgents,
    swarms,
    fetchSwarms
  } = useWorkspaceStore()

  const [inputText, setInputText] = useState('')
  const [showRecipientMenu, setShowRecipientMenu] = useState(false)
  const [mentionState, setMentionState] = useState({ active: false, query: '', suggestions: [] })
  const [mentionIndex, setMentionIndex] = useState(0)
  const [slashState, setSlashState] = useState({ active: false, query: '', suggestions: [] })
  const [slashIndex, setSlashIndex] = useState(0)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const activePrivateAgent = useWorkspaceStore(state => state.activePrivateAgent) || 'secretary'
  const setActivePrivateAgent = useWorkspaceStore(state => state.setActivePrivateAgent)

  const channel = activeTab === 'secretary_chat'
    ? null
    : getTabChannel(activeTab)

  const SLASH_COMMANDS = useMemo(() => [
    { cmd: '/doc', label: '/doc [name]', desc: 'Propose a new text/markdown document' },
    { cmd: '/preach', label: '/preach [concept]', desc: 'Propose a preach or pitch document' },
    { cmd: '/slide', label: '/slide [topic]', desc: 'Propose a markdown presentation deck (.slide.md)' },
    { cmd: '/sheet', label: '/sheet [filename]', desc: 'Propose a CSV spreadsheet (.csv)' },
    { cmd: '/research', label: '/research [topic]', desc: 'Deploy research agents to compile a report' },
    { cmd: '/swarm', label: '/swarm [task]', desc: 'Deploy a swarm of agents to complete a complex task' }
  ], [])

  const getSlashQuery = (value, caret) => {
    if (value.startsWith('/')) {
      const spaceIndex = value.indexOf(' ')
      if (spaceIndex === -1 || caret <= spaceIndex) {
        return { active: true, query: value.slice(1, caret) }
      }
    }
    return { active: false, query: '' }
  }

  const mentionItems = useMemo(
    () => buildMentionItems(files, projectFiles),
    [files, projectFiles]
  )

  const recipientOptions = useMemo(() => {
    const tabs = Array.from(new Set([...DEFAULT_DEPARTMENT_TABS, ...(departments || [])]))
    return getRecipientOptions(tabs)
  }, [departments])

  useEffect(() => {
    fetchInbox()
    fetchAgents()
    fetchSwarms()
  }, [])

  useEffect(() => {
    fetchMessages(channel)
    fetchFiles()
    fetchInbox()
  }, [activeTab, channel, activePrivateAgent])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const updateMentionState = (value, caret) => {
    const mention = getMentionQuery(value, caret)
    if (!mention.active) {
      setMentionState({ active: false, query: '', suggestions: [] })
      setMentionIndex(0)
      return
    }

    const normalizedQuery = mention.query.toLowerCase()
    const suggestions = mentionItems.filter(item =>
      item.label.toLowerCase().includes(normalizedQuery)
    )

    setMentionState({ ...mention, suggestions })
    setMentionIndex(0)
  }

  const updateSlashState = (value, caret) => {
    const slash = getSlashQuery(value, caret)
    if (!slash.active) {
      setSlashState({ active: false, query: '', suggestions: [] })
      setSlashIndex(0)
      return
    }

    const normalizedQuery = slash.query.toLowerCase()
    const suggestions = SLASH_COMMANDS.filter(item =>
      item.cmd.toLowerCase().includes('/' + normalizedQuery)
    )

    setSlashState({ ...slash, suggestions })
    setSlashIndex(0)
  }

  const handleSend = () => {
    if (!inputText.trim() || isSending) return
    sendMessage(inputText, channel)
    setInputText('')
    setMentionState({ active: false, query: '', suggestions: [] })
    setSlashState({ active: false, query: '', suggestions: [] })
  }

  const selectMention = (item) => {
    const caret = textareaRef.current?.selectionStart ?? inputText.length
    const result = insertMention(inputText, caret, item.label)
    setInputText(result.text)
    setMentionState({ active: false, query: '', suggestions: [] })

    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(result.caret, result.caret)
    }, 0)
  }

  const selectSlash = (item) => {
    setInputText(item.cmd + ' ')
    setSlashState({ active: false, query: '', suggestions: [] })
    window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (event) => {
    const hasMentionSuggestions = mentionState.active && mentionState.suggestions.length > 0
    const hasSlashSuggestions = slashState.active && slashState.suggestions.length > 0

    if (hasMentionSuggestions && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setMentionIndex(current => {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        return (current + delta + mentionState.suggestions.length) % mentionState.suggestions.length
      })
      return
    }

    if (hasSlashSuggestions && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setSlashIndex(current => {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        return (current + delta + slashState.suggestions.length) % slashState.suggestions.length
      })
      return
    }

    if (hasMentionSuggestions && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault()
      selectMention(mentionState.suggestions[mentionIndex])
      return
    }

    if (hasSlashSuggestions && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault()
      selectSlash(slashState.suggestions[slashIndex])
      return
    }

    if ((mentionState.active || slashState.active) && event.key === 'Escape') {
      event.preventDefault()
      setMentionState({ active: false, query: '', suggestions: [] })
      setSlashState({ active: false, query: '', suggestions: [] })
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (event) => {
    const value = event.target.value
    const caret = event.target.selectionStart
    setInputText(value)
    updateMentionState(value, caret)
    updateSlashState(value, caret)
  }

  // --- PREMIUM FILE CLICK INTERACTION ---
  const handleOpenFile = async (filePath) => {
    const cleanPath = filePath.replace(/[`'"]/g, '').trim()
    const isProjectFile = cleanPath.includes('projects/') || projectFiles.some(f => f.path === cleanPath || cleanPath.endsWith(f.path))
    
    if (isProjectFile) {
      const parts = cleanPath.split('/')
      const projIdx = parts.indexOf('projects')
      if (projIdx !== -1 && parts.length > projIdx + 1) {
        const projectName = parts[projIdx + 1]
        selectTab(`proj_${projectName}`)
      }
    } else {
      selectTab('company_files')
      await loadFileContent(cleanPath)
    }
  }

  // --- CUSTOM MARKDOWN + LATEX PARSER SYSTEM ---
  const parseBlocks = (text) => {
    const blocks = []
    let currentIndex = 0
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    let match
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const textBefore = text.slice(currentIndex, match.index)
      if (textBefore.trim()) {
        blocks.push({ type: 'text', content: textBefore })
      }
      blocks.push({ type: 'code', language: match[1], content: match[2] })
      currentIndex = codeBlockRegex.lastIndex
    }
    
    const textAfter = text.slice(currentIndex)
    if (textAfter.trim() || blocks.length === 0) {
      blocks.push({ type: 'text', content: textAfter })
    }
    return blocks
  }

  const parseMathAndText = (text) => {
    const chunks = []
    let currentIndex = 0
    const mathRegex = /\$\$([\s\S]*?)\$\$/g
    let match
    
    while ((match = mathRegex.exec(text)) !== null) {
      const textBefore = text.slice(currentIndex, match.index)
      if (textBefore) {
        chunks.push({ type: 'inline_text', content: textBefore })
      }
      chunks.push({ type: 'block_math', content: match[1] })
      currentIndex = mathRegex.lastIndex
    }
    const textAfter = text.slice(currentIndex)
    if (textAfter) {
      chunks.push({ type: 'inline_text', content: textAfter })
    }
    return chunks
  }

  const parseInlineMath = (text) => {
    const chunks = []
    let currentIndex = 0
    const mathRegex = /\$([^\$]+)\$/g
    let match
    
    while ((match = mathRegex.exec(text)) !== null) {
      const textBefore = text.slice(currentIndex, match.index)
      if (textBefore) {
        chunks.push({ type: 'plain', content: textBefore })
      }
      chunks.push({ type: 'inline_math', content: match[1] })
      currentIndex = mathRegex.lastIndex
    }
    const textAfter = text.slice(currentIndex)
    if (textAfter) {
      chunks.push({ type: 'plain', content: textAfter })
    }
    return chunks
  }

  const renderPlainAndLinks = (text, isUser) => {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\b[a-zA-Z0-9_\-\/]+\.(?:md|csv|log|txt|json|yaml|yml)\b)/g
    const parts = text.split(regex)
    
    return parts.map((part, index) => {
      if (!part) return null
      
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-white/[0.05] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono text-zinc-300 text-xs shadow-inner">
            {part.slice(1, -1)}
          </code>
        )
      }
      
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className={`font-semibold tracking-normal ${isUser ? 'text-white' : 'text-zinc-100'}`}>{part.slice(2, -2)}</strong>
      }
      
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>
      }
      
      if (/\b[a-zA-Z0-9_\-\/]+\.(?:md|csv|log|txt|json|yaml|yml)\b/.test(part)) {
        const cleanPath = part.replace(/[`'"]/g, '').trim()
        const fileExists = files.some(f => f.path === cleanPath || f.path.endsWith(cleanPath)) ||
                           projectFiles.some(f => f.path === cleanPath || f.path.endsWith(cleanPath))
        
        if (fileExists) {
          return (
            <button
              key={index}
              onClick={() => handleOpenFile(part)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/60 border border-white/[0.06] hover:border-white/30 text-[11px] font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all font-semibold mx-0.5 shadow-sm"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="underline decoration-white/20 hover:decoration-white">{part}</span>
            </button>
          )
        } else {
          return (
            <code key={index} className="bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono text-zinc-400 text-xs mx-0.5 shadow-sm select-text">
              {part}
            </code>
          )
        }
      }
      
      return part
    })
  }

  const renderLaTeX = (mathStr, displayMode, key) => {
    if (window.katex) {
      try {
        const html = window.katex.renderToString(mathStr, {
          displayMode: displayMode,
          throwOnError: false,
          trust: true
        })
        if (displayMode) {
          return (
            <div 
              key={key} 
              className="my-3 overflow-x-auto p-4 bg-zinc-950/40 border border-white/[0.04] rounded-2xl text-center select-all scrollbar-thin shadow-inner"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } else {
          return (
            <span 
              key={key} 
              className="inline-block px-1 align-middle select-all"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
      } catch (e) {
        console.warn("KaTeX rendering error:", e)
      }
    }
    
    return displayMode ? (
      <div key={key} className="my-3 p-3 font-mono text-xs bg-zinc-900 border border-white/[0.04] rounded-lg text-center whitespace-pre-wrap select-all text-zinc-400">
        {`$$ ${mathStr} $$`}
      </div>
    ) : (
      <code key={key} className="bg-border-muted/50 px-1 py-0.5 rounded font-mono text-xs select-all text-zinc-400">
        {`$${mathStr}$`}
      </code>
    )
  }

  const renderInlineContent = (text, isUser) => {
    const mathChunks = parseMathAndText(text)
    return mathChunks.map((chunk, idx) => {
      if (chunk.type === 'block_math') {
        return renderLaTeX(chunk.content, true, idx)
      }
      
      const inlineMathChunks = parseInlineMath(chunk.content)
      return inlineMathChunks.map((subChunk, subIdx) => {
        if (subChunk.type === 'inline_math') {
          return renderLaTeX(subChunk.content, false, `${idx}-${subIdx}`)
        }
        return renderPlainAndLinks(subChunk.content, isUser)
      })
    })
  }

  const processLines = (textBlock, blockIdx, isUser) => {
    const lines = textBlock.split('\n')
    const elements = []
    
    let currentList = null
    
    const flushList = (key) => {
      if (currentList) {
        const Tag = currentList.type
        elements.push(
          <Tag key={`list-${blockIdx}-${key}`} className="my-3 pl-6 space-y-1.5 list-outside">
            {currentList.items.map((item, idx) => (
              <li key={idx} className={`${currentList.type === 'ul' ? 'list-disc' : 'list-decimal'} ${isUser ? 'text-zinc-200' : 'text-zinc-300'} text-[14.5px] leading-relaxed`}>
                {item}
              </li>
            ))}
          </Tag>
        )
        currentList = null
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Check for horizontal rule/divider: --- or *** or ___
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushList(i)
        elements.push(
          <hr key={i} className="my-5 border-t border-white/[0.08]" />
        )
        continue
      }
      
      // Skip table markdown separators since tables render as raw text lines
      if (trimmed.startsWith('|') && trimmed.includes('-')) {
        const columns = trimmed.split('|').map(c => c.trim()).filter(Boolean)
        const isSeparator = columns.every(c => /^:?-+:?$/.test(c))
        if (isSeparator) continue
      }

      if (/^\s*[\-\*\+]\s+(.*)/.test(line)) {
        const content = line.match(/^\s*[\-\*\+]\s+(.*)/)[1]
        const renderedContent = renderInlineContent(content, isUser)
        
        if (!currentList || currentList.type !== 'ul') {
          flushList(i)
          currentList = { type: 'ul', items: [renderedContent] }
        } else {
          currentList.items.push(renderedContent)
        }
        continue
      }

      if (/^\s*\d+\s*\.\s+(.*)/.test(line)) {
        const content = line.match(/^\s*\d+\s*\.\s+(.*)/)[1]
        const renderedContent = renderInlineContent(content, isUser)
        
        if (!currentList || currentList.type !== 'ol') {
          flushList(i)
          currentList = { type: 'ol', items: [renderedContent] }
        } else {
          currentList.items.push(renderedContent)
        }
        continue
      }

      flushList(i)

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-2xl font-semibold text-white font-display mt-5 mb-3 border-b border-white/[0.06] pb-2 tracking-tight">
            {renderInlineContent(trimmed.slice(2), isUser)}
          </h1>
        )
        continue
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-xl font-semibold text-white font-display mt-4 mb-2.5 border-b border-white/[0.04] pb-1.5 tracking-tight">
            {renderInlineContent(trimmed.slice(3), isUser)}
          </h2>
        )
        continue
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-semibold text-zinc-300 font-mono uppercase tracking-wider mt-4 mb-1.5">
            {renderInlineContent(trimmed.slice(4), isUser)}
          </h3>
        )
        continue
      }

      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className={`pl-4 border-l-2 ${isUser ? 'border-white/30 text-zinc-300' : 'border-white/10 text-zinc-400'} italic my-3 text-[14px] leading-relaxed`}>
            {renderInlineContent(trimmed.slice(2), isUser)}
          </blockquote>
        )
        continue
      }

      if (trimmed) {
        elements.push(
          <p key={i} className={`leading-relaxed text-[14.5px] ${isUser ? 'text-zinc-100' : 'text-zinc-300'}`}>
            {renderInlineContent(line, isUser)}
          </p>
        )
      } else {
        elements.push(<div key={i} className="h-1.5" />)
      }
    }

    flushList('end')
    
    return elements
  }

  const renderMessageMarkdown = (text, isUser) => {
    if (!text) return ''
    
    const cleanText = text.replace(/```json[\s\S]*?```/g, '').trim()
    const blocks = parseBlocks(cleanText)
    
    return blocks.map((block, idx) => {
      if (block.type === 'code') {
        if (block.language === 'markdown' || !block.language) {
          const content = block.content.trim();
          if (content.startsWith('# Tuyển dụng Nhân sự:') || content.includes('Tuyển dụng Nhân sự:')) {
            return <EmployeeProposalCard key={idx} content={content} />;
          }
          if (content.startsWith('# Triển khai Swarm:') || content.includes('Triển khai Swarm:')) {
            return <SwarmProposalCard key={idx} content={content} />;
          }
        }
        return <CodeBlock key={idx} language={block.language} code={block.content} />
      }
      return <div key={idx} className="space-y-2">{processLines(block.content, idx, isUser)}</div>
    })
  }

  function CodeBlock({ language, code }) {
    const [copied, setCopied] = useState(false)
    
    const handleCopy = () => {
      navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div className="my-4 border border-white/[0.08] rounded-xl bg-zinc-950 overflow-hidden shadow-2xl flex flex-col font-mono text-xs max-w-full">
        <div className="bg-zinc-900/80 px-4 py-2 border-b border-white/[0.04] flex items-center justify-between text-[10px] tracking-wide text-zinc-400 font-bold uppercase select-none">
          <span>{language || 'code'}</span>
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.1] hover:text-white transition-all text-[9px] font-semibold"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed text-zinc-100 select-text font-mono bg-black/10">
          <code className={`language-${language || 'text'}`}>{code.trim()}</code>
        </pre>
      </div>
    )
  }

  const ROLE_ACCENTS = {
    secretary: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    },
    planner: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    },
    developer: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    },
    marketer: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    },
    finance: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    }
  }

  const getRoleAccent = (sender) => {
    const s = (sender || '').toLowerCase()
    if (ROLE_ACCENTS[s]) return ROLE_ACCENTS[s]
    for (const r of Object.keys(ROLE_ACCENTS)) {
      if (s.includes(r)) return ROLE_ACCENTS[r]
    }
    return {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    }
  }

  const getSenderLabel = (sender) => {
    if (sender === 'user') return 'You'
    if (sender === 'secretary') return 'Secretary'
    if (sender === 'planner') return 'Planner'
    if (sender === 'developer') return 'Developer'
    if (sender === 'marketer') return 'Marketer'
    if (sender === 'finance') return 'Finance'
    return sender.charAt(0).toUpperCase() + sender.slice(1)
  }

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 pb-36 font-sans">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            <h3 className="text-3xl font-light text-content-highlight font-display mb-1.5 tracking-wide">Beo</h3>
            <p className="text-xs text-content-muted max-w-[240px] font-sans">
              Start setting up your company.
            </p>
          </div>
        ) : (
          chatMessages.map((msg, index) => {
            const isUser = msg.sender === 'user'
            const accent = getRoleAccent(msg.sender)
            return (
               <div
                key={index}
                className={`flex gap-3 max-w-[48%] ${isUser ? 'ml-auto flex-row-reverse user-message-appear' : 'mr-auto ai-message-appear'}`}
              >
                {/* Avatar and Name */}
                <div className="flex flex-col items-center select-none">
                  <span className={`text-[9px] font-mono tracking-wider mb-1 uppercase text-center font-bold min-h-[14px] ${isUser ? 'text-zinc-500' : accent.text}`}>
                    {getSenderLabel(msg.sender)}
                  </span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
                    isUser
                      ? 'bg-zinc-900 border-white/[0.08] shadow-md hover:border-white/20'
                      : accent.avatarBg + ' shadow-inner hover:border-white/10'
                  }`}>
                    {isUser ? (
                      <UserIcon className="w-3.5 h-3.5 text-content-normal" />
                    ) : (
                      <SparklesIcon className={`w-3.5 h-3.5 ${accent.iconColor}`} />
                    )}
                  </div>
                </div>

                {/* Message Bubble */}
                <div className={`px-5 pt-3 pb-3 rounded-[22px] leading-relaxed chat-message-text border transition-all ${
                  isUser
                    ? 'bg-white/[0.08] backdrop-blur-md border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-zinc-100 hover:border-white/10 hover:bg-white/[0.1] mt-[16px]'
                    : 'bg-zinc-950/[0.45] backdrop-blur-md border border-white/[0.03] shadow-[0_10px_32px_rgba(0,0,0,0.4)] text-zinc-300 hover:border-white/[0.06] hover:bg-zinc-950/[0.55] mt-[16px]'
                }`}>
                  {renderMessageMarkdown(msg.message, isUser)}

                  {!isUser && msg.message && msg.message.includes('propose_files') && (
                    <div className="mt-4 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs text-zinc-300 flex flex-col gap-2 shadow-inner">
                      <span className="font-semibold text-content-highlight flex items-center gap-1.5">Proposed Specifications</span>
                      <span>Drafts for `AIM.md`, `OPERATIONS.md`, and `FINANCE.md` created in Inbox.</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-background-base via-background-base/95 to-transparent pointer-events-none">
        <div className="lava-input-wrapper max-w-3xl w-[92%] mx-auto pointer-events-auto rounded-2xl relative">
          {mentionState.active && (
            <div className="absolute left-4 right-4 bottom-[112px] bg-zinc-950/95 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-1.5 max-h-56 overflow-y-auto z-20">
              {mentionState.suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-content-muted">No matching documents</div>
              ) : (
                mentionState.suggestions.map((item, index) => (
                  <button
                    key={`${item.source}-${item.label}`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectMention(item)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs ${
                      index === mentionIndex
                        ? 'bg-border-muted text-content-highlight'
                        : 'text-content-muted hover:bg-border-muted/30 hover:text-content-normal'
                    }`}
                  >
                    <FileTextIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="ml-auto text-[10px] opacity-70">{item.source}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {slashState.active && slashState.suggestions.length > 0 && (
            <div className="absolute left-4 right-4 bottom-[112px] bg-zinc-950/95 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-1.5 max-h-56 overflow-y-auto z-20">
              {slashState.suggestions.map((item, index) => (
                <button
                  key={item.cmd}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectSlash(item)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs ${
                    index === slashIndex
                      ? 'bg-border-muted text-content-highlight'
                      : 'text-content-muted hover:bg-border-muted/30 hover:text-content-normal'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-content-highlight">{item.label}</span>
                    <span className="text-[10px] text-content-muted mt-0.5">{item.desc}</span>
                  </div>
                  <span className="text-[10px] font-mono text-content-muted bg-white/[0.05] px-1.5 py-0.5 rounded">Tab</span>
                </button>
              ))}
            </div>
          )}

          <div className="w-full bg-background-card/95 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-3.5 flex flex-col">
            <div className="flex items-start gap-2">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={(event) => updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
                placeholder={isSending ? 'Processing...' : 'Type a message...'}
                rows={1}
                disabled={isSending}
                className="flex-1 bg-transparent text-[16px] text-content-normal placeholder-content-muted outline-none resize-none min-h-[40px] max-h-[160px] py-1.5 px-2 font-sans chat-message-text"
              />
            </div>
            <div className="flex justify-between items-center mt-1 px-2 border-t border-border-muted/20 pt-2">
              <div className="relative">
                {activeTab === 'secretary_chat' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRecipientMenu(value => !value)}
                      className="flex items-center gap-2 text-[11px] text-content-muted hover:text-content-highlight font-sans select-none rounded-lg px-1.5 py-1 hover:bg-white/[0.04]"
                    >
                      <span className="w-5 h-5 rounded-md bg-border-muted/60 border border-white/[0.06] flex items-center justify-center text-[10px] text-content-highlight font-bold font-mono">
                        {(PRIVATE_AGENTS.find(a => a.id === activePrivateAgent) || PRIVATE_AGENTS[0]).avatar}
                      </span>
                      <span>Message AI: {(PRIVATE_AGENTS.find(a => a.id === activePrivateAgent) || PRIVATE_AGENTS[0]).label}</span>
                      <ChevronDownIcon className="w-3 h-3" />
                    </button>

                    {showRecipientMenu && (
                      <div className="absolute bottom-8 left-0 w-56 bg-zinc-950/95 border border-white/[0.08] rounded-xl shadow-[0_18px_40px_rgba(0,0,0,0.8)] p-1.5 z-30">
                        {PRIVATE_AGENTS.map(agent => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setActivePrivateAgent(agent.id)
                              setShowRecipientMenu(false)
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs ${
                              activePrivateAgent === agent.id
                                ? 'bg-border-muted text-content-highlight'
                                : 'text-content-muted hover:bg-border-muted/30 hover:text-content-normal'
                            }`}
                          >
                            <span className="w-6 h-6 rounded-md bg-border-muted/50 border border-white/[0.06] flex items-center justify-center text-[10px] font-bold font-mono">
                              {agent.avatar}
                            </span>
                            <span>{agent.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-content-muted font-sans select-none rounded-lg px-1.5 py-1">
                    <span className="w-5 h-5 rounded-md bg-border-muted/60 border border-white/[0.06] flex items-center justify-center text-[10px] text-content-highlight font-bold font-mono">
                      {activeTab.includes('_chat_group') ? activeTab.split('_')[1].charAt(0).toUpperCase() : getRecipientLabel(activeTab).charAt(0)}
                    </span>
                    <span>Chatting with: {activeTab.includes('_chat_group') ? `${activeTab.split('_')[1].charAt(0).toUpperCase() + activeTab.split('_')[1].slice(1)} Group` : getRecipientLabel(activeTab)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isSending}
                className="px-4 py-2 rounded-lg lava-btn-luxury text-white text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 shadow"
              >
                <span>Send</span>
                <SendIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- PROPOSAL PARSERS ---

const parseEmployeeCardDetails = (text) => {
  const reasonMatch = text.match(/\*\*Lý do tuyển dụng\*\*\s*:\s*(.+)/);
  const skillsMatch = text.match(/\*\*Kỹ năng\*\*\s*:\s*(.+)/);
  const mcpMatch = text.match(/\*\*Cổng kết nối MCP\*\*\s*:\s*(.+)/);
  const modelMatch = text.match(/\*\*Mô hình\*\*\s*:\s*(.+)/);
  
  return {
    reason: reasonMatch ? reasonMatch[1].trim() : 'Tuyển dụng nhân sự AI mới.',
    skills: skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()) : [],
    mcp: mcpMatch ? mcpMatch[1].split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'không' && s.toLowerCase() !== 'none') : [],
    model: modelMatch ? modelMatch[1].trim() : 'Gemini 1.5 Flash'
  };
};

const parseSwarmCardDetails = (text) => {
  const reasonMatch = text.match(/\*\*Lý do triển khai\*\*\s*:\s*(.+)/);
  const members = [];
  const memberMatches = [...text.matchAll(/##\s*([\w_]+)\s*\n\s*Nhiệm vụ:\s*(.+?)(?=\n##|$)/gs)];
  for (const match of memberMatches) {
    members.push({ role: match[1].trim(), task: match[2].trim() });
  }
  
  return {
    reason: reasonMatch ? reasonMatch[1].trim() : 'Triển khai Swarm.',
    members
  };
};

// --- INTERACTIVE CARD COMPONENTS ---

function EmployeeProposalCard({ content }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox, agents, fetchAgents } = useWorkspaceStore();
  const details = parseEmployeeCardDetails(content);
  
  // Parse name and role
  const titleMatch = content.match(/#\s*Tuyển\s+dụng\s+Nhân\s+sự:\s*(.+?)\s*\(([^)]+)\)/i);
  const name = titleMatch ? titleMatch[1].trim() : 'Nhân viên mới';
  const role = titleMatch ? titleMatch[2].trim().toLowerCase().replace(' ', '_') : 'custom_agent';
  
  // Find matching inboxItem
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'create_employee' && 
    item.file_path === role
  );
  
  // Check if approved in active agents
  const isApproved = agents.some(a => a.role === role && a.is_active);
  
  const [actionStatus, setActionStatus] = useState(null); // 'approving', 'rejecting', 'done'
  
  const handleCardApprove = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('approving');
    const ok = await approveItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
      fetchAgents();
      fetchInbox();
    } else {
      setActionStatus(null);
    }
  };
  
  const handleCardReject = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('rejecting');
    const ok = await rejectItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
      fetchInbox();
    } else {
      setActionStatus(null);
    }
  };
  
  return (
    <div className="my-5 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(99,102,241,0.1)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-inner">
            <BriefcaseIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Proposed Recruitment</span>
            <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{name} <span className="text-zinc-500 font-medium">({role})</span></h4>
          </div>
        </div>
        
        <div>
          {pendingItem ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Pending Auth</span>
          ) : isApproved ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Active</span>
          ) : (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Processed</span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="space-y-3.5 text-xs text-zinc-300">
        <div>
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Hiring Purpose</span>
          <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{details.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Target LLM</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-[11px] font-semibold text-white font-mono shadow-sm">
              <CpuIcon className="w-3 h-3 text-indigo-400" />
              {details.model}
            </div>
          </div>
          
          {details.mcp.length > 0 && (
            <div>
              <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">MCP Connections</span>
              <div className="flex flex-wrap gap-1.5">
                {details.mcp.map((mcp, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {mcp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {details.skills.length > 0 && (
          <div>
            <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Assigned Skills & Permissions</span>
            <div className="flex flex-wrap gap-1.5">
              {details.skills.map((skill, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-zinc-400 text-[10px] font-mono hover:text-white hover:border-white/10 transition-colors">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action / Status Footer */}
      <div className="border-t border-white/[0.04] pt-3.5 mt-1.5 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 font-mono">
          {pendingItem ? `Cost Estimate: $0.00` : isApproved ? 'Integrated into operations' : 'Request completed'}
        </div>

        <div className="flex items-center gap-2">
          {actionStatus === 'approving' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Deploying Agent...
            </span>
          ) : actionStatus === 'rejecting' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Rejecting...
            </span>
          ) : pendingItem ? (
            <>
              <button
                onClick={handleCardReject}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 hover:border-white/10 hover:text-rose-400 text-zinc-400 font-bold text-xs transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleCardApprove}
                className="px-4.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-extrabold text-xs transition-transform hover:scale-[1.03] shadow-[0_4px_12px_rgba(255,255,255,0.15)] flex items-center gap-1"
              >
                <UserCheckIcon className="w-3.5 h-3.5" />
                <span>Hire Agent</span>
              </button>
            </>
          ) : isApproved ? (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2Icon className="w-4 h-4 text-emerald-500 animate-bounce" />
              <span>Hired & Deployed</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-500 font-bold flex items-center gap-1.5">
              <XCircleIcon className="w-4 h-4 text-zinc-600" />
              <span>Proposal Handled</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SwarmProposalCard({ content }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox, swarms, fetchSwarms } = useWorkspaceStore();
  const details = parseSwarmCardDetails(content);
  
  // Parse name and execution mode
  const titleMatch = content.match(/#\s*Triển\s+khai\s+Swarm:\s*(.+?)\s*\(([^)]+)\)/i);
  const name = titleMatch ? titleMatch[1].trim() : 'Swarm tự động';
  const execMode = titleMatch ? titleMatch[2].trim().toLowerCase().replace('execution_mode:', '').trim() : 'sequential';
  
  // Find matching inboxItem
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'deploy_swarm' && 
    item.proposed_content.includes(name)
  );
  
  // Check if approved in active swarms
  const activeSwarm = swarms.find(s => s.name === name);
  const isApproved = !!activeSwarm;
  const swarmStatus = activeSwarm ? activeSwarm.status : null;
  
  const [actionStatus, setActionStatus] = useState(null); // 'approving', 'rejecting', 'done'
  
  const handleCardApprove = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('approving');
    const ok = await approveItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
      fetchSwarms();
      fetchInbox();
    } else {
      setActionStatus(null);
    }
  };
  
  const handleCardReject = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('rejecting');
    const ok = await rejectItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
      fetchInbox();
    } else {
      setActionStatus(null);
    }
  };
  
  return (
    <div className="my-5 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(245,158,11,0.1)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <UsersIcon className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">Proposed Swarm Run</span>
            <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{name} <span className="text-zinc-500 font-medium">({execMode})</span></h4>
          </div>
        </div>
        
        <div>
          {pendingItem ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Needs Auth</span>
          ) : activeSwarm ? (
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              swarmStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>{swarmStatus}</span>
          ) : (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Processed</span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="space-y-3.5 text-xs text-zinc-300">
        <div>
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Execution Plan</span>
          <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{details.reason}</p>
        </div>

        {details.members.length > 0 && (
          <div>
            <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-2">Swarm Roles & Tasks</span>
            <div className="space-y-2">
              {details.members.map((member, i) => (
                <div key={i} className="flex gap-2.5 p-2 bg-white/[0.02] border border-white/[0.04] rounded-xl shadow-sm">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-white/[0.08] text-[10px] font-bold text-amber-400 flex items-center justify-center shrink-0">
                    {member.role.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-[10px] font-bold text-white tracking-tight">{member.role.toUpperCase()}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{member.task}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action / Status Footer */}
      <div className="border-t border-white/[0.04] pt-3.5 mt-1.5 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 font-mono">
          {pendingItem ? `Cost Estimate: $0.00` : activeSwarm ? `Swarm operational` : 'Request completed'}
        </div>

        <div className="flex items-center gap-2">
          {actionStatus === 'approving' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Kicking off Swarm...
            </span>
          ) : actionStatus === 'rejecting' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Rejecting...
            </span>
          ) : pendingItem ? (
            <>
              <button
                onClick={handleCardReject}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 hover:border-white/10 hover:text-rose-400 text-zinc-400 font-bold text-xs transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleCardApprove}
                className="px-4.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-extrabold text-xs transition-transform hover:scale-[1.03] shadow-[0_4px_12px_rgba(255,255,255,0.15)] flex items-center gap-1.5"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Launch Swarm</span>
              </button>
            </>
          ) : activeSwarm ? (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2Icon className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>Swarm Executing</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-500 font-bold flex items-center gap-1.5">
              <XCircleIcon className="w-4 h-4 text-zinc-600" />
              <span>Proposal Handled</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
