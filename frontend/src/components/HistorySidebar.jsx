import React from 'react'
import { useWorkspaceStore, getTabRole } from '../store/workspaceStore'
import { PlusIcon, MessageSquareIcon, ClockIcon, XIcon } from 'lucide-react'

export default function HistorySidebar() {
  const {
    activeHistoryTab,
    sessionsList,
    activeSessionId,
    selectSession,
    createNewSession,
    toggleHistorySidebar,
    activePrivateAgent
  } = useWorkspaceStore()

  // Format title based on tab name
  const getTitle = () => {
    if (!activeHistoryTab) return 'History'
    if (activeHistoryTab === 'secretary_chat') {
      return `${activePrivateAgent.charAt(0).toUpperCase() + activePrivateAgent.slice(1)} Chats`
    }
    
    const parts = activeHistoryTab.split('_')
    const dept = parts[1] || ''
    const type = activeHistoryTab.includes('_chat_group') ? 'Group' : 'Direct'
    return `${dept.charAt(0).toUpperCase() + dept.slice(1)} ${type}`
  }

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch (e) {
      return ''
    }
  }

  return (
    <div className="w-[220px] h-full bg-zinc-950/90 border-r border-white/[0.04] flex flex-col select-none animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider truncate">{getTitle()}</h2>
          <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Select a conversation</p>
        </div>
        <button
          onClick={() => toggleHistorySidebar()}
          className="p-1 rounded hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Close History"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New Conversation Button */}
      <div className="p-3">
        <button
          onClick={() => createNewSession()}
          className="w-full h-9 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg flex items-center justify-center gap-2 text-xs font-semibold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <PlusIcon className="w-3.5 h-3.5 text-zinc-300" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {sessionsList.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-zinc-600 font-sans">
            <MessageSquareIcon className="w-5 h-5 mx-auto mb-2 opacity-30" />
            <span>No conversations yet</span>
          </div>
        ) : (
          sessionsList.map((session, index) => {
            const isSelected = activeSessionId === session.session_id
            const displayTitle = session.first_message && session.first_message.trim()
              ? (session.first_message.length > 36 ? session.first_message.substring(0, 36) + '...' : session.first_message)
              : `Conversation #${sessionsList.length - index}`

            return (
              <button
                key={session.session_id}
                onClick={() => selectSession(session.session_id)}
                className={`w-full p-2.5 rounded-lg flex flex-col gap-1 text-left transition-all group ${
                  isSelected
                    ? 'bg-white/[0.08] text-white border-l-2 border-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <div className="text-[11px] font-medium leading-normal line-clamp-2 break-words">
                  {displayTitle}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-mono mt-0.5">
                  <ClockIcon className="w-2.5 h-2.5 opacity-60" />
                  <span>{formatDate(session.timestamp)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
