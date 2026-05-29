import React, { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  TerminalIcon,
  CpuIcon,
  ActivityIcon,
  HeartIcon,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Flame,
  Layers,
  ChevronRight,
  Play
} from 'lucide-react'

export default function LogPane() {
  const {
    logs,
    agentHeartbeats,
    loadingLogs,
    fetchLogs,
    retryWorkflowStep,
    retrySwarmMember,
    workspaceId
  } = useWorkspaceStore()

  const [selectedLogId, setSelectedLogId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'terminal' | 'workflow' | 'swarm' | 'heartbeat'
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'completed' | 'failed' | 'running'
  
  // Auto-refresh logs every 5 seconds if there are running steps/members
  useEffect(() => {
    fetchLogs()
    const timer = setInterval(() => {
      fetchLogs()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    fetchLogs()
  }

  // Get selected log item
  const selectedLog = logs.find(l => l.id === selectedLogId)

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.command?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.log?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.meta?.role?.toLowerCase().includes(searchTerm.toLowerCase())
      
    const matchesType = filterType === 'all' || log.type === filterType
    
    let matchesStatus = true
    if (filterStatus !== 'all') {
      if (filterStatus === 'completed') {
        matchesStatus = log.status === 'completed' || log.status === 'approved' || log.status === 'success'
      } else if (filterStatus === 'failed') {
        matchesStatus = log.status === 'failed' || log.status === 'rejected' || log.status === 'critical'
      } else if (filterStatus === 'running') {
        matchesStatus = log.status === 'running' || log.status === 'pending' || log.status === 'waiting_approval' || log.status === 'recovering' || log.status === 'nudged'
      }
    }
    
    return matchesSearch && matchesType && matchesStatus
  })

  const getLogIcon = (type) => {
    switch (type) {
      case 'terminal':
        return <TerminalIcon className="w-4 h-4 text-emerald-400 shrink-0" />
      case 'workflow':
        return <CpuIcon className="w-4 h-4 text-indigo-400 shrink-0" />
      case 'swarm':
        return <ActivityIcon className="w-4 h-4 text-pink-400 shrink-0" />
      case 'heartbeat':
        return <HeartIcon className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
      default:
        return <TerminalIcon className="w-4 h-4 text-zinc-400 shrink-0" />
    }
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase()
    if (['completed', 'approved', 'success', 'healthy'].includes(s)) {
      return (
        <span className="text-[8px] font-mono border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
          success
        </span>
      )
    }
    if (['failed', 'rejected', 'critical', 'failed'].includes(s)) {
      return (
        <span className="text-[8px] font-mono border bg-rose-500/10 border-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
          failed
        </span>
      )
    }
    if (['running', 'recovering'].includes(s)) {
      return (
        <span className="text-[8px] font-mono border bg-sky-500/10 border-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
          {s}
        </span>
      )
    }
    if (['nudged', 'warning'].includes(s)) {
      return (
        <span className="text-[8px] font-mono border bg-amber-500/10 border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
          nudged
        </span>
      )
    }
    if (['escalated'].includes(s)) {
      return (
        <span className="text-[8px] font-mono border bg-orange-500/10 border-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
          escalated
        </span>
      )
    }
    return (
      <span className="text-[8px] font-mono border bg-zinc-800 border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
        {status}
      </span>
    )
  }

  const getAgentHeartbeatColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
      case 'nudged':
        return 'bg-amber-500 shadow-[0_0_10px_#f59e0b] animate-pulse'
      case 'escalated':
        return 'bg-orange-500 shadow-[0_0_10px_#f97316] animate-ping'
      case 'recovering':
        return 'bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-pulse'
      case 'failed':
        return 'bg-rose-600 shadow-[0_0_12px_#dc2626] animate-pulse'
      default:
        return 'bg-zinc-600'
    }
  }

  const handleRetry = async (log) => {
    if (log.type === 'workflow' && log.meta?.step_id) {
      await retryWorkflowStep(log.meta.step_id)
    } else if (log.type === 'swarm' && log.meta?.swarm_id && log.meta?.member_id) {
      await retrySwarmMember(log.meta.swarm_id, log.meta.member_id)
    }
    fetchLogs()
  }

  return (
    <div className="flex-1 flex h-full bg-transparent overflow-hidden relative items-stretch">
      {/* Left Pane: Logs List */}
      <div className="w-[320px] my-3 ml-3 mr-1.5 rounded-2xl glass-sub-sidebar flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-border-muted/20 space-y-3">
          <div className="flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold font-display text-white tracking-tight">System Logs Console</h2>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingLogs}
              className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs, roles, errors..."
              className="w-full bg-black/40 border border-white/[0.06] focus:border-white/20 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-all"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1 select-none">
            {['all', 'terminal', 'workflow', 'swarm', 'heartbeat'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-1 rounded-md text-[9px] font-semibold border uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === t
                    ? 'bg-white/[0.08] text-white border-white/20'
                    : 'bg-zinc-950/40 border-white/[0.03] text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1.5 pt-1 select-none">
            {['all', 'completed', 'failed', 'running'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-all cursor-pointer ${
                  filterStatus === s ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Logs List Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center select-none">
              <p className="text-[11px] text-zinc-500">No logs found matching criteria</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = log.id === selectedLogId
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`w-full p-3 rounded-xl border text-left flex gap-3 transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] border-white/20'
                      : 'bg-zinc-950/40 border-white/[0.03] hover:border-white/10 hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="mt-0.5">{getLogIcon(log.type)}</div>
                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-white truncate block">
                        {log.title}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>
                    {log.command && (
                      <p className="text-[10px] text-zinc-500 font-mono truncate leading-normal">
                        {log.command}
                      </p>
                    )}
                    <span className="text-[9px] text-zinc-600 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Pane: Detailed Console & Health Watchdog */}
      <div className="flex-1 my-3 mr-3 ml-1.5 rounded-2xl glass-content-card flex flex-col overflow-hidden relative">
        {selectedLog ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden select-text text-left">
            {/* Header */}
            <div className="p-6 border-b border-border-muted/20 bg-zinc-950/20 flex justify-between items-start gap-4 shrink-0">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 select-none">
                  <span className="text-[9px] font-bold font-mono border bg-white/5 border-white/10 px-2 py-0.5 rounded-md text-zinc-400 uppercase tracking-widest">
                    {selectedLog.type} log
                  </span>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <h1 className="text-base font-bold font-display text-white tracking-tight truncate">
                  {selectedLog.title}
                </h1>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Timestamp: {new Date(selectedLog.timestamp).toLocaleString()}
                </p>
              </div>

              {/* Action Retry */}
              {(selectedLog.status === 'failed' || selectedLog.status === 'rejected') && 
               (selectedLog.type === 'workflow' || selectedLog.type === 'swarm') && (
                <button
                  onClick={() => handleRetry(selectedLog)}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold select-none shadow-md"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Retry Operation</span>
                </button>
              )}
            </div>

            {/* Main Log Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
              {/* Meta properties */}
              <div className="grid grid-cols-2 gap-4 bg-zinc-900/40 border border-white/[0.04] p-4 rounded-xl shrink-0 select-text">
                {selectedLog.command && (
                  <div className="col-span-2 space-y-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Target Instruction</span>
                    <code className="text-xs font-mono text-zinc-300 bg-black/40 border border-white/[0.04] px-2 py-1 rounded block whitespace-pre-wrap">
                      {selectedLog.command}
                    </code>
                  </div>
                )}
                {selectedLog.meta?.role && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Assigned Role</span>
                    <span className="text-xs font-semibold text-white font-mono">@{selectedLog.meta.role.toUpperCase()}</span>
                  </div>
                )}
                {selectedLog.meta?.project_name && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Project context</span>
                    <span className="text-xs font-semibold text-white">{selectedLog.meta.project_name}</span>
                  </div>
                )}
                {selectedLog.meta?.risk_level && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Security Risk Level</span>
                    <span className={`text-xs font-bold font-mono ${
                      selectedLog.meta.risk_level === 'HIGH' ? 'text-rose-400' : selectedLog.meta.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{selectedLog.meta.risk_level}</span>
                  </div>
                )}
                {selectedLog.meta?.rationale && (
                  <div className="col-span-2 space-y-1 border-t border-white/[0.03] pt-3 mt-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">AI Rationale</span>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">{selectedLog.meta.rationale}</p>
                  </div>
                )}
              </div>

              {/* Terminal Screen output */}
              <div className="flex-1 flex flex-col min-h-[300px] border border-white/[0.06] rounded-xl bg-black overflow-hidden shadow-inner">
                {/* Terminal top header bar */}
                <div className="px-4 py-2.5 bg-zinc-950 border-b border-white/[0.05] flex items-center justify-between select-none">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">terminal_output.log</span>
                  <div className="w-10" />
                </div>
                
                {/* Code viewport */}
                <pre className="flex-1 p-5 overflow-auto text-emerald-400/90 text-xs font-mono leading-relaxed bg-black whitespace-pre-wrap text-left shadow-inner">
                  {selectedLog.log ? (
                    selectedLog.log
                  ) : (
                    <span className="text-zinc-600 italic">No console logs outputted. Operation executed silently.</span>
                  )}
                </pre>
              </div>
            </div>

            {/* Quick footer back button */}
            <div className="px-6 py-4 border-t border-white/[0.04] bg-zinc-950/10 shrink-0 select-none">
              <button
                onClick={() => setSelectedLogId(null)}
                className="text-xs text-zinc-500 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                ← Back to Agent Heartbeat Monitor
              </button>
            </div>
          </div>
        ) : (
          /* Heartbeat Board / Empty State Overview */
          <div className="flex-1 flex flex-col overflow-y-auto p-8 select-text">
            {/* System Overview Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.05] mb-8 select-none">
              <div>
                <h1 className="text-lg font-bold font-display text-white tracking-tight">Active Employee Heartbeat Monitor</h1>
                <p className="text-xs text-zinc-500 mt-1">Real-time health status of corporate AI agents and background task execution loops.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse" />
                <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">watchdog active</span>
              </div>
            </div>

            {/* Health status grid */}
            <div className="space-y-4 text-left">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                <HeartIcon className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>AI Swarm & Department Staff Health Board</span>
              </div>
              
              {agentHeartbeats.length === 0 ? (
                <div className="border border-dashed border-white/[0.08] p-8 text-center rounded-2xl select-none">
                  <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mx-auto mb-2" />
                  <span className="text-[10px] text-zinc-500">Waiting for agent templates to initialize...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agentHeartbeats.map(agent => (
                    <div 
                      key={agent.role}
                      className={`p-4 rounded-xl border bg-zinc-900/30 transition-all flex flex-col gap-3 ${
                        agent.is_running 
                          ? 'border-white/10 shadow-sm'
                          : 'border-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block uppercase tracking-wider font-mono">
                            @{agent.role}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate block mt-0.5">
                            {agent.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 select-none">
                          <span className="text-[9px] text-zinc-400 font-mono capitalize">
                            {agent.is_running ? 'executing task' : 'idle'}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${getAgentHeartbeatColor(agent.is_running ? agent.heartbeat_status : 'inactive')}`} />
                        </div>
                      </div>

                      {agent.is_running ? (
                        <div className="space-y-2 border-t border-white/[0.04] pt-2">
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">active task</span>
                            <span className="text-xs text-zinc-300 font-medium leading-relaxed truncate block">
                              {agent.current_task}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono border-t border-white/[0.02] pt-1">
                            <span>Watchdog Status</span>
                            <span className="font-bold text-zinc-400 capitalize">{agent.heartbeat_status || 'healthy'}</span>
                          </div>

                          {agent.last_heartbeat && (
                            <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                              <span>Last active</span>
                              <span>{new Date(agent.last_heartbeat).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="border-t border-white/[0.04] pt-2 text-[10px] text-zinc-600 italic">
                          No active operations. Agent is in standby mode.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick troubleshooting tips */}
            <div className="mt-8 p-4 rounded-xl border border-white/[0.04] bg-zinc-950/25 text-left select-text space-y-2">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                <span>System Trouble-shooting Guide</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The AI watchdog monitors running tasks every 15 seconds. If an agent hangs or hits an API timeout, the watchdog will nudge the agent automatically. If recovery fails, the task will be marked as <span className="text-rose-400 font-semibold font-mono">failed</span> and logged in the panel.
              </p>
              <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-4 font-mono leading-relaxed">
                <li>Check <span className="text-zinc-300">Terminal Logs</span> for compiler or shell sandbox violations.</li>
                <li>Verify your provider API keys and credit budgets in <span className="text-zinc-300">Settings</span>.</li>
                <li>Use the list on the left to click on any <span className="text-rose-400">failed</span> log item and invoke a manual <span className="text-zinc-300">Retry</span>.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
