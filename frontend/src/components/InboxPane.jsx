import React, { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { 
  InboxIcon, 
  CheckIcon, 
  XIcon, 
  EditIcon, 
  CheckSquareIcon,
  ChevronDownIcon,
  ArrowLeftIcon
} from 'lucide-react'

export default function InboxPane() {
  const { inboxItems, fetchInbox, approveItem, rejectItem, editItemContent } = useWorkspaceStore()
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [islandOpen, setIslandOpen] = useState(false)

  useEffect(() => {
    fetchInbox()
  }, [])

  // Auto select first item if none is selected
  useEffect(() => {
    if (inboxItems.length > 0 && !selectedItemId) {
      // We don't auto-select anymore so that the card gallery is visible by default!
      // This is a premium UX. The user sees the gallery first.
    }
  }, [inboxItems])

  const selectedItem = inboxItems.find(item => item.id === selectedItemId)

  const handleSelect = (item) => {
    setSelectedItemId(item.id)
    setEditedContent(item.proposed_content)
    setEditMode(false)
  }

  const handleSaveEdit = async () => {
    const ok = await editItemContent(selectedItemId, editedContent)
    if (ok) {
      setEditMode(false)
    }
  }

  const handleApprove = async (id) => {
    const ok = await approveItem(id)
    if (ok) {
      setSelectedItemId(null)
    }
  }

  const handleReject = async (id) => {
    const ok = await rejectItem(id)
    if (ok) {
      setSelectedItemId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent animate-fade-in relative overflow-hidden">
      
      {/* FLOATING DYNAMIC ISLAND ON TOP OF THE APP */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center select-none font-sans">
        <div 
          onClick={() => setIslandOpen(!islandOpen)}
          className="flex items-center gap-2.5 px-4.5 py-2.5 rounded-full dynamic-island-glass cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all group border border-white/10"
        >
          <span className={`w-2 h-2 rounded-full ${inboxItems.length > 0 ? 'bg-white neon-dot-white' : 'bg-zinc-500'}`} />
          <span className="text-xs font-bold text-white tracking-wide">
            {selectedItem ? `Selected: ${selectedItem.file_path || 'System Command'}` : `Inbox Queue: ${inboxItems.length} pending`}
          </span>
          <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform duration-300 ${islandOpen ? 'rotate-180' : ''}`} />
        </div>
        
        {islandOpen && (
          <div className="absolute top-12 w-80 max-h-80 overflow-y-auto rounded-2xl dynamic-island-dropdown-glass p-2.5 space-y-1 shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/10 z-50 animate-pane-scale-fade-enter text-left">
            <div className="text-[10px] font-bold text-zinc-500 font-mono uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Quick Selector</span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400">{inboxItems.length} items</span>
            </div>
            <div className="h-[1px] bg-white/[0.04] my-1" />
            {inboxItems.length === 0 ? (
              <div className="text-xs text-zinc-500 px-2 py-4 text-center font-medium">Inbox is empty</div>
            ) : (
              <div className="space-y-1">
                {inboxItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleSelect(item);
                      setIslandOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-md text-xs transition-all flex items-center justify-between border ${
                      item.id === selectedItemId
                        ? 'bg-white/[0.08] border-white/15 text-white font-semibold shadow-inner'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate font-semibold text-white/90">{item.file_path || 'Shell Command'}</div>
                      <div className="text-[9px] text-zinc-500 truncate mt-0.5 font-mono">{item.action_type}</div>
                    </div>
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${
                      item.risk_level === 'HIGH' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : item.risk_level === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {item.risk_level}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {selectedItemId && (
              <button
                onClick={() => {
                  setSelectedItemId(null);
                  setIslandOpen(false);
                }}
                className="w-full text-center p-2 rounded-xl text-[11px] text-zinc-300 hover:text-white hover:bg-white/5 border border-white/[0.06] mt-2 font-bold transition-all"
              >
                ← Back to Card Gallery
              </button>
            )}
          </div>
        )}
      </div>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 overflow-hidden h-full">
        {selectedItem ? (
          // =================== DETAIL VIEW SCREEN (Widescreen) ===================
          <div key={selectedItem.id} className="h-full flex flex-col overflow-hidden detail-pane-fade-in pt-16">
            
            {/* Header Details */}
            <div className="p-6 border-b border-white/[0.04] bg-[#0c0d12]/80 backdrop-blur text-left">
              <div className="flex items-start justify-between gap-4 mb-4 select-none">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setSelectedItemId(null)}
                    className="mt-1 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 text-zinc-400 hover:text-white transition-all shadow-sm"
                    title="Back to queue gallery"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider font-bold bg-white/[0.04] px-2 py-0.5 rounded-sm">
                        Action: {selectedItem.action_type}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-mono font-bold tracking-wider ${
                        selectedItem.risk_level === 'HIGH' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : selectedItem.risk_level === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {selectedItem.risk_level} RISK
                      </span>
                    </div>
                    <h1 className="text-[17px] font-bold text-white font-display mt-1.5 tracking-tight truncate max-w-[480px]">
                      {selectedItem.file_path || 'System Command Execution'}
                    </h1>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReject(selectedItem.id)}
                    className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] hover:border-white/10 text-zinc-300 font-semibold text-xs transition-colors"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedItem.id)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-white hover:bg-zinc-200 text-black font-extrabold text-xs transition-transform hover:scale-[1.03] shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
                  >
                    <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Approve Proposal</span>
                  </button>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans border-t border-white/[0.04] pt-4 mt-2">
                <div>
                  <span className="block text-zinc-500 text-[9px] uppercase font-mono tracking-wider mb-0.5">Rationale / Purpose</span>
                  <span className="text-zinc-300 font-medium leading-relaxed">{selectedItem.rationale}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 text-[9px] uppercase font-mono tracking-wider mb-0.5">Estimated Cost</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm leading-relaxed">{selectedItem.cost_estimate || '$0.00'}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 text-[9px] uppercase font-mono tracking-wider mb-0.5">Impact Vector</span>
                  <span className="text-zinc-300 leading-relaxed">Local system write modifications</span>
                </div>
              </div>
            </div>

            {/* Code / Content Viewer */}
            <div className="flex-1 p-6 flex flex-col overflow-hidden text-left bg-[#08090c]">
              <div className="flex items-center justify-between mb-3 select-none">
                <span className="text-xs font-bold text-white/90 font-sans tracking-wide uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {editMode ? 'Edit Mode (Workspace)' : 'Proposed Document Content'}
                </span>
                
                {editMode ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveEdit}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-[11px] font-bold shadow-sm"
                    >
                      Save Changes
                    </button>
                    <button 
                      onClick={() => { setEditMode(false); setEditedContent(selectedItem.proposed_content); }}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-zinc-400 hover:text-white text-[11px] font-semibold transition-colors"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    <span>Edit Proposal</span>
                  </button>
                )}
              </div>
 
              {/* Editor Workspace */}
              <div className="flex-1 border border-white/[0.05] rounded-2xl overflow-hidden bg-[#0d0e12] shadow-2xl relative">
                {editMode ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-full p-6 bg-[#0d0e12] text-zinc-200 font-mono text-xs outline-none resize-none leading-relaxed"
                  />
                ) : (
                  <pre className="w-full h-full p-6 overflow-auto text-zinc-300 font-mono text-xs text-left whitespace-pre-wrap select-text leading-relaxed animate-fade-in bg-zinc-950/20">
                    {selectedItem.proposed_content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ) : (
          // =================== CARD GALLERY VIEW SCREEN ===================
          <div className="h-full overflow-y-auto p-8 pt-20 space-y-6 max-w-6xl mx-auto text-left select-none font-sans file-content-fade-in">


            {inboxItems.length === 0 ? (
              <div className="h-[45vh] flex flex-col items-center justify-center text-center p-8 bg-zinc-950/20 border border-white/[0.04] rounded-3xl select-none">
                <CheckSquareIcon className="w-12 h-12 text-zinc-600 mb-3 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">Queue is clear</h3>
                <p className="text-xs text-zinc-500 max-w-[280px] mt-1 leading-relaxed">
                  All proposed tasks have been approved. Your startup operations are running smoothly!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inboxItems.map(item => {
                  const riskLevel = item.risk_level || 'LOW'
                  const glowClass = riskLevel === 'HIGH' ? 'glow-card-high' : riskLevel === 'MEDIUM' ? 'glow-card-medium' : 'glow-card-low'
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`premium-card rounded-md p-4 flex flex-col justify-between cursor-pointer group ${glowClass}`}
                    >
                      <div>
                        {/* Card Header Info */}
                        <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded-sm bg-white/5 text-white/90 border border-white/10 font-bold uppercase tracking-wider">
                            {item.action_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider ${
                            riskLevel === 'HIGH' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' 
                              : riskLevel === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                          }`}>
                            {item.risk_level} RISK
                          </span>
                        </div>

                        {/* File Name / Title */}
                        <h3 className="text-sm font-bold text-white tracking-tight truncate mb-1.5 font-display group-hover:text-zinc-200 transition-colors" title={item.file_path}>
                          {item.file_path || 'System Command'}
                        </h3>

                        {/* Rationale */}
                        <p className="text-[11px] text-zinc-400 line-clamp-1 leading-relaxed mb-3">
                          {item.rationale}
                        </p>
                      </div>

                      {/* Card Actions & Pricing */}
                      <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Est. Cost</span>
                          <span className="text-xs font-mono font-bold text-white">{item.cost_estimate || '$0.00'}</span>
                        </div>

                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleReject(item.id)}
                            className="p-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all flex items-center justify-center"
                            title="Reject"
                          >
                            <XIcon className="w-3.5 h-3.5 text-white" />
                          </button>
                          <button 
                            onClick={() => handleSelect(item)}
                            className="p-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all flex items-center justify-center"
                            title="Edit"
                          >
                            <EditIcon className="w-3.5 h-3.5 text-white" />
                          </button>
                          <button 
                            onClick={() => handleApprove(item.id)}
                            className="p-2 rounded-md bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 text-white transition-all flex items-center justify-center"
                            title="Approve"
                          >
                            <CheckIcon className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                          </button>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
