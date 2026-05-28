import React, { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  ActivityIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  CpuIcon,
  PlusIcon,
  TerminalIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  PlayIcon,
  Loader2Icon,
  MessageSquareIcon,
  FileTextIcon,
  SparklesIcon,
  LayersIcon,
  ArrowRightIcon,
  FolderOpenIcon,
  TableIcon,
  PresentationIcon
} from 'lucide-react'

export default function SwarmPane() {
  const {
    swarms,
    activeSwarmDetails,
    fetchSwarms,
    fetchSwarmDetails,
    deploySwarm,
    files
  } = useWorkspaceStore()

  const [selectedSwarmId, setSelectedSwarmId] = useState(null)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [newSwarmName, setNewSwarmName] = useState('')
  const [executionMode, setExecutionMode] = useState('sequential') // 'sequential', 'parallel', 'collaborative'
  const [newSwarmMembers, setNewSwarmMembers] = useState([
    { role: 'Planner', task: 'Phác thảo lộ trình sản phẩm Cafe MVP và phân tích thị trường.' },
    { role: 'Developer', task: 'Thiết kế slide kỹ thuật giới thiệu kiến trúc Cafe MVP (.slide.md).' },
    { role: 'Marketer', task: 'Soạn thảo bảng dự toán ngân sách marketing (.csv).' }
  ])
  const [expandedMemberId, setExpandedMemberId] = useState(null)
  const [activePreviewFile, setActivePreviewFile] = useState(null)

  // Fetch swarms list on mount
  useEffect(() => {
    fetchSwarms()
  }, [])

  // Auto-poll if active swarm is running or pending
  useEffect(() => {
    let timer
    if (selectedSwarmId) {
      fetchSwarmDetails(selectedSwarmId)
      
      const poll = () => {
        fetchSwarmDetails(selectedSwarmId)
        fetchSwarms()
      }
      
      timer = setInterval(() => {
        const details = useWorkspaceStore.getState().activeSwarmDetails
        if (details && (details.status === 'running' || details.status === 'pending')) {
          poll()
        }
      }, 3000)
    }
    return () => clearInterval(timer)
  }, [selectedSwarmId])

  const handleSelectSwarm = (id) => {
    setSelectedSwarmId(id)
    setExpandedMemberId(null)
    setActivePreviewFile(null)
    fetchSwarmDetails(id)
  }

  const handleAddMember = () => {
    setNewSwarmMembers([...newSwarmMembers, { role: '', task: '' }])
  }

  const handleRemoveMember = (index) => {
    setNewSwarmMembers(newSwarmMembers.filter((_, i) => i !== index))
  }

  const handleMemberChange = (index, field, value) => {
    const updated = [...newSwarmMembers]
    updated[index][field] = value
    setNewSwarmMembers(updated)
  }

  const handleDeploy = async () => {
    if (!newSwarmName.trim()) return
    const filteredMembers = newSwarmMembers.filter(m => m.role.trim() && m.task.trim())
    if (filteredMembers.length === 0) return

    const result = await deploySwarm(newSwarmName, filteredMembers, executionMode)
    if (result && result.swarm_id) {
      setShowDeployModal(false)
      setNewSwarmName('')
      setExecutionMode('sequential')
      setNewSwarmMembers([
        { role: 'Planner', task: 'Phác thảo lộ trình sản phẩm Cafe MVP.' },
        { role: 'Developer', task: 'Thiết kế slide kỹ thuật giới thiệu kiến trúc Cafe MVP (.slide.md).' }
      ])
      handleSelectSwarm(result.swarm_id)
    }
  }

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle2Icon className="w-4 h-4 text-emerald-400 shrink-0" />
    if (status === 'failed') return <XCircleIcon className="w-4 h-4 text-rose-400 shrink-0" />
    if (status === 'running') return <Loader2Icon className="w-4 h-4 text-white shrink-0 animate-spin" />
    return <ClockIcon className="w-4 h-4 text-zinc-500 shrink-0" />
  }

  const getStatusBadgeClass = (status) => {
    if (status === 'completed') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    if (status === 'failed') return 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    if (status === 'running') return 'bg-white/10 border-white/20 text-white animate-pulse'
    return 'bg-zinc-800 border-zinc-700 text-zinc-400'
  }

  const getProgress = (details) => {
    if (!details || !details.members || details.members.length === 0) return 0
    const completedCount = details.members.filter(m => m.status === 'completed').length
    return Math.round((completedCount / details.members.length) * 100)
  }

  // Scan for deliverables (files created by the swarm)
  const getSwarmDeliverables = (details) => {
    if (!details || !details.members) return []
    const found = []
    
    // Scan logs and results for file names written
    details.members.forEach(m => {
      if (m.logs) {
        const matches = m.logs.match(/Đã tự động ghi file: ([a-zA-Z0-9_\-\.\/]+)/g)
        if (matches) {
          matches.forEach(match => {
            const fName = match.replace('Đã tự động ghi file: ', '').trim()
            if (!found.includes(fName)) found.push(fName)
          })
        }
      }
      if (m.result) {
        const jsonMatch = m.result.match(/"name":\s*"([^"]+)"/g)
        if (jsonMatch) {
          jsonMatch.forEach(match => {
            const fName = match.replace(/"name":\s*"/, '').replace('"', '').trim()
            if (!found.includes(fName)) found.push(fName)
          })
        }
      }
    })
    return found
  }

  // Helper to color-code agents in discussion
  const getAgentStyles = (role) => {
    const lRole = role.toLowerCase()
    if (lRole.includes('planner')) return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', text: 'text-indigo-400', iconColor: 'text-indigo-300' }
    if (lRole.includes('developer') || lRole.includes('engineer')) return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', iconColor: 'text-emerald-300' }
    if (lRole.includes('market')) return { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400', iconColor: 'text-amber-300' }
    if (lRole.includes('finance') || lRole.includes('legal')) return { bg: 'bg-violet-500/10', border: 'border-violet-500/25', text: 'text-violet-400', iconColor: 'text-violet-300' }
    return { bg: 'bg-rose-500/10', border: 'border-rose-500/25', text: 'text-rose-400', iconColor: 'text-rose-300' }
  }

  // Visual Topology Graph Renderer
  const renderTopology = (mode, members, activeIndex = 0) => {
    if (mode === 'parallel') {
      return (
        <div className="py-6 flex flex-col items-center justify-center bg-zinc-950/20 border border-white/[0.04] rounded-2xl p-4">
          <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-1.5"><LayersIcon className="w-3.5 h-3.5" /> Concurrent Parallel Pipeline</div>
          <div className="flex items-center gap-8 relative w-full justify-center max-w-md">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white shadow-md relative z-10">
              <CpuIcon className="w-5 h-5 text-white animate-pulse" />
            </div>
            
            <div className="flex flex-col gap-3 relative z-10">
              {members?.map((m, idx) => {
                const styles = getAgentStyles(m.role)
                const isRunning = m.status === 'running'
                const isDone = m.status === 'completed'
                return (
                  <div key={idx} className={`flex items-center gap-3 px-3 py-2 rounded-xl border bg-zinc-900/60 backdrop-blur-md transition-all ${
                    isRunning ? 'border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.05)]' : isDone ? 'border-emerald-500/30' : 'border-white/[0.03]'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-white animate-ping' : isDone ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-xs font-semibold text-white">{m.role}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    if (mode === 'collaborative') {
      return (
        <div className="py-6 flex flex-col items-center justify-center bg-zinc-950/20 border border-white/[0.04] rounded-2xl p-4">
          <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-1.5"><MessageSquareIcon className="w-3.5 h-3.5" /> Round-Robin Consensus Ring</div>
          <div className="flex items-center gap-6 justify-center relative w-full max-w-sm">
            {members?.map((m, idx) => {
              const styles = getAgentStyles(m.role)
              const isRunning = m.status === 'running'
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                    isRunning ? 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.06)]' : 'bg-zinc-900/60 border-white/[0.05]'
                  }`}>
                    <SparklesIcon className={`w-4 h-4 ${styles.iconColor} ${isRunning ? 'animate-bounce' : ''}`} />
                  </div>
                  <span className="text-[10px] font-bold text-white tracking-tight">{m.role}</span>
                  {idx < members.length - 1 && (
                    <ArrowRightIcon className="w-4 h-4 text-zinc-600 absolute -right-5 top-4" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Default: Sequential
    return (
      <div className="py-6 flex flex-col items-center justify-center bg-zinc-950/20 border border-white/[0.04] rounded-2xl p-4">
        <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-1.5"><ArrowRightIcon className="w-3.5 h-3.5" /> Sequential Chain Pipeline</div>
        <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-2">
          {members?.map((m, idx) => {
            const styles = getAgentStyles(m.role)
            const isRunning = m.status === 'running'
            const isDone = m.status === 'completed'
            return (
              <div key={idx} className="flex items-center gap-3 shrink-0">
                <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 bg-zinc-900/60 backdrop-blur-md transition-all ${
                  isRunning ? 'border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.05)]' : isDone ? 'border-emerald-500/30' : 'border-white/[0.03]'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-white animate-ping' : isDone ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  <span className="text-xs font-semibold text-white">{m.role}</span>
                </div>
                {idx < members.length - 1 && (
                  <ArrowRightIcon className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Custom Preview Renderer for generated files
  const renderFilePreview = () => {
    if (!activePreviewFile) return null
    const fPath = activePreviewFile
    
    // Find file from state
    const foundFile = files.find(f => f.path === fPath || f.path.endsWith(fPath))
    
    const [previewContent, setPreviewContent] = useState('Loading preview...')
    
    useEffect(() => {
      const load = async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/workspaces/beo_corp/files/${fPath}`)
          if (res.ok) {
            const d = await res.json()
            setPreviewContent(d.content || 'Empty file.')
          } else {
            setPreviewContent('Failed to fetch file content.')
          }
        } catch (e) {
          setPreviewContent('Error loading content.')
        }
      }
      load()
    }, [fPath])

    const isCSV = fPath.endsWith('.csv')
    const isSlide = fPath.includes('.slide.md')

    return (
      <div className="absolute inset-0 z-20 flex flex-col bg-zinc-950/98 backdrop-blur-md border border-white/[0.08] rounded-xl overflow-hidden p-6 text-left">
        <div className="flex justify-between items-center border-b border-white/[0.05] pb-4 mb-4 select-none">
          <div className="flex items-center gap-2">
            {isCSV ? <TableIcon className="w-4 h-4 text-amber-400" /> : isSlide ? <PresentationIcon className="w-4 h-4 text-emerald-400" /> : <FileTextIcon className="w-4 h-4 text-sky-400" />}
            <span className="text-sm font-semibold text-white font-mono">{fPath}</span>
          </div>
          <button
            onClick={() => setActivePreviewFile(null)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Close Preview
          </button>
        </div>

        <div className="flex-1 overflow-y-auto font-sans leading-relaxed text-zinc-300 text-xs">
          {isCSV ? (
            <div className="border border-white/[0.05] rounded-xl overflow-hidden bg-zinc-900/40">
              <table className="min-w-full divide-y divide-white/[0.04] text-[11px] font-mono">
                <tbody className="divide-y divide-white/[0.04]">
                  {previewContent.split('\n').map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx === 0 ? 'bg-white/[0.02]' : ''}>
                      {row.split(',').map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 border-r border-white/[0.03] text-zinc-300">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isSlide ? (
            <div className="space-y-6">
              {previewContent.split('---').map((slide, sIdx) => (
                <div key={sIdx} className="p-6 bg-zinc-900/60 border border-white/[0.05] rounded-2xl relative shadow-md">
                  <span className="absolute top-4 right-4 text-[9px] font-mono text-zinc-500">Slide {sIdx + 1}</span>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-200">{slide.trim()}</pre>
                </div>
              ))}
            </div>
          ) : (
            <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.04] font-mono text-xs text-zinc-300 whitespace-pre-wrap select-all leading-relaxed">
              {previewContent}
            </pre>
          )}
        </div>
      </div>
    )
  }

  const deliverables = activeSwarmDetails ? getSwarmDeliverables(activeSwarmDetails) : []

  return (
    <div className="flex-1 flex h-full bg-transparent overflow-hidden relative items-stretch">
      
      {/* Left Pane: Swarms List (30% width) */}
      <div className="w-[280px] my-3 ml-3 mr-1.5 rounded-2xl glass-sub-sidebar flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-border-muted/20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold font-display text-white tracking-tight">Swarm Mission Control</h2>
          </div>
          <button
            onClick={() => setShowDeployModal(true)}
            className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white flex items-center justify-center transition-colors"
            title="Deploy New Swarm"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {swarms.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center select-none">
              <p className="text-[11px] text-content-muted">No swarm operations found</p>
            </div>
          ) : (
            swarms.map((swarm) => {
              const isSelected = swarm.id === selectedSwarmId
              return (
                <button
                  key={swarm.id}
                  onClick={() => handleSelectSwarm(swarm.id)}
                  className={`w-full p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] border-white/20'
                      : 'bg-zinc-950/40 border-white/[0.03] hover:border-white/10 hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate">{swarm.name}</span>
                    <span className={`text-[8px] font-mono border px-1.5 py-0.5 rounded-full uppercase ${getStatusBadgeClass(swarm.status)}`}>
                      {swarm.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                    <span className="capitalize">{swarm.execution_mode || 'sequential'} Swarm</span>
                    <span>{new Date(swarm.created_at).toLocaleTimeString()}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Pane: Swarm Detail Console */}
      <div className="flex-1 my-3 mr-3 ml-1.5 rounded-2xl glass-content-card flex overflow-hidden relative">
        {activeSwarmDetails ? (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Center Area: Logs, Topology, Chat Bubbles (70% width) */}
            <div className="flex-1 flex flex-col h-full border-r border-border-muted/20 overflow-hidden">
              {/* Swarm Job Detail Header */}
              <div className="p-6 border-b border-border-muted/20 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold font-display text-white tracking-tight truncate">{activeSwarmDetails.name}</h1>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Created on {new Date(activeSwarmDetails.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(activeSwarmDetails.status)}
                    <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${getStatusBadgeClass(activeSwarmDetails.status)}`}>
                      {activeSwarmDetails.status}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Swarm Execution Progress</span>
                    <span>{getProgress(activeSwarmDetails)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.02]">
                    <div
                      className="h-full bg-white transition-all duration-500 shadow-[0_0_8px_#fff]"
                      style={{ width: `${getProgress(activeSwarmDetails)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Swarm details/topologies and logs */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Visual Topology Render */}
                {renderTopology(activeSwarmDetails.execution_mode, activeSwarmDetails.members)}

                {/* Swarm Multi-Agent Debate chat bubbles (Collaborative Mode) */}
                {activeSwarmDetails.execution_mode === 'collaborative' && activeSwarmDetails.discussion && (
                  <div className="space-y-4">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><MessageSquareIcon className="w-3.5 h-3.5" /> Collaborative Swarm Debate log</div>
                    <div className="space-y-3">
                      {activeSwarmDetails.discussion.map((msg, idx) => {
                        const styles = getAgentStyles(msg.sender)
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border text-left flex flex-col gap-1.5 ${styles.bg} ${styles.border}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>{msg.sender}</span>
                              <span className="text-[9px] text-zinc-600 font-mono">Turn {idx + 1}</span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Standard Swarm Steps details */}
                <div className="space-y-3">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><CpuIcon className="w-3.5 h-3.5" /> Swarm execution logs & steps</div>
                  {activeSwarmDetails.members?.map((member, index) => {
                    const isExpanded = expandedMemberId === member.id
                    const isRunning = member.status === 'running'
                    
                    return (
                      <div
                        key={member.id}
                        className={`border rounded-xl bg-background-card/40 transition-all ${
                          isRunning 
                            ? 'border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.03)]'
                            : 'border-white/[0.04]'
                        }`}
                      >
                        <button
                          onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                          className="w-full flex items-center justify-between p-4 text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0">
                              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-zinc-500">Step {index + 1}</span>
                                <span className="text-xs font-semibold text-white truncate">{member.role}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate mt-0.5">{member.task}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusIcon(member.status)}
                            {isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-white/[0.03] pt-4 space-y-4">
                            <div>
                              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Assigned Task</div>
                              <p className="text-xs text-white leading-relaxed">{member.task}</p>
                            </div>

                            {member.logs && (
                              <div>
                                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <TerminalIcon className="w-3 h-3" /> Agent Execution Logs
                                </div>
                                <pre className="bg-black/80 border border-white/[0.04] p-3.5 rounded-lg text-[11px] font-mono text-emerald-400/90 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
                                  {member.logs}
                                </pre>
                              </div>
                            )}

                            {member.result && (
                              <div>
                                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Output Result</div>
                                <div className="bg-zinc-900/60 border border-white/[0.03] p-3.5 rounded-lg text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                  {member.result}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Area: Swarm Deliverables/File Hub (30% width) */}
            <div className="w-[220px] flex flex-col h-full bg-zinc-950/20 select-none overflow-y-auto p-4 shrink-0 relative">
              <div className="flex items-center gap-2 mb-4 border-b border-white/[0.05] pb-3">
                <FolderOpenIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-display">Swarm File Hub</span>
              </div>

              {deliverables.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <FileTextIcon className="w-8 h-8 text-zinc-700 mb-2" />
                  <span className="text-[10px] text-zinc-500 leading-normal">No deliverables produced by this swarm yet.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((file, fIdx) => {
                    const isCSV = file.endsWith('.csv')
                    const isSlide = file.includes('.slide.md')
                    return (
                      <button
                        key={fIdx}
                        onClick={() => setActivePreviewFile(file)}
                        className="w-full p-2.5 rounded-xl border border-white/[0.03] bg-zinc-900/40 hover:bg-zinc-900 hover:border-white/10 text-left flex items-start gap-2.5 transition-all"
                      >
                        {isCSV ? <TableIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> : isSlide ? <PresentationIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <FileTextIcon className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-white truncate block font-mono">{file}</span>
                          <span className="text-[9px] text-zinc-500 mt-0.5 font-mono capitalize">
                            {isCSV ? 'CSV Sheet' : isSlide ? 'Slide Presentation' : 'Markdown Doc'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Render Preview Window Overlay */}
              {renderFilePreview()}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <CpuIcon className="w-10 h-10 text-zinc-600 mb-3 animate-pulse" />
            <h2 className="text-xl font-bold font-display text-white tracking-tight">Swarm Mission Control Panel</h2>
            <p className="text-xs text-content-muted max-w-[280px] leading-relaxed mt-1">
              Select a swarm from the list to view its visual execution topology, logs, and generated files, or deploy a new custom swarm.
            </p>
            <button
              onClick={() => setShowDeployModal(true)}
              className="mt-5 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs transition-transform hover:scale-[1.02] flex items-center gap-1.5 shadow-md"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Deploy Custom Swarm
            </button>
          </div>
        )}
      </div>

      {/* DEPLOY SWARM MODAL */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[580px] bg-zinc-950/95 border border-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.9)] rounded-2xl overflow-hidden flex flex-col text-left pane-fade-in max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/70" />
            
            <div className="p-6 border-b border-white/[0.05] flex justify-between items-center select-none">
              <h2 className="text-[15px] font-bold text-white font-display flex items-center gap-2">
                <CpuIcon className="w-4 h-4" /> Deploy Swarm Operation
              </h2>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Swarm Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Swarm Project Name</label>
                <input
                  type="text"
                  value={newSwarmName}
                  onChange={(e) => setNewSwarmName(e.target.value)}
                  placeholder="e.g. Market Analysis & Business Deck Generation"
                  className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {/* Swarm Execution Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Execution Mode (Topology)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'sequential', label: 'Sequential Chain', desc: 'Step-by-step pipeline' },
                    { id: 'parallel', label: 'Concurrent Parallel', desc: 'Multi-threaded execution' },
                    { id: 'collaborative', label: 'Consensus Debate', desc: 'Round-robin agent chat' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setExecutionMode(mode.id)}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        executionMode === mode.id
                          ? 'bg-white/[0.08] border-white/20 shadow'
                          : 'bg-zinc-900/40 border-white/[0.03] hover:border-white/10 hover:bg-zinc-900/60'
                      }`}
                    >
                      <span className="text-xs font-semibold text-white">{mode.label}</span>
                      <span className="text-[9px] text-zinc-500 leading-normal">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Members configuration list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center select-none">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Sequential Steps & Swarm Agents</label>
                  <button
                    onClick={handleAddMember}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <PlusIcon className="w-3 h-3" /> Add Step
                  </button>
                </div>

                <div className="space-y-3 max-h-[25vh] overflow-y-auto pr-1">
                  {newSwarmMembers.map((member, index) => (
                    <div key={index} className="p-3.5 bg-zinc-900/60 border border-white/[0.04] rounded-xl relative space-y-2">
                      <button
                        onClick={() => handleRemoveMember(index)}
                        className="absolute right-3 top-3 text-[10px] text-zinc-500 hover:text-rose-400"
                      >
                        Remove
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <input
                            type="text"
                            value={member.role}
                            onChange={(e) => handleMemberChange(index, 'role', e.target.value)}
                            placeholder="Agent Role (e.g. Marketer)"
                            className="w-full bg-zinc-950 border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={member.task}
                            onChange={(e) => handleMemberChange(index, 'task', e.target.value)}
                            placeholder="Task (e.g. Write competitor analysis report)"
                            className="w-full bg-zinc-950 border border-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/[0.05] flex justify-end gap-3 select-none">
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 border border-white/[0.06] rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={!newSwarmName.trim() || newSwarmMembers.length === 0}
                className="px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-semibold transition-transform hover:scale-[1.02] flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <PlayIcon className="w-3 h-3 fill-black" /> Deploy Swarm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
