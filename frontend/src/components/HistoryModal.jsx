import React, { useMemo, useState } from 'react'
import { ActivityIcon, ClockIcon, MessageSquareIcon, SearchIcon, XIcon } from 'lucide-react'
import { getRecipientLabel } from '../utils/chatInteractions'

export default function HistoryModal({ isOpen, targetTab, messages = [], workflows = [], onClose }) {
  const [query, setQuery] = useState('')

  const entries = useMemo(() => {
    if (!targetTab) return []

    if (targetTab.startsWith('proj_')) {
      const projectName = targetTab.replace('proj_', '')
      return workflows
        .filter(item => item.project_name === projectName)
        .map(item => ({
          id: `workflow-${item.id}`,
          type: 'activity',
          title: item.step_name,
          meta: `${item.role || 'agent'} / ${item.status || 'pending'}`,
          body: item.error_log || 'Workflow activity',
          timestamp: item.updated_at || item.created_at || ''
        }))
    }

    return messages.map((message, index) => ({
      id: `message-${index}`,
      type: 'message',
      title: message.sender === 'user' ? 'You' : getRecipientLabel(targetTab),
      meta: message.sender || 'agent',
      body: message.message,
      timestamp: message.timestamp || ''
    }))
  }, [messages, targetTab, workflows])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredEntries = entries.filter(entry => {
    const text = `${entry.title} ${entry.meta} ${entry.body}`.toLowerCase()
    return text.includes(normalizedQuery)
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-lg p-4">
      <div className="w-full max-w-3xl max-h-[78vh] bg-zinc-950/85 border border-white/[0.08] rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.95)] overflow-hidden pane-fade-in">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <ClockIcon className="w-4 h-4 text-content-highlight" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-content-highlight font-display truncate">
                {getRecipientLabel(targetTab)} History
              </h2>
              <p className="text-[11px] text-content-muted font-sans">
                Messages and recent activity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-content-muted hover:text-content-highlight"
            aria-label="Close history"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-white/[0.04]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-zinc-900/80 border border-white/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-sm text-content-normal placeholder:text-content-muted outline-none focus:border-white/20"
              placeholder="Search history..."
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-4 space-y-2">
          {filteredEntries.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-content-muted">
              <ClockIcon className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-xs">No history found.</p>
            </div>
          ) : (
            filteredEntries.map(entry => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-white/[0.1] transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  {entry.type === 'activity' ? (
                    <ActivityIcon className="w-3.5 h-3.5 text-content-muted" />
                  ) : (
                    <MessageSquareIcon className="w-3.5 h-3.5 text-content-muted" />
                  )}
                  <span className="text-xs font-semibold text-content-highlight">{entry.title}</span>
                  <span className="text-[10px] text-content-muted uppercase tracking-wider">{entry.meta}</span>
                </div>
                <p className="text-sm text-content-normal leading-relaxed whitespace-pre-wrap">
                  {entry.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
