import React, { useState, useMemo } from 'react'
import { useWorkspaceStore, getTabRole } from '../store/workspaceStore'
import { 
  PlayIcon, 
  RotateCcwIcon, 
  CheckCircle2Icon, 
  XCircleIcon, 
  AlertCircleIcon,
  CalendarIcon,
  LayoutGridIcon,
  ListIcon,
  ClockIcon,
  LayersIcon
} from 'lucide-react'

export default function DepartmentViewPane() {
  const {
    activeTab,
    workflows,
    runWorkflowStep,
    retryWorkflowStep
  } = useWorkspaceStore()

  // Parse department role & mode
  // e.g. dep_planning_view_board
  const parts = activeTab.split('_view_')
  const deptPart = parts[0] || ''
  const mode = parts[1] || 'board' // 'board' | 'list' | 'calendar' | 'timeline'
  const deptName = deptPart.replace('dep_', '').replace(/_/g, ' ')
  const role = getTabRole(deptPart)

  // Filter workflows belonging to this department's role
  const deptWorkflows = useMemo(() => {
    return workflows.filter(w => (w.role || '').toLowerCase() === role.toLowerCase())
  }, [workflows, role])

  // Group by status for Board View
  const boardColumns = useMemo(() => {
    const cols = {
      pending: [],
      running: [],
      completed: [],
      failed: []
    }
    deptWorkflows.forEach(w => {
      const status = (w.status || 'pending').toLowerCase()
      if (cols[status]) {
        cols[status].push(w)
      } else {
        cols.pending.push(w)
      }
    })
    return cols
  }, [deptWorkflows])

  const renderStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase()
    if (s === 'completed') return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Completed</span>
    if (s === 'failed') return <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold uppercase tracking-wider">Failed</span>
    if (s === 'running') return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold uppercase tracking-wider animate-pulse">Running</span>
    return <span className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Pending</span>
  }

  // Render sub-views based on mode
  const renderContent = () => {
    if (deptWorkflows.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 max-w-md mx-auto h-[60vh]">
          <LayersIcon className="w-10 h-10 mb-4 opacity-30" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Workflows Configured</h3>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            No workflows are active for the {deptName} department yet. Create SOP definitions or start a task in the chat workspace to automatically generate workflows.
          </p>
        </div>
      )
    }

    if (mode === 'board') {
      return (
        <div className="grid grid-cols-4 gap-4 h-full overflow-hidden p-6 text-left">
          {Object.keys(boardColumns).map(colKey => {
            const list = boardColumns[colKey]
            const colTitle = colKey.toUpperCase()
            return (
              <div key={colKey} className="bg-zinc-950/20 border border-white/[0.03] rounded-2xl p-4 flex flex-col h-full max-h-[70vh]">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">{colTitle}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.05] text-zinc-300 font-mono">{list.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {list.map(w => (
                    <div key={w.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">Project: {w.project_name}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-200 leading-snug">{w.step_name}</h4>
                      
                      {w.error_log && (
                        <p className="text-[9px] text-rose-400 font-mono bg-rose-950/20 p-2 rounded-lg border border-rose-500/10 leading-normal max-h-16 overflow-y-auto">
                          {w.error_log}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.03] mt-1">
                        {renderStatusBadge(w.status)}
                        
                        {(w.status === 'pending' || w.status === 'failed') && (
                          <button
                            onClick={() => w.status === 'failed' ? retryWorkflowStep(w.id) : runWorkflowStep(w.id)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
                            title={w.status === 'failed' ? 'Retry Step' : 'Run Step'}
                          >
                            {w.status === 'failed' ? <RotateCcwIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (mode === 'list') {
      return (
        <div className="p-6 overflow-y-auto max-w-4xl mx-auto h-[75vh] text-left">
          <div className="border border-white/[0.04] rounded-2xl overflow-hidden bg-zinc-950/20">
            <table className="min-w-full divide-y divide-white/[0.04]">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Step Name</th>
                  <th className="px-4 py-3 text-center text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] bg-transparent">
                {deptWorkflows.map(w => (
                  <tr key={w.id} className="hover:bg-white/[0.01]">
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400 truncate max-w-[120px]">{w.project_name}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-zinc-200">{w.step_name}</div>
                      {w.error_log && (
                        <div className="text-[9px] text-rose-400 font-mono mt-1 bg-rose-950/10 p-1.5 rounded border border-rose-500/5 max-w-md truncate">
                          {w.error_log}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{renderStatusBadge(w.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {(w.status === 'pending' || w.status === 'failed') ? (
                        <button
                          onClick={() => w.status === 'failed' ? retryWorkflowStep(w.id) : runWorkflowStep(w.id)}
                          className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-[10px] font-semibold transition-all inline-flex items-center gap-1"
                        >
                          {w.status === 'failed' ? <RotateCcwIcon className="w-2.5 h-2.5" /> : <PlayIcon className="w-2.5 h-2.5" />}
                          <span>{w.status === 'failed' ? 'Retry' : 'Run'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (mode === 'calendar') {
      // Simplistic task grid view mapped by dates/indices
      return (
        <div className="p-6 overflow-y-auto max-w-4xl mx-auto h-[75vh] text-left">
          <div className="grid grid-cols-7 gap-2">
            {/* Days headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-zinc-600 uppercase py-1 border-b border-white/[0.03]">{day}</div>
            ))}
            
            {/* 28 Simulated Grid Calendar Nodes */}
            {Array.from({ length: 28 }).map((_, idx) => {
              const dayNum = idx + 1
              // Map tasks sequentially
              const stepForDay = deptWorkflows[idx % deptWorkflows.length]
              const hasTask = idx < deptWorkflows.length

              return (
                <div key={idx} className="bg-zinc-950/20 border border-white/[0.03] rounded-xl p-2 min-h-[90px] flex flex-col gap-1 justify-between">
                  <div className="text-[10px] font-bold text-zinc-600 font-mono">{dayNum}</div>
                  
                  {hasTask && stepForDay && (
                    <div className="p-1 px-1.5 rounded bg-white/[0.03] border border-white/[0.05] text-[9px] truncate">
                      <div className="text-zinc-300 font-medium truncate">{stepForDay.step_name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`w-1 h-1 rounded-full ${
                          stepForDay.status === 'completed' ? 'bg-emerald-400' :
                          stepForDay.status === 'failed' ? 'bg-rose-400' :
                          stepForDay.status === 'running' ? 'bg-blue-400' : 'bg-zinc-600'
                        }`} />
                        <span className="text-zinc-500 font-mono uppercase tracking-wider">{stepForDay.status}</span>
                      </div>
                    </div>
                  )}
                  
                  {!hasTask && <div className="h-6" />}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (mode === 'timeline') {
      return (
        <div className="p-6 overflow-y-auto max-w-xl mx-auto h-[75vh] text-left">
          <div className="relative pl-6 border-l border-white/[0.06] space-y-6 ml-3">
            {deptWorkflows.map((w, index) => {
              const isCompleted = w.status === 'completed'
              const isFailed = w.status === 'failed'
              const isRunning = w.status === 'running'
              
              return (
                <div key={w.id} className="relative group">
                  {/* Timeline Dot */}
                  <span className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                    isFailed ? 'bg-rose-500/20 border-rose-500 text-rose-400' :
                    isRunning ? 'bg-blue-500/20 border-blue-500 text-blue-400 animate-pulse' :
                    'bg-zinc-950 border-zinc-700 text-zinc-500'
                  }`}>
                    {isCompleted ? <CheckCircle2Icon className="w-2.5 h-2.5" /> : 
                     isFailed ? <XCircleIcon className="w-2.5 h-2.5" /> :
                     isRunning ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> :
                     <span className="text-[8px] font-mono">{index + 1}</span>}
                  </span>

                  {/* Content Box */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] group-hover:border-white/[0.08] transition-all">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Project: {w.project_name}</span>
                        <h4 className="text-xs font-semibold text-zinc-200 mt-0.5">{w.step_name}</h4>
                      </div>
                      
                      {(w.status === 'pending' || isFailed) && (
                        <button
                          onClick={() => isFailed ? retryWorkflowStep(w.id) : runWorkflowStep(w.id)}
                          className="px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white text-[10px] font-semibold flex items-center gap-1"
                        >
                          {isFailed ? <RotateCcwIcon className="w-2.5 h-2.5" /> : <PlayIcon className="w-2.5 h-2.5" />}
                          <span>{isFailed ? 'Retry' : 'Run'}</span>
                        </button>
                      )}
                    </div>

                    {w.error_log && (
                      <p className="text-[9px] text-rose-400 font-mono mt-2 bg-rose-950/20 p-2 rounded-lg border border-rose-500/10 leading-normal">
                        {w.error_log}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden select-none font-sans file-content-fade-in text-content-normal">
      {/* Pane Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
