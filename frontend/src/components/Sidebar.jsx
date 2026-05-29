import React from 'react'
import { useWorkspaceStore, getTabRole } from '../store/workspaceStore'
import {
  BookOpenIcon,
  ChevronDownIcon,
  ClockIcon,
  FolderIcon,
  InboxIcon,
  SettingsIcon,
  SparklesIcon,
  ActivityIcon,
  PlusIcon,
  MessageSquareIcon,
  EyeIcon,
  FileTextIcon,
  LayersIcon,
  Loader2,
  TerminalIcon
} from 'lucide-react'

function Section({ title, children }) {
  const [isOpen, setIsOpen] = React.useState(true)
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 pt-4 pb-1 flex items-center justify-between text-[10px] font-semibold text-content-muted/80 uppercase tracking-wider hover:text-content-normal transition-colors text-left"
      >
        <span className="flex items-center gap-1.5">{title}</span>
        <ChevronDownIcon className={`w-3 h-3 opacity-60 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && (
        <div className="subtab-entrance space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

function NavItem({ active, icon: Icon, label, count, children, onClick, isLoading }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-9 flex items-center gap-2.5 px-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        active
          ? 'bg-white/[0.08] text-content-highlight shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
          : 'text-content-muted hover:text-content-normal hover:bg-white/[0.045]'
      }`}
    >
      {Icon ? (
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-content-highlight' : 'text-content-muted'}`} />
      ) : (
        children
      )}
      <span className="truncate capitalize flex-1">{label}</span>
      {isLoading ? (
        <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ml-auto ${active ? 'text-zinc-300' : 'text-zinc-500'}`} />
      ) : count ? (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-md bg-white/[0.08] text-[11px] leading-5 text-content-normal text-center shrink-0">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function HistoryItem({ active, icon: Icon, label, children, onClick, onHistory, isLoading }) {
  return (
    <div className="relative group">
      <NavItem active={active} icon={Icon} label={label} onClick={onClick} isLoading={isLoading}>
        {children}
      </NavItem>
      {onHistory && !isLoading ? (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onHistory()
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-content-muted opacity-0 group-hover:opacity-70 hover:opacity-100 hover:text-content-highlight hover:bg-white/[0.06] transition"
          title={`History: ${label}`}
          aria-label={`History: ${label}`}
        >
          <ClockIcon className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  )
}

function SubNavItem({ active, icon: Icon, label, onClick, onHistory, indentLevel = 1, isLoading }) {
  const indentClass = indentLevel === 2 ? 'pl-7' : 'pl-5'
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full h-8 flex items-center gap-2 px-2.5 rounded-lg text-[12px] font-medium transition-colors text-left ${indentClass} ${
          active
            ? 'bg-white/[0.06] text-content-highlight shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] border-l-2 border-white/50'
            : 'text-content-muted hover:text-content-normal hover:bg-white/[0.03]'
        }`}
      >
        {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-content-highlight' : 'text-content-muted'}`} />}
        <span className="truncate capitalize flex-1">{label}</span>
        {isLoading && (
          <Loader2 className={`w-3 h-3 animate-spin shrink-0 ml-auto mr-1 ${active ? 'text-zinc-300' : 'text-zinc-500'}`} />
        )}
      </button>
      {onHistory && !isLoading && (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onHistory()
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5.5 h-5.5 rounded-md flex items-center justify-center text-content-muted opacity-0 group-hover:opacity-70 hover:opacity-100 hover:text-content-highlight hover:bg-white/[0.06] transition"
          title={`History: ${label}`}
        >
          <ClockIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

export default function Sidebar({ onOpenHistory }) {
  const {
    workspaceId,
    workspaceName,
    setWorkspace,
    onboardingCompleted,
    activeTab,
    selectTab,
    inboxItems,
    departments,
    projects,
    files,
    fetchFiles,
    setSetupWizard,
    teams,
    isSending,
    sendingTab
  } = useWorkspaceStore()

  const [expandedDepts, setExpandedDepts] = React.useState({})
  const [expandedChatDepts, setExpandedChatDepts] = React.useState({})
  const [expandedViewDepts, setExpandedViewDepts] = React.useState({})
  const [workspaces, setWorkspaces] = React.useState([])
  const [showWorkspaceMenu, setShowWorkspaceMenu] = React.useState(false)

  React.useEffect(() => {
    fetchFiles?.()
  }, [fetchFiles])

  React.useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/workspaces')
        if (res.ok) {
          const data = await res.json()
          setWorkspaces(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadWorkspaces()
  }, [workspaceId])

  React.useEffect(() => {
    if (activeTab.startsWith('dep_')) {
      const parts = activeTab.split('_')
      const deptId = `${parts[0]}_${parts[1]}`
      setExpandedDepts(prev => ({ ...prev, [deptId]: true }))
      
      if (activeTab.includes('_chat_')) {
        setExpandedChatDepts(prev => ({ ...prev, [deptId]: true }))
      } else if (activeTab.includes('_view')) {
        setExpandedViewDepts(prev => ({ ...prev, [deptId]: true }))
      }
    }
  }, [activeTab])

  const toggleDept = (deptId) => {
    setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const toggleChatDept = (deptId, e) => {
    e.stopPropagation()
    setExpandedChatDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const toggleViewDept = (deptId, e) => {
    e.stopPropagation()
    setExpandedViewDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const pendingCount = inboxItems.length
  const visibleDepartments = onboardingCompleted ? (departments || []) : []
  const visibleProjects = onboardingCompleted ? (projects || []) : []
  const initials = workspaceName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="w-[244px] h-full glass-sidebar flex flex-col select-none z-10">
      <div className="p-3 border-b border-border-muted/20 relative">
        <button
          onClick={() => setShowWorkspaceMenu(prev => !prev)}
          className="w-full h-10 flex items-center gap-2 px-2 rounded-lg hover:bg-white/[0.04] transition-all text-left"
        >
          <span className="w-7 h-7 rounded-lg bg-white/[0.07] border border-white/[0.06] text-content-highlight text-[11px] font-bold flex items-center justify-center shrink-0">
            {initials || 'B'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-content-highlight flex items-center gap-1.5">
              <span>{workspaceName}</span>
              <ChevronDownIcon className="w-3 h-3 opacity-60" />
            </div>
            <div className="text-[10px] text-content-muted">Local workspace</div>
          </div>
        </button>

        {showWorkspaceMenu && (
          <div className="absolute top-14 left-3 right-3 bg-zinc-950/95 border border-white/[0.08] rounded-xl shadow-[0_18px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 subtab-entrance text-left">
            <div className="text-[10px] font-bold text-zinc-500 font-mono uppercase tracking-wider px-2 py-1 select-none">
              Switch Workspace
            </div>
            <div className="h-[1px] bg-white/[0.04] my-1" />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setWorkspace(ws.id, ws.name)
                    setShowWorkspaceMenu(false)
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                    ws.id === workspaceId
                      ? 'bg-white/[0.08] text-white font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.05] flex items-center justify-center text-[10px] font-bold">
                    {ws.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                  </span>
                  <div className="truncate flex-1 min-w-0">
                    <div className="truncate font-semibold">{ws.name}</div>
                    <div className="text-[9px] text-zinc-500 truncate mt-0.5 font-mono">{ws.id}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="h-[1px] bg-white/[0.04] my-1" />
            <button
              onClick={() => {
                setSetupWizard(true, 'create_workspace')
                setShowWorkspaceMenu(false)
              }}
              className="w-full text-center px-2.5 py-2 rounded-lg text-xs text-white hover:bg-white/5 border border-white/[0.06] border-dashed hover:border-white/20 font-bold transition-all flex items-center justify-center gap-1.5 mt-1"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Create Workspace</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-1.5">
          <NavItem
            active={activeTab === 'inbox'}
            icon={InboxIcon}
            label="Inbox"
            count={pendingCount}
            onClick={() => selectTab('inbox')}
          />
          <HistoryItem
            active={activeTab === 'secretary_chat'}
            icon={MessageSquareIcon}
            label="Messages"
            onClick={() => selectTab('secretary_chat')}
            onHistory={() => onOpenHistory?.('secretary_chat')}
            isLoading={sendingTab === 'secretary_chat'}
          />
          {onboardingCompleted && (
            <>
              <NavItem
                active={activeTab === 'swarms'}
                icon={ActivityIcon}
                label="Swarms"
                onClick={() => selectTab('swarms')}
              />
              <NavItem
                active={activeTab === 'logs'}
                icon={TerminalIcon}
                label="Log"
                onClick={() => selectTab('logs')}
              />
            </>
          )}
        </div>

        {onboardingCompleted ? (
          <Section title="Workspace">
            <NavItem
              active={activeTab === 'company_files'}
              icon={BookOpenIcon}
              label="Docs"
              onClick={() => selectTab('company_files')}
            />
          </Section>
        ) : null}

        {visibleDepartments.length > 0 ? (
          <Section title="Teams">
            {visibleDepartments.map(dep => {
              const deptName = dep.replace('dep_', '').replace(/_/g, ' ')
              const isDeptExpanded = !!expandedDepts[dep]
              
              const matchesDept = (depKey, teamDept) => {
                if (!teamDept) return false
                const depToRole = {
                  'dep_planning': 'coo',
                  'dep_engineering': 'cto',
                  'dep_marketing': 'cmo',
                  'dep_finance': 'cfo',
                  'dep_product': 'cpo',
                  'dep_executive': 'ceo',
                  'dep_sales': 'cco',
                  'dep_digital': 'cdo',
                  'dep_hr': 'chro',
                  'dep_strategy': 'cso'
                }
                const role = depToRole[depKey]
                const normalizedTeamDept = teamDept.toLowerCase()
                return normalizedTeamDept === role || normalizedTeamDept === depKey.replace('dep_', '')
              }

              return (
                <div key={dep} className="space-y-1">
                  {/* Department Header */}
                  <button
                    onClick={() => toggleDept(dep)}
                    className={`w-full h-9 flex items-center gap-2 px-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isDeptExpanded
                        ? 'text-content-highlight bg-white/[0.03]'
                        : 'text-content-muted hover:text-content-normal hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="truncate capitalize flex-1">{deptName}</span>
                    <ChevronDownIcon className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isDeptExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  {/* Accordion children */}
                  {isDeptExpanded && (
                    <div className="pl-3 border-l border-white/[0.04] ml-2.5 space-y-1 mt-1 subtab-entrance">
                      <SubNavItem
                        active={activeTab === `${dep}_chat_group`}
                        icon={MessageSquareIcon}
                        label="General Group"
                        onClick={() => selectTab(`${dep}_chat_group`)}
                        onHistory={() => onOpenHistory?.(`${dep}_chat_group`)}
                        indentLevel={1}
                        isLoading={sendingTab === `${dep}_chat_group`}
                      />

                      {/* Sub-teams under this department */}
                      {teams && teams
                        .filter(team => matchesDept(dep, team.department))
                        .map(team => {
                          const teamTab = `dep_${team.department}_team_${team.team_id}`
                          return (
                            <SubNavItem
                              key={team.team_id}
                              active={activeTab === teamTab}
                              icon={MessageSquareIcon}
                              label={team.team_name}
                              onClick={() => selectTab(teamTab)}
                              onHistory={() => onOpenHistory?.(teamTab)}
                              indentLevel={1}
                              isLoading={sendingTab === teamTab}
                            />
                          )
                        })}

                      <SubNavItem
                        active={activeTab === `${dep}_view`}
                        icon={EyeIcon}
                        label="View"
                        onClick={() => selectTab(`${dep}_view`)}
                        indentLevel={1}
                      />

                      <SubNavItem
                        active={activeTab === `${dep}_doc`}
                        icon={FileTextIcon}
                        label="Doc"
                        onClick={() => selectTab(`${dep}_doc`)}
                        indentLevel={1}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </Section>
        ) : null}

        {visibleProjects.length > 0 ? (
          <Section title="Projects">
            {visibleProjects.map(project => {
              const tab = `proj_${project}`
              return (
                <HistoryItem
                  key={project}
                  active={activeTab === tab}
                  icon={FolderIcon}
                  label={project}
                  onClick={() => selectTab(tab)}
                  onHistory={() => onOpenHistory?.(tab)}
                  isLoading={sendingTab === tab}
                />
              )
            })}
          </Section>
        ) : null}
      </div>

      <div className="p-3 border-t border-border-muted/20 flex flex-col gap-2">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px] font-mono text-zinc-400 select-none">
          <span>Search Menu</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.05] text-[9px] font-sans">Ctrl+K</kbd>
        </div>
        <NavItem
          active={activeTab === 'settings'}
          icon={SettingsIcon}
          label="Settings"
          onClick={() => selectTab('settings')}
        />
      </div>
    </aside>
  )
}
