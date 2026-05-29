import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore, getTabRole, getTabChannel } from '../store/workspaceStore'
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
  UserCheckIcon,
  CopyIcon,
  CheckIcon,
  X as XIcon,
  Search as SearchIcon,
  Paperclip as PaperclipIcon,
  Terminal as TerminalIcon,
  Plus as PlusIcon
} from 'lucide-react'
import mermaid from 'mermaid'

// Initialize mermaid with premium Tokyo-Night theme colors
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    background: '#1a1b26',
    primaryColor: '#292e42',
    primaryTextColor: '#a9b1d6',
    primaryBorderColor: '#3d59a1',
    lineColor: '#3d59a1',
    secondaryColor: '#7aa2f7',
    tertiaryColor: '#bb9af7',
    mainBkg: '#292e42',
    nodeBorder: '#3d59a1',
    arrowheadColor: '#7aa2f7'
  },
  securityLevel: 'loose',
  flowchart: {
    htmlLabels: true,
    useMaxWidth: true
  }
})

function MermaidRenderer({ chartCode }) {
  const containerRef = useRef(null)
  const [svgContent, setSvgContent] = useState('')
  const [error, setError] = useState(null)
  const idRef = useRef(`mermaid-${Math.floor(Math.random() * 1000000)}`)

  useEffect(() => {
    let active = true
    const renderChart = async () => {
      try {
        setError(null)
        const cleanCode = chartCode.trim()
        const { svg } = await mermaid.render(idRef.current, cleanCode)
        if (active) {
          setSvgContent(svg)
        }
      } catch (err) {
        console.error("Mermaid Render Error:", err)
        if (active) {
          setError(err.message || 'Error rendering diagram')
        }
        const badElement = document.getElementById(idRef.current)
        if (badElement) {
          badElement.remove()
        }
      }
    }

    renderChart()
    return () => {
      active = false
    }
  }, [chartCode])

  if (error) {
    return (
      <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl font-mono text-[11px] text-red-400 my-4 select-text">
        <span className="font-bold block mb-1">⚠️ Sơ đồ Mermaid có lỗi cú pháp:</span>
        <pre className="whitespace-pre-wrap">{chartCode}</pre>
        <span className="text-[10px] text-red-500 block mt-2">Chi tiết: {error}</span>
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center p-8 bg-zinc-900/40 border border-white/[0.04] rounded-xl my-4 animate-pulse text-zinc-500 text-xs font-mono">
        🔄 Đang vẽ sơ đồ Mermaid (Tokyo-Night Style)...
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="my-4 p-4 border border-white/[0.08] rounded-xl bg-zinc-950/80 shadow-2xl overflow-x-auto flex items-center justify-center select-none"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
import {
  buildMentionItems,
  getMentionQuery,
  getRecipientLabel,
  getRecipientOptions,
  insertMention
} from '../utils/chatInteractions'

function AnimatedActionText({ action }) {
  const [displayAction, setDisplayAction] = useState(action)
  const [animationClass, setAnimationClass] = useState('action-fade-in')

  useEffect(() => {
    if (action !== displayAction) {
      setAnimationClass('action-fade-out')
      const timer = setTimeout(() => {
        setDisplayAction(action)
        setAnimationClass('action-fade-in')
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [action, displayAction])

  return (
    <span className={`inline-block ${animationClass}`}>
      {displayAction}
    </span>
  )
}

const DEFAULT_DEPARTMENT_TABS = ['dep_planning', 'dep_engineering', 'dep_marketing', 'dep_finance', 'dep_product']

const PRIVATE_AGENTS = [
  { id: 'secretary', label: 'Secretary', avatar: 'Sec' },
  { id: 'coo', label: 'COO', avatar: 'COO' },
  { id: 'cto', label: 'CTO', avatar: 'CTO' },
  { id: 'cmo', label: 'CMO', avatar: 'CMO' },
  { id: 'cfo', label: 'CFO', avatar: 'CFO' },
  { id: 'cpo', label: 'CPO', avatar: 'CPO' }
]

export default function ChatPane() {
  const {
    workspaceId,
    activeTab,
    chatMessages,
    departments,
    projects,
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
    fetchSwarms,
    retryWorkflowStep
  } = useWorkspaceStore()

  const [inputText, setInputText] = useState('')
  const [showRecipientMenu, setShowRecipientMenu] = useState(false)
  const [selectedImages, setSelectedImages] = useState([])
  const fileInputRef = useRef(null)
  
  // Custom Status Popup & Split-pane Doc Viewer States
  const [showMembersPopup, setShowMembersPopup] = useState(false)
  const [manuallyAttachedFiles, setManuallyAttachedFiles] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)
  const [activeDocContent, setActiveDocContent] = useState('')
  const [isLoadingDoc, setIsLoadingDoc] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [showFileSelector, setShowFileSelector] = useState(false)
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

  const [currentAction, setCurrentAction] = useState('Đang suy nghĩ...')

  useEffect(() => {
    if (!isSending) {
      setCurrentAction('')
      return
    }

    const getDynamicAction = () => {
      const streamingMsg = chatMessages.find(m => m.isStreaming)
      if (!streamingMsg) {
        if (activePrivateAgent === 'secretary') return 'Thư ký đang phân tích yêu cầu...'
        return `${getSenderLabel(activePrivateAgent)} đang phân tích yêu cầu...`
      }
      
      const senderLabel = getSenderLabel(streamingMsg.sender)
      const text = streamingMsg.message || ''

      // 1. Check for filename/file write in progress
      const fileMatch = text.match(/"name"\s*:\s*"([^"]+)"/) || 
                        text.match(/(?:tạo|ghi|soạn|đọc|sửa|cập nhật) tệp (?:tin )?`([^`]+)`/i) || 
                        text.match(/`([^`]+\.(?:md|py|js|ts|json|css|html|txt))`/)
      if (fileMatch) {
        const filename = fileMatch[1]
        return `${senderLabel} đang soạn thảo tệp \`${filename}\`...`
      }

      // 2. Check for terminal command execution
      const cmdMatch = text.match(/"command"\s*:\s*"([^"]+)"/) || 
                       text.match(/(?:chạy|thực thi) lệnh `([^`]+)`/i)
      if (cmdMatch) {
        return `${senderLabel} đang chuẩn bị chạy lệnh \`${cmdMatch[1]}\`...`
      }

      // 3. Check for employee recruitment
      const empMatch = text.match(/#\s*Tuyển\s+dụng\s+Nhân\s+sự:\s*([^\n(]+)/i) || text.match(/tuyển dụng nhân sự `?([^`\n]+)`?/i)
      if (empMatch) {
        return `${senderLabel} đang soạn đề xuất tuyển dụng \`${empMatch[1].trim()}\`...`
      }

      // 4. Check for swarm deployment
      const swarmMatch = text.match(/#\s*Triển\s+khai\s+Swarm:\s*([^\n(]+)/i) || text.match(/triển khai swarm `?([^`\n]+)`?/i)
      if (swarmMatch) {
        return `${senderLabel} đang soạn kế hoạch triển khai Swarm \`${swarmMatch[1].trim()}\`...`
      }

      // 5. Check for team creation
      const teamMatch = text.match(/#\s*Thành\s+lập\s+Nhóm:\s*([^\n(]+)/i) || text.match(/thành lập nhóm `?([^`\n]+)`?/i)
      if (teamMatch) {
        return `${senderLabel} đang soạn đề xuất thành lập nhóm \`${teamMatch[1].trim()}\`...`
      }

      // Fallback by sender role
      if (streamingMsg.sender === 'secretary') {
        return 'Thư ký đang soạn phản hồi...'
      } else if (streamingMsg.sender === 'coo') {
        return 'COO đang thiết lập quy trình & lộ trình...'
      } else if (streamingMsg.sender === 'cto') {
        return 'CTO đang xây dựng giải pháp kỹ thuật...'
      } else if (streamingMsg.sender === 'cmo') {
        return 'CMO đang phác thảo kế hoạch tiếp thị...'
      } else if (streamingMsg.sender === 'cfo') {
        return 'CFO đang tính toán số liệu tài chính...'
      } else if (streamingMsg.sender === 'cpo') {
        return 'CPO đang thiết kế chiến lược sản phẩm...'
      }

      return `${senderLabel} đang soạn phản hồi...`
    }

    setCurrentAction(getDynamicAction())
  }, [isSending, chatMessages, activeTab, activePrivateAgent])

  // --- CHAT SESSION MEMBER STATUS & DOCUMENTS RESOLVER ---
  const DEFAULT_AGENT_DATA = useMemo(() => [
    { role: 'secretary', name: 'Secretary', is_active: true },
    { role: 'coo', name: 'COO', is_active: true },
    { role: 'cto', name: 'CTO', is_active: true },
    { role: 'cmo', name: 'CMO', is_active: true },
    { role: 'cfo', name: 'CFO', is_active: true },
    { role: 'cpo', name: 'CPO', is_active: true },
    { role: 'ceo', name: 'CEO', is_active: true },
    { role: 'cco', name: 'CCO', is_active: true },
    { role: 'cdo', name: 'CDO', is_active: true },
    { role: 'chro', name: 'CHRO', is_active: true },
    { role: 'cso', name: 'CSO', is_active: true }
  ], [])

  const allWorkspaceAgents = agents || []
  const workflows = useWorkspaceStore(state => state.workflows) || []

  const mergedAgents = useMemo(() => {
    const list = [...allWorkspaceAgents]
    DEFAULT_AGENT_DATA.forEach(def => {
      if (!list.some(a => a.role === def.role)) {
        list.push(def)
      }
    })
    return list
  }, [allWorkspaceAgents, DEFAULT_AGENT_DATA])

  const currentAgentRole = useMemo(() => getTabRole(activeTab), [activeTab])

  const agentHasIssue = useMemo(() => {
    return workflows.some(w => w.role === currentAgentRole && w.status === 'failed')
  }, [workflows, currentAgentRole])

  const filteredChatMembers = useMemo(() => {
    if (activeTab === 'secretary_chat') {
      return mergedAgents.filter(a => a.role === 'secretary')
    }
    
    let activeTeamId = null
    if (activeTab.includes('_team_')) {
      const parts = activeTab.split('_team_')
      if (parts.length > 1) {
        activeTeamId = parts[1]
      }
    }

    return mergedAgents.filter(agent => {
      const isChief = agent.role === currentAgentRole
      const isSubordinate = agent.parent_role === currentAgentRole
      const belongsToTeam = activeTeamId ? (agent.team_id === activeTeamId || String(agent.team_id) === String(activeTeamId)) : false
      
      if (activeTeamId) {
        return isChief || belongsToTeam
      }
      
      return isChief || isSubordinate
    })
  }, [mergedAgents, activeTab, currentAgentRole])

  const sortedChatMembers = useMemo(() => {
    let list = filteredChatMembers
    if (list.length === 0) {
      list = mergedAgents.filter(a => a.role === currentAgentRole)
    }

    const members = list.map(agent => {
      const isCurrent = agent.role === currentAgentRole
      let status = 'offline'
      if (agent.has_failed) {
        status = 'warning'
      } else if (isCurrent) {
        status = agentHasIssue ? 'warning' : 'active'
      } else {
        status = agent.is_active ? 'active' : 'offline'
      }
      return {
        ...agent,
        status,
        displayName: agent.name || agent.role.toUpperCase()
      }
    })

    return members.sort((a, b) => {
      const order = { 'active': 1, 'warning': 2, 'offline': 3 }
      return order[a.status] - order[b.status]
    })
  }, [filteredChatMembers, mergedAgents, currentAgentRole, agentHasIssue])

  // Parse files shared/mentioned in current chat messages
  const parsedDocs = useMemo(() => {
    const docNames = new Set()
    chatMessages.forEach(msg => {
      if (!msg.message) return
      const fileRegex = /\b([a-zA-Z0-9_\-\/]+\.(?:md|csv|log|txt|json|yaml|yml))\b/g
      let match
      while ((match = fileRegex.exec(msg.message)) !== null) {
        const cleanName = match[1].replace(/[`'"]/g, '').trim()
        docNames.add(cleanName)
      }
    })
    return Array.from(docNames)
  }, [chatMessages])

  const sessionDocs = useMemo(() => {
    const merged = new Set([...parsedDocs, ...manuallyAttachedFiles])
    return Array.from(merged)
  }, [parsedDocs, manuallyAttachedFiles])

  // Load session doc content via API
  const loadSessionDocContent = async (fileName) => {
    setIsLoadingDoc(true)
    setActiveDocContent('')
    try {
      const cleanPath = fileName.replace(/[`'"]/g, '').trim()
      const isProj = cleanPath.includes('projects/') || projectFiles.some(f => f.path === cleanPath || cleanPath.endsWith(f.path))
      let res;
      if (isProj) {
        const parts = cleanPath.split('/')
        const projIdx = parts.indexOf('projects')
        let projectName = activeTab.startsWith('proj_') ? activeTab.replace('proj_', '') : '';
        if (projIdx !== -1 && parts.length > projIdx + 1) {
          projectName = parts[projIdx + 1]
        }
        if (!projectName && projects && projects.length > 0) {
          projectName = projects[0]
        }
        const cleanFileName = parts.slice(projIdx + 2).join('/') || cleanPath
        res = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/projects/${projectName}/files/${cleanFileName}`)
      } else {
        res = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/files/${cleanPath}`)
      }

      if (res.ok) {
        const data = await res.json()
        setActiveDocContent(data.content || '')
        setActiveDoc(fileName)
      } else {
        setActiveDocContent(`### File Not Found or Empty\nCould not fetch content for file: \`${fileName}\``)
        setActiveDoc(fileName)
      }
    } catch (err) {
      console.error(err)
      setActiveDocContent(`### Error loading file\nAn error occurred while loading: \`${fileName}\`.\n\nDetails: ${err.message}`)
      setActiveDoc(fileName)
    } finally {
      setIsLoadingDoc(false)
    }
  }

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

  const mentionItems = useMemo(() => {
    const docItems = buildMentionItems(files, projectFiles)
    const agentItems = []

    agentItems.push({
      label: 'All',
      value: 'All',
      source: 'Broadcast Tag',
      type: 'tag'
    })

    sortedChatMembers.forEach(member => {
      if (!agentItems.some(item => item.value === member.role)) {
        agentItems.push({
          label: member.displayName || member.role.toUpperCase(),
          value: member.role,
          source: 'Agent',
          type: 'agent'
        })
      }
    })

    return [...agentItems, ...docItems]
  }, [files, projectFiles, sortedChatMembers])

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
      item.label.toLowerCase().includes(normalizedQuery) ||
      (item.value && item.value.toLowerCase().includes(normalizedQuery))
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

  const handleFileChange = (e) => {
    const filesList = Array.from(e.target.files || [])
    const newImages = filesList.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    setSelectedImages(prev => [...prev, ...newImages])
  }

  const removeSelectedImage = (idx) => {
    setSelectedImages(prev => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[idx].preview)
      copy.splice(idx, 1)
      return copy
    })
  }

  const handleSend = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || isSending) return
    
    let uploadedUrls = []
    if (selectedImages.length > 0) {
      for (const img of selectedImages) {
        const formData = new FormData()
        formData.append("file", img.file)
        try {
          const res = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/upload`, {
            method: 'POST',
            body: formData
          })
          if (res.ok) {
            const data = await res.json()
            if (data.url) {
              uploadedUrls.push(data.url)
            }
          }
        } catch (err) {
          console.error("Failed to upload image:", err)
        }
      }
    }
    
    const attachmentsJson = uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls) : null
    
    sendMessage(inputText, channel, attachmentsJson)
    setInputText('')
    setSelectedImages([])
    setMentionState({ active: false, query: '', suggestions: [] })
    setSlashState({ active: false, query: '', suggestions: [] })
  }

  const selectMention = (item) => {
    const caret = textareaRef.current?.selectionStart ?? inputText.length
    const insertVal = item.value || item.label
    const result = insertMention(inputText, caret, insertVal)
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
    
    // First, check if there's a pending inbox item for this file
    const inboxItem = inboxItems.find(item => item.file_path === cleanPath || (item.file_path && item.file_path.endsWith(cleanPath)))
    if (inboxItem) {
      selectTab('inbox')
      useWorkspaceStore.getState().setSelectedInboxItemId(inboxItem.id)
      return
    }
    
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
    const codeBlockRegex = /```(\w*)\r?\n([\s\S]*?)```/g
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

  const renderPlainAndLinks = (text, isUser, searchQuery) => {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\b[a-zA-Z0-9_\-\/]+\.(?:md|csv|log|txt|json|yaml|yml)\b)/g
    const parts = text.split(regex)
    
    const highlight = (txt) => {
      if (!searchQuery) return txt
      const idx = txt.toLowerCase().indexOf(searchQuery.toLowerCase())
      if (idx === -1) return txt
      const before = txt.substring(0, idx)
      const match = txt.substring(idx, idx + searchQuery.length)
      const after = txt.substring(idx + searchQuery.length)
      return (
        <span>
          {before}
          <span className="text-search-highlight">{match}</span>
          {highlight(after)}
        </span>
      )
    }

    return parts.map((part, index) => {
      if (!part) return null
      
      let isWrappedInBackticks = part.startsWith('`') && part.endsWith('`')
      let isWrappedInBold = part.startsWith('**') && part.endsWith('**')
      let isWrappedInItalic = part.startsWith('*') && part.endsWith('*')
      
      let innerText = part
      if (isWrappedInBackticks) innerText = part.slice(1, -1)
      else if (isWrappedInBold) innerText = part.slice(2, -2)
      else if (isWrappedInItalic) innerText = part.slice(1, -1)
      
      const cleanPath = innerText.replace(/[`'"]/g, '').trim()
      const isFilePattern = /\b[a-zA-Z0-9_\-\/]+\.(?:md|csv|log|txt|json|yaml|yml)\b/.test(cleanPath)
      
      if (isFilePattern) {
        const fileExists = files.some(f => f.path === cleanPath || f.path.endsWith(cleanPath)) ||
                           projectFiles.some(f => f.path === cleanPath || f.path.endsWith(cleanPath))
        const inInbox = inboxItems.some(item => item.file_path === cleanPath || (item.file_path && item.file_path.endsWith(cleanPath)))
        
        if (fileExists || inInbox) {
          return (
            <button
              key={index}
              onClick={() => handleOpenFile(cleanPath)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/60 border border-white/[0.06] hover:border-white/30 text-[11px] font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all font-semibold mx-0.5 shadow-sm"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="underline decoration-white/20 hover:decoration-white">{highlight(cleanPath)}</span>
            </button>
          )
        }
      }
      
      if (isWrappedInBackticks) {
        return (
          <code key={index} className="bg-white/[0.05] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono text-zinc-300 text-xs shadow-inner">
            {highlight(innerText)}
          </code>
        )
      }
      
      if (isWrappedInBold) {
        return <strong key={index} className={`font-semibold tracking-normal ${isUser ? 'text-white' : 'text-zinc-100'}`}>{highlight(innerText)}</strong>
      }
      
      if (isWrappedInItalic) {
        return <em key={index} className="italic text-zinc-300">{highlight(innerText)}</em>
      }
      
      if (isFilePattern) {
        return (
          <code key={index} className="bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono text-zinc-400 text-xs mx-0.5 shadow-sm select-text">
            {highlight(part)}
          </code>
        )
      }
      
      return highlight(part)
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

  const renderInlineContent = (text, isUser, searchQuery) => {
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
        return renderPlainAndLinks(subChunk.content, isUser, searchQuery)
      })
    })
  }

  const processLines = (textBlock, blockIdx, isUser, searchQuery) => {
    const lines = textBlock.split('\n')
    const elements = []
    
    let currentList = null
    let currentTable = null
    
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

    const flushTable = (key) => {
      if (currentTable) {
        if (currentTable.rows.length > 0) {
          const headers = currentTable.rows[0]
          const dataRows = currentTable.rows.slice(1)
          
          elements.push(
            <div key={`table-${blockIdx}-${key}`} className="overflow-x-auto border border-white/[0.06] rounded-xl shadow-xl my-4 select-text bg-zinc-900/20 backdrop-blur-sm">
              <table className="min-w-full divide-y divide-white/[0.06] font-sans text-xs">
                <thead className="bg-zinc-950/40 text-zinc-200 font-semibold">
                  <tr>
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-4 py-2.5 text-left border-b border-white/[0.06] font-bold text-[12px] uppercase select-text">
                        {renderInlineContent(h, isUser, searchQuery)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] bg-black/10 text-zinc-300">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.02] even:bg-white/[0.01] transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 whitespace-normal break-words leading-relaxed text-[13.5px]">
                          {renderInlineContent(cell, isUser, searchQuery)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        currentTable = null
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Check if it is a table row starting and ending with |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushList(i)
        
        const columns = trimmed.split('|').map(c => c.trim()).filter(Boolean)
        const isSeparator = columns.every(c => /^:?-+:?$/.test(c))
        
        if (isSeparator) {
          if (!currentTable) {
            currentTable = { rows: [] }
          }
          continue
        }
        
        const rowCells = trimmed.split('|')
          .slice(1, -1)
          .map(cell => cell.trim())
          
        if (!currentTable) {
          currentTable = { rows: [] }
        }
        currentTable.rows.push(rowCells)
        continue
      }
      
      // Non-table line, so flush the table first
      flushTable(i)
      
      // Check for horizontal rule/divider: --- or *** or ___
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushList(i)
        elements.push(
          <hr key={i} className="my-5 border-t border-white/[0.08]" />
        )
        continue
      }
      
      if (/^\s*[\-\*\+]\s+(.*)/.test(line)) {
        const content = line.match(/^\s*[\-\*\+]\s+(.*)/)[1]
        const renderedContent = renderInlineContent(content, isUser, searchQuery)
        
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
        const renderedContent = renderInlineContent(content, isUser, searchQuery)
        
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
            {renderInlineContent(trimmed.slice(2), isUser, searchQuery)}
          </h1>
        )
        continue
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-xl font-semibold text-white font-display mt-4 mb-2.5 border-b border-white/[0.04] pb-1.5 tracking-tight">
            {renderInlineContent(trimmed.slice(3), isUser, searchQuery)}
          </h2>
        )
        continue
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-semibold text-zinc-300 font-mono uppercase tracking-wider mt-4 mb-1.5">
            {renderInlineContent(trimmed.slice(4), isUser, searchQuery)}
          </h3>
        )
        continue
      }

      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className={`pl-4 border-l-2 ${isUser ? 'border-white/30 text-zinc-300' : 'border-white/10 text-zinc-400'} italic my-3 text-[14px] leading-relaxed`}>
            {renderInlineContent(trimmed.slice(2), isUser, searchQuery)}
          </blockquote>
        )
        continue
      }

      if (trimmed) {
        elements.push(
          <p key={i} className={`leading-relaxed text-[14.5px] ${isUser ? 'text-zinc-100' : 'text-zinc-300'}`}>
            {renderInlineContent(line, isUser, searchQuery)}
          </p>
        )
      } else {
        elements.push(<div key={i} className="h-1.5" />)
      }
    }

    flushList('end')
    flushTable('end')
    
    return elements
  }

  const renderMessageMarkdown = (text, isUser, searchQuery) => {
    if (!text) return ''
    
    // Parse original text directly so we can inspect JSON blocks
    const blocks = parseBlocks(text)
    
    return blocks.map((block, idx) => {
      if (block.type === 'code') {
        if (block.language === 'mermaid') {
          return <MermaidRenderer key={idx} chartCode={block.content} />
        }
        
        // Handle JSON code blocks (which often represent AI tool calls/proposals)
        if (block.language === 'json') {
          try {
            const data = JSON.parse(block.content.trim())
            if (data.action === 'propose_command') {
              return <CommandProposalCard key={idx} data={data} />;
            }
            if (data.action === 'propose_files') {
              return <FileProposalCard key={idx} data={data} />;
            }
            if (data.action === 'deploy_swarm' || data.action === 'create_meeting') {
              return <SwarmJsonProposalCard key={idx} data={data} />;
            }
          } catch (e) {
            // Render skeleton placeholder for active streaming of action JSON blocks
            const blockContent = block.content.trim();
            if (blockContent.includes('"action"') || blockContent.includes('action')) {
              return (
                <div key={idx} className="my-4 border border-white/[0.04] rounded-2xl bg-zinc-950/40 p-4 flex flex-col gap-3 font-sans animate-pulse select-none">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-zinc-800" />
                    <div className="h-3 w-32 bg-zinc-800 rounded" />
                  </div>
                  <div className="h-12 w-full bg-zinc-900/50 rounded-lg" />
                </div>
              );
            }
          }
          // Internal JSON configurations should remain hidden to keep chat clean (original behavior)
          return null;
        }

        // Handle Markdown code blocks representing proposals
        if (block.language === 'markdown' || !block.language) {
          const content = block.content.trim();
          if (content.startsWith('# Tuyển dụng Nhân sự:') || content.includes('Tuyển dụng Nhân sự:')) {
            return <EmployeeProposalCard key={idx} content={content} />;
          }
          if (content.startsWith('# Triển khai Swarm:') || content.includes('Triển khai Swarm:')) {
            return <SwarmProposalCard key={idx} content={content} />;
          }
          if (content.startsWith('# Thành lập Nhóm:') || content.includes('Thành lập Nhóm:')) {
            return <TeamProposalCard key={idx} content={content} />;
          }
        }
        return <CodeBlock key={idx} language={block.language} code={block.content} />
      }
      return <div key={idx} className="space-y-2">{processLines(block.content, idx, isUser, searchQuery)}</div>
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

  function CopyButton({ text }) {
    const [copied, setCopied] = useState(false)
    
    const handleCopy = (e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <button
        onClick={handleCopy}
        title="Copy message"
        className="p-1.5 rounded-lg bg-zinc-900/90 border border-white/[0.08] hover:bg-zinc-800 hover:border-white/20 hover:text-white text-zinc-400 transition-all shadow-md flex items-center justify-center backdrop-blur-sm focus:outline-none"
      >
        {copied ? (
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <CopyIcon className="w-3.5 h-3.5" />
        )}
      </button>
    )
  }

  const ROLE_ACCENTS = {
    secretary: {
      accent: 'border-white/[0.03]',
      text: 'text-zinc-400',
      avatarBg: 'bg-zinc-900 border-white/[0.06]',
      iconColor: 'text-zinc-400'
    },
    coo: {
      accent: 'border-indigo-500/20',
      text: 'text-indigo-400',
      avatarBg: 'bg-indigo-950/20 border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.1)]',
      iconColor: 'text-indigo-400'
    },
    cto: {
      accent: 'border-emerald-500/20',
      text: 'text-emerald-400',
      avatarBg: 'bg-emerald-950/20 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
      iconColor: 'text-emerald-400'
    },
    cmo: {
      accent: 'border-pink-500/20',
      text: 'text-pink-400',
      avatarBg: 'bg-pink-950/20 border-pink-500/20 shadow-[0_0_12px_rgba(236,72,153,0.1)]',
      iconColor: 'text-pink-400'
    },
    cfo: {
      accent: 'border-amber-500/20',
      text: 'text-amber-400',
      avatarBg: 'bg-amber-950/20 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]',
      iconColor: 'text-amber-400'
    },
    cpo: {
      accent: 'border-cyan-500/20',
      text: 'text-cyan-400',
      avatarBg: 'bg-cyan-950/20 border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]',
      iconColor: 'text-cyan-400'
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
    if (sender === 'coo') return 'COO'
    if (sender === 'cto') return 'CTO'
    if (sender === 'cmo') return 'CMO'
    if (sender === 'cfo') return 'CFO'
    if (sender === 'cpo') return 'CPO'
    return sender.charAt(0).toUpperCase() + sender.slice(1)
  }
  const CsvTable = ({ content, query }) => {
    if (!content) return <div className="text-zinc-500 italic text-xs">Table is empty</div>
    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length === 0) return <div className="text-zinc-500 italic text-xs">Table is empty</div>
    
    const rows = lines.map(line => {
      const cells = []
      let insideQuote = false
      let currentCell = ''
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          insideQuote = !insideQuote
        } else if (char === ',' && !insideQuote) {
          cells.push(currentCell.trim())
          currentCell = ''
        } else {
          currentCell += char
        }
      }
      cells.push(currentCell.trim())
      return cells
    })

    const headers = rows[0]
    const dataRows = rows.slice(1)

    const highlight = (txt) => {
      if (!query) return txt
      const idx = txt.toLowerCase().indexOf(query.toLowerCase())
      if (idx === -1) return txt
      const before = txt.substring(0, idx)
      const match = txt.substring(idx, idx + query.length)
      const after = txt.substring(idx + query.length)
      return (
        <span>
          {before}
          <span className="text-search-highlight">{match}</span>
          {highlight(after)}
        </span>
      )
    }

    return (
      <div className="overflow-x-auto border border-white/[0.06] rounded-xl shadow-xl my-4">
        <table className="min-w-full divide-y divide-white/[0.06] font-mono text-[11px]">
          <thead className="bg-zinc-900/60 text-zinc-400 select-none">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2 text-left font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] bg-black/10 text-zinc-300">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">{highlight(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const HighlightedMarkdown = ({ content, query }) => {
    return (
      <div className="space-y-4 text-[14.5px] leading-relaxed text-zinc-300">
        {renderMessageMarkdown(content, false, query)}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full bg-transparent relative overflow-hidden">
      {/* Left Pane: Chat (Full width or 50%) */}
      <div className={`flex flex-col h-full bg-transparent relative overflow-hidden transition-all duration-500 ease-out ${activeDoc ? 'w-1/2 border-r border-white/[0.06]' : 'w-full'}`}>
        {/* FLOATING SOLID OPAQUE STATUS & MEMBERS POPUP WIDGET */}
        <div className="absolute top-4 right-6 z-30 select-none">
          {/* Main small pill widget */}
          <button
            onClick={() => {
              setShowMembersPopup(prev => !prev)
              setShowFileSelector(false)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all opaque-widget-btn"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 neon-dot-blue animate-pulse" />
            <span className="tracking-wide">
              {sortedChatMembers.filter(m => m.status === 'active' || m.status === 'warning').length} Agents Online
            </span>
            {sessionDocs.length > 0 && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  📄 {sessionDocs.length} Docs
                </span>
              </>
            )}
            <ChevronDownIcon className="w-3.5 h-3.5 opacity-60 transition-transform duration-300" />
          </button>

          {/* Members Popup Dropdown - GLASSMORPHISM */}
          {showMembersPopup && (
            <div className="absolute right-0 mt-2.5 w-72 rounded-2xl members-popup-glass p-4 z-40 text-left subtab-entrance flex flex-col gap-4">
              
              {/* Member status section */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-2">
                  Chat Members
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {sortedChatMembers.map(member => {
                    const isWarning = member.status === 'warning'
                    const isOffline = member.status === 'offline'
                    const isActive = member.status === 'active'
                    
                    return (
                      <div 
                        key={member.role}
                        className={`flex items-center gap-2.5 transition-opacity duration-300 ${isOffline ? 'opacity-40 hover:opacity-60' : 'opacity-100'}`}
                      >
                        <div className="relative">
                          <div className={`w-7 h-7 rounded-lg bg-zinc-900 border border-white/[0.06] flex items-center justify-center text-[10px] font-bold font-mono text-zinc-400`}>
                            {member.role.substring(0, 3).toUpperCase()}
                          </div>
                          {/* Green check badge */}
                          {isActive && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center text-[8px] text-white">
                              ✓
                            </span>
                          )}
                          {/* Yellow warning exclamation mark */}
                          {isWarning && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-zinc-950 flex items-center justify-center text-[8px] font-extrabold text-black">
                              !
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-zinc-200 truncate flex items-center gap-1.5 flex-wrap">
                            <span>{member.displayName}</span>
                            {isWarning && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-mono px-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Issue</span>
                                {workflows.find(w => w.role === member.role && w.status === 'failed') && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const w = workflows.find(w => w.role === member.role && w.status === 'failed');
                                      if (w) {
                                        await retryWorkflowStep(w.id);
                                      }
                                    }}
                                    className="text-[9px] font-mono font-semibold px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/35 hover:text-white transition-all cursor-pointer"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono capitalize truncate max-w-[180px]">
                            {isOffline ? 'offline / inactive' : 
                             member.is_running ? `working: ${member.current_task || 'task'}` : 
                             isWarning ? 'running (warning)' : 'online'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Shared documents section */}
              <div className="border-t border-white/[0.06] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                    Session Documents
                  </div>
                  <button 
                    onClick={() => setShowFileSelector(prev => !prev)}
                    className="text-[10px] font-mono font-bold text-zinc-400 hover:text-white flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06]"
                  >
                    + Add Doc
                  </button>
                </div>

                {/* File Selector Dropdown inside the popup */}
                {showFileSelector && (
                  <div className="my-2 p-2 bg-zinc-950 border border-white/[0.06] rounded-xl max-h-36 overflow-y-auto space-y-1">
                    <div className="text-[9px] text-zinc-500 font-semibold mb-1">Select from company files:</div>
                    {files.filter(f => !sessionDocs.includes(f.path)).length === 0 && projectFiles.filter(f => !sessionDocs.includes(f.path)).length === 0 ? (
                      <div className="text-[10px] text-zinc-600">No other files available</div>
                    ) : (
                      <>
                        {/* Company Files */}
                        {files.filter(f => !sessionDocs.includes(f.path)).map(f => (
                          <button
                            key={f.path}
                            onClick={() => {
                              setManuallyAttachedFiles(prev => [...prev, f.path])
                              setShowFileSelector(false)
                            }}
                            className="w-full text-left truncate text-[11px] text-zinc-400 hover:text-white py-1 px-1.5 rounded hover:bg-white/[0.04] block"
                          >
                            📁 {f.path}
                          </button>
                        ))}
                        {/* Project Files */}
                        {projectFiles.filter(f => !sessionDocs.includes(f.path)).map(f => (
                          <button
                            key={f.path}
                            onClick={() => {
                              setManuallyAttachedFiles(prev => [...prev, f.path])
                              setShowFileSelector(false)
                            }}
                            className="w-full text-left truncate text-[11px] text-zinc-400 hover:text-white py-1 px-1.5 rounded hover:bg-white/[0.04] block"
                          >
                            📂 {f.path}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {sessionDocs.length === 0 ? (
                    <div className="text-[11px] text-zinc-600 italic py-2 text-center">No documents shared yet</div>
                  ) : (
                    sessionDocs.map(docName => {
                      const isProject = docName.includes('projects/') || projectFiles.some(f => f.path === docName)
                      return (
                        <button
                          key={docName}
                          onClick={() => {
                            loadSessionDocContent(docName)
                            setShowMembersPopup(false)
                          }}
                          className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg border border-white/[0.02] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.08] text-zinc-300 hover:text-white transition-all text-xs"
                        >
                          <FileTextIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate font-mono font-medium flex-1">{docName.split('/').pop()}</span>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase bg-white/[0.04] px-1 rounded shrink-0">
                            {isProject ? 'Project' : 'Corp'}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages scroll area */}
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
                  <div className={`px-5 pt-3 pb-3 rounded-[22px] leading-relaxed chat-message-text border transition-all relative group select-text ${
                    isUser
                      ? 'bg-white/[0.08] backdrop-blur-md border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-zinc-100 hover:border-white/10 hover:bg-white/[0.1] mt-[16px]'
                      : 'bg-zinc-950/[0.45] backdrop-blur-md border border-white/[0.03] shadow-[0_10px_32px_rgba(0,0,0,0.4)] text-zinc-300 hover:border-white/[0.06] hover:bg-zinc-950/[0.55] mt-[16px]'
                  }`}>
                    {!isUser && (!msg.message || msg.message.trim() === '') ? (
                      <div className="flex items-center gap-1.5 py-2 px-1 select-none">
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce-1" />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce-2" />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce-3" />
                      </div>
                    ) : (
                      <>
                        {renderMessageMarkdown(msg.message, isUser)}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-400 animate-pulse align-middle" />
                        )}
                        {/* Render attachments */}
                        {(() => {
                          if (!msg.attachments) return null;
                          try {
                            const atts = typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments;
                            if (!atts || atts.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-2.5 mt-3 select-none">
                                {atts.map((url, uIdx) => (
                                  <a
                                    key={uIdx}
                                    href={`http://localhost:8000${url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block max-w-[240px] border border-white/[0.08] hover:border-white/20 rounded-xl overflow-hidden bg-zinc-950/40 hover:bg-zinc-950/70 transition-all shadow-inner"
                                  >
                                    <img
                                      src={`http://localhost:8000${url}`}
                                      alt="Attachment"
                                      className="max-h-[160px] object-contain w-auto h-auto transition-transform duration-300 hover:scale-105"
                                    />
                                  </a>
                                ))}
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </>
                    )}

                    {!isUser && msg.message && msg.message.includes('propose_files') && (
                      <div className="mt-4 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs text-zinc-300 flex flex-col gap-2 shadow-inner">
                        <span className="font-semibold text-content-highlight flex items-center gap-1.5">Proposed Specifications</span>
                        <span>{renderPlainAndLinks("Drafts for `AIM.md`, `OPERATIONS.md`, and `FINANCE.md` created in Inbox.", false)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          {isSending && currentAction && (
            <div className="flex items-center gap-4 my-6 w-full max-w-2xl mx-auto opacity-80 select-none animate-pulse">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <AnimatedActionText action={currentAction} />
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-background-base via-background-base/95 to-transparent pointer-events-none">
          <div className="lava-input-wrapper max-w-3xl w-[92%] mx-auto pointer-events-auto rounded-2xl relative">
            {mentionState.active && (
              <div className="absolute left-4 right-4 bottom-[112px] bg-zinc-950/95 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-1.5 max-h-56 overflow-y-auto z-20">
                {mentionState.suggestions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-content-muted">No matching items</div>
                ) : (
                  mentionState.suggestions.map((item, index) => {
                    const IconComponent = item.type === 'tag'
                      ? UsersIcon
                      : item.type === 'agent'
                        ? SparklesIcon
                        : FileTextIcon;
                    
                    const iconColorClass = item.type === 'tag'
                      ? 'text-sky-400'
                      : item.type === 'agent'
                        ? 'text-indigo-400'
                        : 'text-zinc-400';

                    return (
                      <button
                        key={`${item.type || 'doc'}-${item.value || item.label}`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectMention(item)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs ${
                          index === mentionIndex
                            ? 'bg-border-muted text-content-highlight'
                            : 'text-content-muted hover:bg-border-muted/30 hover:text-content-normal'
                        }`}
                      >
                        <IconComponent className={`w-3.5 h-3.5 shrink-0 ${iconColorClass}`} />
                        <span className="truncate font-medium">{item.label}</span>
                        {item.value && item.value !== item.label && (
                          <span className="text-[10px] font-mono text-zinc-500">(@{item.value})</span>
                        )}
                        <span className="ml-auto text-[10px] opacity-70 font-medium px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05]">
                          {item.source}
                        </span>
                      </button>
                    )
                  })
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
              {/* Attachment Previews */}
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 px-2 border-b border-white/[0.04] pb-2.5 select-none">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl border border-white/[0.08] overflow-hidden bg-zinc-950 flex items-center justify-center group shadow-md">
                      <img src={img.preview} alt="upload preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeSelectedImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2">
                {/* Paperclip Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all shrink-0 mt-0.5"
                  title="Attach Image"
                >
                  <PaperclipIcon className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

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

      {/* Right Pane: Split-pane Document Viewer (splits the screen in half) */}
      {activeDoc && (
        <div className="w-1/2 h-full bg-zinc-950/[0.94] backdrop-blur-lg flex flex-col split-pane-appear z-20 border-l border-white/[0.06]">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-zinc-900/40 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-inner">
                <FileTextIcon className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Shared Document</span>
                <h4 className="text-sm font-bold text-white tracking-tight truncate font-mono mt-0.5">{activeDoc}</h4>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Copy all content button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeDocContent)
                  alert("Đã sao chép toàn bộ nội dung tài liệu!")
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all text-xs font-semibold"
                title="Copy entire document"
              >
                Copy Content
              </button>
              
              {/* Close Button */}
              <button
                onClick={() => {
                  setActiveDoc(null)
                  setActiveDocContent('')
                }}
                className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 hover:text-rose-400 transition-all flex items-center justify-center"
                title="Close Viewer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Inside Doc Bar */}
          <div className="px-6 py-2 border-b border-white/[0.04] bg-zinc-900/20 flex items-center gap-3">
            <SearchIcon className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              placeholder="Search text in document..."
              className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 outline-none"
            />
            {docSearchQuery && (
              <button
                onClick={() => setDocSearchQuery('')}
                className="text-[10px] font-mono text-zinc-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Doc Content Area */}
          <div className="flex-1 overflow-y-auto p-8 font-sans scrollbar-thin select-text">
            {isLoadingDoc ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-70 select-none">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-2" />
                <span className="text-xs text-zinc-400 font-mono">Loading document content...</span>
              </div>
            ) : (
              <div className="space-y-4 text-[14.5px] leading-relaxed text-zinc-300">
                {activeDoc.endsWith('.csv') ? (
                  <CsvTable content={activeDocContent} query={docSearchQuery} />
                ) : (
                  <HighlightedMarkdown content={activeDocContent} query={docSearchQuery} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
  
  // Find matching inboxItem (supports raw role and compound role like parent_role:role)
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'create_employee' && 
    (item.file_path === role || (item.file_path && item.file_path.endsWith(':' + role)))
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

function CommandProposalCard({ data }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox } = useWorkspaceStore();
  const command = data.command || '';
  const explanation = data.explanation || 'Đề xuất chạy lệnh terminal.';
  
  // Find matching inboxItem
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'run_command' && 
    (item.proposed_content === command || item.proposed_content.includes(command))
  );
  
  const [actionStatus, setActionStatus] = useState(null); // 'approving', 'rejecting', 'done'
  
  const handleCardApprove = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('approving');
    const ok = await approveItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
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
  
  const risk = pendingItem ? pendingItem.risk_level : 'MEDIUM';
  const glowClass = risk === 'HIGH' ? 'glow-card-high' : risk === 'MEDIUM' ? 'glow-card-medium' : 'glow-card-low';

  return (
    <div className={`my-5 border border-zinc-500/20 hover:border-zinc-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(255,255,255,0.03)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left premium-card ${glowClass}`}>
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-center shadow-inner">
            <TerminalIcon className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Proposed Command</span>
            <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">Execute Terminal Command</h4>
          </div>
        </div>
        
        <div>
          {pendingItem ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Pending Auth</span>
          ) : (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Processed</span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="space-y-3.5 text-xs text-zinc-300">
        <div>
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Command String</span>
          <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-zinc-200 select-text font-mono bg-black/40 border border-white/[0.04] rounded-lg">
            <code>{command}</code>
          </pre>
        </div>

        <div>
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Rationale</span>
          <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{explanation}</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-white/[0.04] pt-3.5 mt-1.5 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 font-mono">
          Risk level: {risk}
        </div>

        <div className="flex items-center gap-2">
          {actionStatus === 'approving' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Running Command...
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
                <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Run Command</span>
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-500 font-bold flex items-center gap-1.5">
              <CheckCircle2Icon className="w-4 h-4 text-zinc-600" />
              <span>Executed / Handled</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FileProposalCard({ data }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox } = useWorkspaceStore();
  const filesList = data.files || [];
  const explanation = data.explanation || 'Đề xuất tạo hoặc ghi đè tệp tin.';

  return (
    <div className="space-y-4">
      {filesList.map((file, idx) => {
        // Find matching pending inboxItem
        const pendingItem = inboxItems.find(item => 
          item.action_type === 'write_file' && 
          (item.file_path === file.name || (item.file_path && item.file_path.endsWith(file.name)))
        );

        // State for this individual file card action
        const [actionStatus, setActionStatus] = useState(null); // 'approving', 'rejecting', 'done'

        const handleCardApprove = async (e) => {
          e.stopPropagation();
          if (!pendingItem) return;
          setActionStatus('approving');
          const ok = await approveItem(pendingItem.id);
          if (ok) {
            setActionStatus('done');
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

        const risk = pendingItem ? pendingItem.risk_level : 'LOW';
        const glowClass = risk === 'HIGH' ? 'glow-card-high' : risk === 'MEDIUM' ? 'glow-card-medium' : 'glow-card-low';

        return (
          <div key={idx} className={`my-4 border border-zinc-500/20 hover:border-zinc-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(255,255,255,0.03)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left premium-card ${glowClass}`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-inner">
                  <FileTextIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono">Proposed File Specification</span>
                  <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{file.name}</h4>
                </div>
              </div>
              
              <div>
                {pendingItem ? (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Pending Auth</span>
                ) : (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Approved / Written</span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3.5 text-xs text-zinc-300">
              <div>
                <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Rationale</span>
                <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{explanation}</p>
              </div>

              <div>
                <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Proposed Code Content</span>
                <pre className="p-3 overflow-x-auto text-[11px] max-h-36 overflow-y-auto leading-relaxed text-zinc-200 select-text font-mono bg-black/40 border border-white/[0.04] rounded-lg">
                  <code>{file.content || ''}</code>
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.04] pt-3.5 mt-1.5 flex items-center justify-between">
              <div className="text-[10px] text-zinc-500 font-mono">
                Risk level: {risk}
              </div>

              <div className="flex items-center gap-2">
                {actionStatus === 'approving' ? (
                  <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Writing File...
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
                      <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Write File</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2Icon className="w-4 h-4 text-emerald-500 animate-bounce" />
                    <span>File Written</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamProposalCard({ content }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox } = useWorkspaceStore();
  
  // Parse name, leader, members, explanation
  const titleMatch = content.match(/#\s*Thành\s+lập\s+Nhóm:\s*(.+)/i);
  const teamName = titleMatch ? titleMatch[1].trim() : 'Nhóm mới';
  
  const leaderMatch = content.match(/\*\*Trưởng\s+nhóm\s*\(Leader\)\*\*\s*:\s*(.+)/i);
  const leader = leaderMatch ? leaderMatch[1].trim() : '';

  const membersMatch = content.match(/\*\*Thành\s+viên\*\*\s*:\s*(.+)/i);
  const membersList = membersMatch ? membersMatch[1].split(',').map(m => m.trim()) : [];

  const reasonMatch = content.match(/\*\*Lý\s+do\s+thành\s+lập\*\*\s*:\s*(.+)/i);
  const explanation = reasonMatch ? reasonMatch[1].trim() : 'Thành lập nhóm làm việc.';

  // Find matching pending inboxItem
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'create_team' && 
    (item.file_path && item.file_path.toLowerCase() === teamName.toLowerCase())
  );
  
  const [actionStatus, setActionStatus] = useState(null); // 'approving', 'rejecting', 'done'
  
  const handleCardApprove = async (e) => {
    e.stopPropagation();
    if (!pendingItem) return;
    setActionStatus('approving');
    const ok = await approveItem(pendingItem.id);
    if (ok) {
      setActionStatus('done');
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

  const risk = pendingItem ? pendingItem.risk_level : 'MEDIUM';
  const glowClass = risk === 'HIGH' ? 'glow-card-high' : risk === 'MEDIUM' ? 'glow-card-medium' : 'glow-card-low';

  return (
    <div className={`my-5 border border-sky-500/20 hover:border-sky-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(14,165,233,0.1)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left premium-card ${glowClass}`}>
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shadow-inner">
            <UsersIcon className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest font-mono">Proposed Team</span>
            <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{teamName}</h4>
          </div>
        </div>
        
        <div>
          {pendingItem ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider animate-pulse">Needs Auth</span>
          ) : (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Processed</span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="space-y-3.5 text-xs text-zinc-300">
        <div>
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Establishment Rationale</span>
          <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{explanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Leader</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-[11px] font-bold text-white font-mono shadow-sm">
              <UserIcon className="w-3.5 h-3.5 text-sky-400" />
              {leader ? leader.toUpperCase() : 'NONE'}
            </span>
          </div>
          
          {membersList.length > 0 && (
            <div>
              <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">Team Members</span>
              <div className="flex flex-wrap gap-1.5">
                {membersList.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50 text-[10px] font-bold font-mono">
                    {m.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-white/[0.04] pt-3.5 mt-1.5 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 font-mono">
          Cost Estimate: $0.00
        </div>

        <div className="flex items-center gap-2">
          {actionStatus === 'approving' ? (
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Creating Team...
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
                <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create Team</span>
              </button>
            </>
          ) : (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2Icon className="w-4 h-4 text-emerald-500 animate-bounce" />
              <span>Team Created</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SwarmJsonProposalCard({ data }) {
  const { inboxItems, approveItem, rejectItem, fetchInbox, swarms, fetchSwarms } = useWorkspaceStore();
  
  const isMeeting = data.action === 'create_meeting';
  const name = isMeeting ? (data.meeting_name || 'Cuộc họp thảo luận') : (data.swarm_name || 'Swarm Job');
  const explanation = data.explanation || (isMeeting ? `Yêu cầu họp: ${data.agenda || ''}` : 'Triển khai Swarm tự động.');
  const execMode = isMeeting ? 'collaborative' : (data.execution_mode || 'sequential');

  const rawMembers = data.members || [];
  const members = isMeeting 
    ? rawMembers.map(m_role => ({ role: m_role, task: `Thảo luận cuộc họp: ${data.agenda || ''}` }))
    : rawMembers;

  // Find matching pending inboxItem
  const pendingItem = inboxItems.find(item => 
    item.action_type === 'deploy_swarm' && 
    (item.proposed_content.includes(name) || item.rationale.includes(name) || item.rationale.includes(explanation))
  );

  // Check active swarms
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

  const risk = pendingItem ? pendingItem.risk_level : 'MEDIUM';
  const glowClass = risk === 'HIGH' ? 'glow-card-high' : risk === 'MEDIUM' ? 'glow-card-medium' : 'glow-card-low';

  return (
    <div className={`my-5 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl bg-zinc-950/70 backdrop-blur-md overflow-hidden shadow-[0_12px_40px_rgba(245,158,11,0.1)] transition-all p-5 flex flex-col gap-4 font-sans select-none max-w-full text-left premium-card ${glowClass}`}>
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <UsersIcon className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
              {isMeeting ? 'Proposed Meeting' : 'Proposed Swarm Run'}
            </span>
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
          <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-1">
            {isMeeting ? 'Meeting Agenda' : 'Execution Plan'}
          </span>
          <p className="leading-relaxed bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-zinc-300 shadow-inner">{explanation}</p>
        </div>

        {members.length > 0 && (
          <div>
            <span className="block text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider mb-2">Swarm Roles & Tasks</span>
            <div className="space-y-2">
              {members.map((member, i) => (
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
              {isMeeting ? 'Kicking off Meeting...' : 'Launching Swarm...'}
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
                <span>{isMeeting ? 'Launch Meeting' : 'Launch Swarm'}</span>
              </button>
            </>
          ) : activeSwarm ? (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2Icon className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>{isMeeting ? 'Meeting Active' : 'Swarm Executing'}</span>
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
