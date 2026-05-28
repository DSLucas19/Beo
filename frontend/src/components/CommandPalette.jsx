import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  SearchIcon,
  InboxIcon,
  SparklesIcon,
  BookOpenIcon,
  SettingsIcon,
  ActivityIcon,
  FileTextIcon,
  Volume2Icon,
  PresentationIcon,
  TableIcon,
  GlobeIcon,
  CpuIcon
} from 'lucide-react'

export default function CommandPalette() {
  const { activeTab, selectTab, onboardingCompleted } = useWorkspaceStore()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Define commands
  const commands = useMemo(() => {
    const list = [
      {
        id: 'nav_inbox',
        category: 'Navigation',
        name: 'Go to Inbox',
        desc: 'Review pending task approvals',
        icon: InboxIcon,
        action: () => selectTab('inbox')
      },
      {
        id: 'nav_secretary',
        category: 'Navigation',
        name: 'Go to Secretary Chat',
        desc: 'Chat with your assistant',
        icon: SparklesIcon,
        action: () => selectTab('secretary_chat')
      }
    ]

    if (onboardingCompleted) {
      list.push(
        {
          id: 'nav_docs',
          category: 'Navigation',
          name: 'Go to Docs & Company Files',
          desc: 'Browse workspace reports, plans, and files',
          icon: BookOpenIcon,
          action: () => selectTab('company_files')
        },
        {
          id: 'nav_swarms',
          category: 'Navigation',
          name: 'Go to Swarms Console',
          desc: 'Deploy and monitor swarm tasks',
          icon: ActivityIcon,
          action: () => selectTab('swarms')
        }
      )
    }

    list.push({
      id: 'nav_settings',
      category: 'Navigation',
      name: 'Go to Settings',
      desc: 'Configure API keys and MCP servers',
      icon: SettingsIcon,
      action: () => selectTab('settings')
    })

    // Actions
    list.push(
      {
        id: 'cmd_doc',
        category: 'Slash Commands',
        name: '/doc [name]',
        desc: 'Draft a text or markdown document',
        icon: FileTextIcon,
        action: () => triggerSlashCommand('/doc ')
      },
      {
        id: 'cmd_preach',
        category: 'Slash Commands',
        name: '/preach [concept]',
        desc: 'Create a peach or preaching pitch document',
        icon: Volume2Icon,
        action: () => triggerSlashCommand('/preach ')
      },
      {
        id: 'cmd_slide',
        category: 'Slash Commands',
        name: '/slide [topic]',
        desc: 'Generate a presentation deck (.slide.md)',
        icon: PresentationIcon,
        action: () => triggerSlashCommand('/slide ')
      },
      {
        id: 'cmd_sheet',
        category: 'Slash Commands',
        name: '/sheet [filename]',
        desc: 'Compile a spreadsheet (.csv)',
        icon: TableIcon,
        action: () => triggerSlashCommand('/sheet ')
      },
      {
        id: 'cmd_research',
        category: 'Slash Commands',
        name: '/research [topic]',
        desc: 'Deploy research agents to compile a detailed report',
        icon: GlobeIcon,
        action: () => triggerSlashCommand('/research ')
      },
      {
        id: 'cmd_swarm',
        category: 'Slash Commands',
        name: '/swarm [task]',
        desc: 'Deploy a collaborative swarm of agents',
        icon: CpuIcon,
        action: () => triggerSlashCommand('/swarm ')
      }
    )

    return list;
  }, [onboardingCompleted, selectTab])

  // Helper to switch to chat and enter slash command
  const triggerSlashCommand = (cmdText) => {
    // If not in a chat page, default to secretary_chat
    const currentTab = useWorkspaceStore.getState().activeTab
    const isChatTab = currentTab === 'secretary_chat' || currentTab.startsWith('dep_')
    
    if (!isChatTab) {
      selectTab('secretary_chat')
    }

    // Try to find the chat input textarea on the page and fill it
    setTimeout(() => {
      const textarea = document.querySelector('textarea')
      if (textarea) {
        textarea.value = cmdText
        // Trigger React's onChange
        const event = new Event('input', { bubbles: true })
        textarea.dispatchEvent(event)
        textarea.focus()
      }
    }, 100)
  }

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const cleanQuery = query.toLowerCase()
    return commands.filter(
      (c) =>
        c.name.toLowerCase().includes(cleanQuery) ||
        c.desc.toLowerCase().includes(cleanQuery) ||
        c.category.toLowerCase().includes(cleanQuery)
    )
  }, [query, commands])

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Handle keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      scrollActiveIntoView()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      scrollActiveIntoView()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action()
        setIsOpen(false)
      }
    }
  }

  const scrollActiveIntoView = () => {
    setTimeout(() => {
      const activeEl = listRef.current?.querySelector('.bg-white\\/\\[0\\.07\\]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }, 10)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[15vh]">
      <div 
        className="w-full max-w-[560px] bg-zinc-950/90 border border-white/[0.08] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col pane-fade-in"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05]">
          <SearchIcon className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.04] text-[9px] font-mono text-zinc-400 select-none">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div 
          ref={listRef}
          className="flex-1 max-h-[320px] overflow-y-auto p-2 space-y-1"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 font-sans">
              No results found for "{query}"
            </div>
          ) : (
            (() => {
              let lastCategory = ''
              return filteredCommands.map((cmd, index) => {
                const isSelected = index === selectedIndex
                const showCategory = cmd.category !== lastCategory
                lastCategory = cmd.category
                const Icon = cmd.icon

                return (
                  <React.Fragment key={cmd.id}>
                    {showCategory && (
                      <div className="px-3 pt-3 pb-1 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider select-none">
                        {cmd.category}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        cmd.action()
                        setIsOpen(false)
                      }}
                      className={`w-full h-11 flex items-center gap-3 px-3 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-white/[0.07] text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate font-sans">{cmd.name}</div>
                        <div className="text-[10px] text-zinc-500 truncate leading-tight font-sans mt-0.5">{cmd.desc}</div>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-mono text-zinc-400 bg-white/[0.06] border border-white/[0.04] px-1.5 py-0.5 rounded select-none">
                          Enter
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                )
              })
            })()
          )}
        </div>
      </div>
    </div>
  )
}
