import React, { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import HistorySidebar from './components/HistorySidebar'
import ChatPane from './components/ChatPane'
import InboxPane from './components/InboxPane'
import FileHubPane from './components/FileHubPane'
import SettingsPane from './components/SettingsPane'
import ProjectPane from './components/ProjectPane'
import HistoryModal from './components/HistoryModal'
import CommandPalette from './components/CommandPalette'
import SwarmPane from './components/SwarmPane'
import DepartmentViewPane from './components/DepartmentViewPane'
import TeamViewPane from './components/TeamViewPane'
import TeamDocPane from './components/TeamDocPane'
import { useWorkspaceStore } from './store/workspaceStore'
import { getCliproxyAuthTarget, getProviderAuthTarget } from './utils/authInteractions'
import { 
  SparklesIcon, 
  KeyIcon, 
  ArrowRightIcon, 
  ArrowLeftIcon, 
  CpuIcon, 
  GlobeIcon, 
  BuildingIcon, 
  RocketIcon, 
  CheckIcon,
  ChevronDownIcon,
  TerminalIcon,
  ExternalLinkIcon,
  ClipboardPasteIcon,
  ServerIcon,
  LinkIcon,
  ZapIcon,
  XCircleIcon
} from 'lucide-react'

export default function App() {
  const { 
    activeTab, 
    onboardingCompleted,
    loadStatus, 
    fetchMessages, 
    fetchInbox, 
    fetchFiles,
    registerApiKey,
    sendMessage,
    selectTab,
    chatMessages,
    workflows,
    spawnCliproxy,
    scanApiKeyModels,
    testApiKey,
    showHistorySidebar,
    toggleHistorySidebar,
    showSetupWizard,
    wizardMode,
    setSetupWizard
  } = useWorkspaceStore()

  // Local state for Onboarding Wizard popup
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false)
  
  // Wizard Input Forms State
  const [wizardStep, setWizardStep] = useState(1) // 1 = Company Name, 2 = Vision & Goals, 3 = AI Core, 4 = Deploying
  const [companyName, setCompanyName] = useState('')
  const [companyAim, setCompanyAim] = useState('')
  const [aiProvider, setAiProvider] = useState('gemini')
  const [cliproxyMode, setCliproxyMode] = useState('claude_code') // 'claude_code' | 'codex' | 'antigravity'
  const [apiKey, setApiKey] = useState('')
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:8317/v1')
  const [customEndpointUrl, setCustomEndpointUrl] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [initLogs, setInitLogs] = useState([])
  const [showMoreProviders, setShowMoreProviders] = useState(false)
  const [authFlowActive, setAuthFlowActive] = useState(null) // tracks which cliproxy sub-auth is running
  const [historyTargetTab, setHistoryTargetTab] = useState(null)
  const apiKeyInputRef = useRef(null)

  // Model scanning states
  const [customModel, setCustomModel] = useState('')
  const [scannedModels, setScannedModels] = useState([])
  const [scanningModels, setScanningModels] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const fetchModelsForProvider = async (provider, key, url) => {
    setScanningModels(true)
    try {
      const res = await scanApiKeyModels(provider, key || null, url || null)
      if (res && res.models) {
        setScannedModels(res.models)
        if (res.models.length > 0) {
          setCustomModel(res.models[0])
        } else {
          setCustomModel('')
        }
      } else {
        setScannedModels([])
      }
    } catch (e) {
      console.error(e)
      setScannedModels([])
    } finally {
      setScanningModels(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    
    let urlParam = null
    if (aiProvider === 'cliproxyapi') {
      urlParam = gatewayUrl.trim() || 'http://localhost:8317/v1'
    } else if (aiProvider === 'openrouter') {
      urlParam = gatewayUrl.trim() || 'https://openrouter.ai/api/v1'
    } else if (aiProvider === 'custom') {
      urlParam = customEndpointUrl.trim() || null
    }
    
    const res = await testApiKey(aiProvider, apiKey.trim() || null, urlParam, customModel.trim() || null)
    setTestingConnection(false)
    setTestResult(res)

    if (res && res.status === 'success') {
      // Auto-scan models if connection succeeds
      fetchModelsForProvider(aiProvider, apiKey.trim(), urlParam)
    }
  }

  // Scan models when provider changes or popup loads
  useEffect(() => {
    if (showSetupWizard) {
      const currentUrl = aiProvider === 'custom' ? customEndpointUrl : (aiProvider === 'cliproxyapi' || aiProvider === 'openrouter' ? gatewayUrl : '')
      fetchModelsForProvider(aiProvider, apiKey || null, currentUrl)
      setTestResult(null)
    }
  }, [aiProvider, showSetupWizard])

  const handleOpenHistory = (tab) => {
    if (tab === 'secretary_chat' || tab.startsWith('dep_')) {
      selectTab(tab)
      toggleHistorySidebar(tab)
    } else {
      setHistoryTargetTab(tab)
      if (tab.startsWith('proj_')) {
        selectTab(tab)
      }
    }
  }

  useEffect(() => {
    const init = async () => {
      // Load initial state of default workspace
      await loadStatus()
      fetchMessages()
      fetchInbox()
      fetchFiles()
      
      // Load Phase 2 & 3 extra metadata
      const store = useWorkspaceStore.getState()
      await store.fetchApiKeys()
      await store.fetchDepartments()
      await store.fetchProjects()
      await store.fetchWorkflows()
      await store.fetchMcpServers()
      
      setHasCheckedStatus(true)
    }
    init()
  }, [])

  // Reset wizard inputs when setup wizard is opened
  useEffect(() => {
    if (showSetupWizard) {
      setWizardStep(1)
      setCompanyName('')
      setCompanyAim('')
      setApiKey('')
      setTestResult(null)
      setInitLogs([])
    }
  }, [showSetupWizard, wizardMode])

  // Listen for clipboard paste when auth flow is active Ã¢â‚¬â€ auto-fill the key
  useEffect(() => {
    if (!authFlowActive) return
    const handleFocus = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text.trim().length > 8) {
          setApiKey(text.trim())
          setAuthFlowActive(null)
        }
      } catch (e) {
        // clipboard read failed silently Ã¢â‚¬â€ user can paste manually
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [authFlowActive])

  // Determine the effective provider ID sent to backend
  const getEffectiveProvider = () => {
    if (aiProvider === 'cliproxyapi') return 'cliproxyapi'
    if (aiProvider === 'openrouter') return 'openrouter'
    if (aiProvider === 'custom') return 'custom'
    return aiProvider
  }

  // Whether the selected provider needs a gateway URL
  const needsGatewayUrl = aiProvider === 'cliproxyapi' || aiProvider === 'openrouter' || aiProvider === 'custom'

  // Resolve default gateway URL for the selected provider
  const getDefaultGateway = () => {
    if (aiProvider === 'cliproxyapi') return 'http://localhost:8317/v1'
    if (aiProvider === 'openrouter') return 'https://openrouter.ai/api/v1'
    if (aiProvider === 'custom') return customEndpointUrl || ''
    return ''
  }

  // Get the key placeholder
  const getKeyPlaceholder = () => {
    if (aiProvider === 'cliproxyapi') return 'Your CLIProxyAPI config.yaml api-key...'
    if (aiProvider === 'openrouter') return 'sk-or-v1-...'
    if (aiProvider === 'custom') return 'Bearer token or API key...'
    if (aiProvider === 'gemini') return 'AIza...'
    if (aiProvider === 'openai') return 'sk-...'
    if (aiProvider === 'anthropic') return 'sk-ant-...'
    return 'API Key...'
  }

  // Get the key label
  const getKeyLabel = () => {
    if (aiProvider === 'cliproxyapi') return 'CLIProxy API Token'
    if (aiProvider === 'openrouter') return 'OpenRouter API Key'
    if (aiProvider === 'custom') return 'Custom Endpoint API Key'
    return 'AI Provider API Key'
  }

  // Handles Onboarding Save, Key Registration, initial Chat feeding and Wizard Completion
  const handleLaunch = async () => {
    if (!companyName.trim()) return
    if (!apiKey.trim()) {
      alert("Please enter your API key to configure the AI brain.")
      return
    }

    setWizardStep(4)
    setIsInitializing(true)
    
    // Aesthetic simulated boot steps
    const logs = [
      "🚀 Calibrating default AI core connections...",
      "📦 Registering encrypted credentials securely...",
      "🤖 Provisioning Secretary Agent templates...",
      "📁 Preparing local corporate knowledge base..."
    ]

    for (let i = 0; i < logs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800))
      setInitLogs(prev => [...prev, logs[i]])
    }

    let targetWorkspaceId = useWorkspaceStore.getState().workspaceId
    let isNewWorkspace = wizardMode === 'create_workspace'

    if (isNewWorkspace) {
      // 1. Generate workspace ID from name
      const generatedId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      if (!generatedId) {
        alert("Tên công ty không hợp lệ để tạo Workspace ID. Vui lòng chọn tên khác.")
        setWizardStep(1)
        setIsInitializing(false)
        setInitLogs([])
        return
      }
      
      targetWorkspaceId = generatedId

      // 2. Call backend to create workspace
      try {
        const createRes = await fetch('http://localhost:8000/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetWorkspaceId, name: companyName.trim() })
        })
        if (!createRes.ok) {
          const errData = await createRes.json()
          alert(errData.detail || "Không thể khởi tạo workspace mới trên server.")
          setWizardStep(1)
          setIsInitializing(false)
          setInitLogs([])
          return
        }
      } catch (e) {
        alert("Lỗi khi kết nối đến server để tạo workspace.")
        setWizardStep(1)
        setIsInitializing(false)
        setInitLogs([])
        return
      }
    }

    // Resolve the actual URL to persist with the key
    let urlParam = null
    if (aiProvider === 'cliproxyapi') {
      urlParam = gatewayUrl.trim() || 'http://localhost:8317/v1'
    } else if (aiProvider === 'openrouter') {
      urlParam = 'https://openrouter.ai/api/v1'
    } else if (aiProvider === 'custom') {
      urlParam = customEndpointUrl.trim() || null
    }

    const effectiveProvider = getEffectiveProvider()
    
    // Register key for target workspace (could be new workspace ID)
    const keyOk = await registerApiKey(effectiveProvider, apiKey.trim(), urlParam, customModel.trim() || null, targetWorkspaceId)
    
    if (!keyOk) {
      alert("Error saving API Key. Please verify your credentials and try again.")
      setWizardStep(3)
      setIsInitializing(false)
      setInitLogs([])
      return
    }

    // Call Initialize Endpoint to update workspace name, rephrase vision & goals, and save to VISION.md
    setInitLogs(prev => [...prev, "🧠 Refinement process: Invoking AI Strategist to improve Vision & Goals..."])
    try {
      const initRes = await fetch(`http://localhost:8000/api/workspaces/${targetWorkspaceId}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          vision_goals: companyAim.trim()
        })
      })
      if (initRes.ok) {
        setInitLogs(prev => [...prev, "✨ Strategic VISION.md rephrased and saved successfully!"])
      } else {
        setInitLogs(prev => [...prev, "⚠️ VISION.md initialization returned warning (proceeding)."])
      }
    } catch (e) {
      setInitLogs(prev => [...prev, "⚠️ VISION.md creation failed (proceeding)."])
    }

    // If it was a new workspace, set it as the active workspace in store
    if (isNewWorkspace) {
      useWorkspaceStore.getState().setWorkspace(targetWorkspaceId, companyName.trim())
    }

    // Compose custom welcome onboarding message to trigger the Secretary AI
    const welcomePrompt = `Xin chào! Tôi đã hoàn thành thiết lập cơ cấu ban đầu cho startup của mình.
Tên công ty của tôi là: [${companyName.trim()}]
Mục tiêu hoạt động của công ty: [${companyAim.trim()}]

Hãy giúp tôi xây dựng và phác thảo các tài liệu cấu trúc cốt lõi của doanh nghiệp (AIM.md, OPERATIONS.md và FINANCE.md) để bắt đầu vận hành công ty ngay lập tức!`

    // Wait 500ms for state to settle
    await new Promise(resolve => setTimeout(resolve, 500))

    await sendMessage(welcomePrompt)
    
    // Select Secretary Chat tab
    selectTab('secretary_chat')

    // Reload workspace status to trigger complete state
    await loadStatus()
    
    setIsInitializing(false)
    setSetupWizard(false)
  }

  const handleProviderAuth = (providerId) => {
    const target = getProviderAuthTarget(providerId)
    if (!target) return

    setAiProvider(providerId)
    setAuthFlowActive(providerId)
    window.open(target.url, '_blank', 'noopener,noreferrer')
    setTimeout(() => {
      apiKeyInputRef.current?.focus()
    }, 300)
  }

  const handleCliproxyAuth = async (mode) => {
    const target = getCliproxyAuthTarget(mode)
    setAuthFlowActive(mode)
    setCliproxyMode(mode)
    setAiProvider('cliproxyapi')
    setGatewayUrl('http://localhost:8317/v1')

    navigator.clipboard.writeText(target.command).catch(() => {})

    // Call backend to spawn CLI Proxy authentication
    const spawnRes = await spawnCliproxy(mode)
    if (spawnRes && spawnRes.status === 'success') {
      alert(`Đã khởi chạy ứng dụng CLIProxy cho ${target.label} trong cửa sổ terminal mới để bắt đầu xác thực. Hãy tiến hành đăng nhập tại đó.`)
    } else if (spawnRes && spawnRes.status === 'docker_manual') {
      alert(`Ứng dụng Beo đang chạy trong Docker container. Không thể tự động mở terminal trên máy Windows (Host) của bạn.
      
Lệnh đăng nhập đã được sao chép vào Clipboard:
${target.command}

Hãy mở PowerShell / Command Prompt trên máy Windows của bạn, dán lệnh trên và chạy để xác thực!`)
    } else {
      // Fallback: spawn failed
      console.warn("Backend failed to spawn CLI proxy:", spawnRes?.message)
      alert(`Không thể tự động khởi chạy terminal (Lỗi: ${spawnRes?.message || 'Không có phản hồi từ backend'}).
      
Lệnh đăng nhập đã được sao chép vào Clipboard:
${target.command}

Hãy mở PowerShell / Command Prompt trên máy của bạn, dán lệnh trên và chạy để xác thực!`)
      window.open(target.url, '_blank', 'noopener,noreferrer')
    }

    setTimeout(() => {
      apiKeyInputRef.current?.focus()
    }, 300)
  }

  // ======== Provider Data ========

  // Top 4 popular providers (always visible)
  const primaryProviders = [
    { id: 'gemini', name: 'Google Gemini', desc: 'Fast multimodal default engine', icon: SparklesIcon },
    { id: 'openai', name: 'OpenAI', desc: 'GPT-4o reasoning benchmark', icon: CpuIcon },
    { id: 'anthropic', name: 'Anthropic Claude', desc: 'Best-in-class coding & logic', icon: ZapIcon },
    { id: 'openrouter', name: 'OpenRouter', desc: 'Unified multi-model gateway', icon: ServerIcon }
  ]

  // Extended providers (behind divider)
  const extendedProviders = [
    { id: 'cliproxyapi', name: 'CLIProxyAPI', desc: 'Bridge flat-rate CLI subscriptions', icon: TerminalIcon },
    { id: 'custom', name: 'Custom Endpoint', desc: 'Any OpenAI-compatible API', icon: LinkIcon }
  ]

  // CLIProxy sub-modes
  const cliproxySubModes = [
    { 
      id: 'claude_code', 
      name: 'Claude Code', 
      desc: 'Anthropic Claude subscription', 
      cmd: 'cli-proxy-api -claude-login',
      color: 'text-orange-400'
    },
    { 
      id: 'codex', 
      name: 'OpenAI Codex', 
      desc: 'OpenAI flat-rate plan', 
      cmd: 'cli-proxy-api -codex-login',
      color: 'text-emerald-400'
    },
    { 
      id: 'antigravity', 
      name: 'Antigravity (Gemini)', 
      desc: 'Google Gemini CLI subscription', 
      cmd: 'cli-proxy-api -antigravity-login',
      color: 'text-blue-400'
    }
  ]

  // Coordinate display in Main Area (#appBorders) based on activeTab
  const renderMainContent = () => {
    let content;
    
    if (activeTab === 'secretary_chat' || activeTab.includes('_chat_')) {
      content = <ChatPane />
    } else if (activeTab.endsWith('_view')) {
      content = <TeamViewPane department={activeTab.replace('_view', '')} />
    } else if (activeTab.endsWith('_doc')) {
      content = <TeamDocPane department={activeTab.replace('_doc', '')} />
    } else if (activeTab.includes('_view_')) {
      content = <DepartmentViewPane />
    } else if (activeTab === 'inbox') {
      content = <InboxPane />
    } else if (activeTab === 'company_files') {
      content = <FileHubPane />
    } else if (activeTab === 'settings') {
      content = <SettingsPane />
    } else if (activeTab === 'swarms') {
      content = <SwarmPane />
    } else if (activeTab.startsWith('proj_')) {
      content = <ProjectPane />
    } else {
      // Fallback
      content = (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background-base select-none">
          <h2 className="text-2xl font-bold text-content-highlight font-display mb-2 tracking-tight">
            {activeTab.replace('dep_', '').replace('proj_', '').replace('_', ' ').toUpperCase()}
          </h2>
          <p className="text-xs text-content-muted max-w-[320px] leading-relaxed mb-6 font-sans">
            Virtual agent is running in the background.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => useWorkspaceStore.getState().selectTab('secretary_chat')}
              className="px-4 py-2 rounded-lg lava-btn-luxury text-white text-xs font-medium shadow-lg"
            >
              <span>Secretary</span>
            </button>
            <button 
              onClick={() => useWorkspaceStore.getState().selectTab('inbox')}
              className="px-4 py-2 rounded-lg bg-border-muted hover:bg-border-accent/80 border border-border-accent text-content-normal text-xs font-medium transition-colors"
            >
              Inbox
            </button>
          </div>
        </div>
      )
    }

    return (
      <div key={activeTab} className="flex-1 flex flex-col h-full overflow-hidden pane-fade-in">
        {content}
      </div>
    )
  }

  // ======== Provider Card renderer ========
  const ProviderCard = ({ p }) => {
    const isSelected = aiProvider === p.id
    const Icon = p.icon
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => {
          setAiProvider(p.id)
          // Reset gateway to provider default
          if (p.id === 'openrouter') setGatewayUrl('https://openrouter.ai/api/v1')
          else if (p.id === 'cliproxyapi') setGatewayUrl('http://localhost:8317/v1')
          else if (p.id === 'custom') setGatewayUrl('')
          else setGatewayUrl('')
        }}
        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
          isSelected
            ? 'bg-zinc-900 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.06)]'
            : 'bg-zinc-950 border-white/[0.04] hover:border-white/20 hover:bg-zinc-900/50'
        }`}
      >
        <div className="flex items-center gap-2 justify-between">
          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
          {isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
          )}
        </div>
        <div>
          <div className={`text-[11px] font-semibold leading-tight ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
            {p.name}
          </div>
          <div className="text-[9px] text-zinc-500 leading-tight mt-0.5">
            {p.desc}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="w-screen h-screen flex topography-bg text-content-normal overflow-hidden relative">
      
      {/* Left Column: Sidebar (244px) */}
      <Sidebar onOpenHistory={handleOpenHistory} />

      {/* Collapsible History Sidebar (220px) */}
      {showHistorySidebar && <HistorySidebar />}

      {/* Right Column: Main Area (#appBorders) - Rounded premium luxury shadow panel */}
      <main 
        id="appBorders" 
        className="flex-1 glass-pane m-4 ml-1 rounded-3xl overflow-hidden flex flex-col transition-all duration-300"
      >
        {renderMainContent()}
      </main>

      {/* SETUP WIZARD POPUP OVERLAY */}
      {showSetupWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-all duration-500">
          <div className="relative w-full max-w-[540px] max-h-[90vh] bg-zinc-950/90 border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.95)] rounded-2xl overflow-hidden flex flex-col text-left transition-all duration-300">
            <button
              onClick={() => setSetupWizard(false)}
              className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-zinc-400 hover:text-white border border-white/[0.06]"
            >
              {wizardMode === 'create_workspace' ? 'Cancel' : 'Skip for now'}
            </button>

            {/* Liquid Lava gradient light bar at the top */}
            <div className="absolute top-0 left-0 right-0 h-1.5 lava-bg opacity-80 z-10" />

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-8 pb-14">

            {/* Stepper Progress bar */}
            {wizardStep < 4 && (
              <div className="flex items-center justify-between mb-8 text-[11px] font-mono text-zinc-500">
                <span className={`flex items-center gap-1.5 ${wizardStep === 1 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${wizardStep === 1 ? 'border-white bg-white text-black' : 'border-zinc-800'}`}>1</span>
                  Company Name
                </span>
                <div className="flex-1 h-[1px] bg-zinc-800 mx-2" />
                <span className={`flex items-center gap-1.5 ${wizardStep === 2 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${wizardStep === 2 ? 'border-white bg-white text-black' : 'border-zinc-800'}`}>2</span>
                  Vision & Goals
                </span>
                <div className="flex-1 h-[1px] bg-zinc-800 mx-2" />
                <span className={`flex items-center gap-1.5 ${wizardStep === 3 ? 'text-white font-semibold' : 'text-zinc-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${wizardStep === 3 ? 'border-white bg-white text-black' : 'border-zinc-800'}`}>3</span>
                  AI Configuration
                </span>
              </div>
            )}

            {/* STEP 1: Company Name */}
            {wizardStep === 1 && (
              <div className="space-y-6 pane-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white">
                    <BuildingIcon className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-white font-display tracking-tight">
                      {wizardMode === 'create_workspace' ? 'Create New Workspace' : 'Define Startup Name'}
                    </h2>
                    <p className="text-[11px] text-zinc-500 leading-tight">
                      {wizardMode === 'create_workspace' ? 'Establish a brand new company workspace' : 'Establish the core name for your brand'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Startup / Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans"
                      placeholder="e.g., Cyberdyne Systems, Acme Corp..."
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setWizardStep(2)}
                    disabled={!companyName.trim()}
                    className={`px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 border transition-all ${
                      companyName.trim()
                        ? 'bg-white text-black border-white hover:bg-zinc-200 hover:scale-[1.02]'
                        : 'bg-zinc-900 text-zinc-600 border-zinc-800/40 cursor-not-allowed'
                    }`}
                  >
                    Next: Vision & Goals <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Vision & Target Goals */}
            {wizardStep === 2 && (
              <div className="space-y-6 pane-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white">
                    <RocketIcon className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-white font-display tracking-tight">Vision & Target Goals</h2>
                    <p className="text-[11px] text-zinc-500 leading-tight">Outline the main strategic objective and vision for your startup</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Vision / Target Goal</label>
                    <textarea
                      value={companyAim}
                      onChange={(e) => setCompanyAim(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans resize-none"
                      placeholder="e.g., Xây dựng nền tảng SaaS viết bài SEO tự động và đăng lên social media giúp các Solopreneur tự động hóa hoạt động marketing..."
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-between items-center">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2.5 rounded-xl font-medium text-xs text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-900 border border-white/[0.04] hover:border-white/10 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    disabled={!companyAim.trim()}
                    className={`px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 border transition-all ${
                      companyAim.trim()
                        ? 'bg-white text-black border-white hover:bg-zinc-200 hover:scale-[1.02]'
                        : 'bg-zinc-900 text-zinc-600 border-zinc-800/40 cursor-not-allowed'
                    }`}
                  >
                    Next: Configure Brain <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: AI brain configuration — Progressive Disclosure */}
            {wizardStep === 3 && (
              <div className="space-y-5 pane-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white">
                    <CpuIcon className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-white font-display tracking-tight">Configure AI Intelligence</h2>
                    <p className="text-[11px] text-zinc-500 leading-tight">Choose your cognitive default provider & secure keys</p>
                  </div>
                </div>

                {/* PRIMARY 2x2 Grid — 4 most popular providers */}
                <div className="grid grid-cols-2 gap-2">
                  {primaryProviders.map(p => <ProviderCard key={p.id} p={p} />)}
                </div>

                {/* Expandable Divider */}
                <button
                  type="button"
                  onClick={() => setShowMoreProviders(!showMoreProviders)}
                  className="w-full flex items-center gap-3 group cursor-pointer py-1"
                >
                  <div className="flex-1 h-[1px] bg-zinc-800 group-hover:bg-zinc-700 transition-colors" />
                  <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap select-none">
                    {showMoreProviders ? 'Less providers' : 'More providers'}
                    <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${showMoreProviders ? 'rotate-180' : ''}`} />
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-800 group-hover:bg-zinc-700 transition-colors" />
                </button>

                {/* EXTENDED providers — revealed on expand */}
                {showMoreProviders && (
                  <div className="grid grid-cols-2 gap-2 pane-fade-in">
                    {extendedProviders.map(p => <ProviderCard key={p.id} p={p} />)}
                  </div>
                )}

                {/* Selected Provider Sub-configuration — OUTSIDE of showMoreProviders collapse */}
                
                {/* CLIProxyAPI Sub-Modes — only when CLIProxy is selected */}
                {aiProvider === 'cliproxyapi' && (
                  <div className="space-y-2.5 pane-fade-in border-t border-white/[0.04] pt-4">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Select CLI Subscription to Proxy
                    </div>
                    <div className="space-y-1.5">
                      {cliproxySubModes.map(mode => {
                        const isActiveMode = cliproxyMode === mode.id
                        return (
                          <div 
                            key={mode.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                              isActiveMode
                                ? 'bg-zinc-900 border-white/20'
                                : 'bg-zinc-950 border-white/[0.03] hover:border-white/10'
                            }`}
                            onClick={() => setCliproxyMode(mode.id)}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${isActiveMode ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-zinc-700'}`} />
                              <div>
                                <div className={`text-[11px] font-semibold ${isActiveMode ? 'text-white' : 'text-zinc-400'}`}>
                                  {mode.name}
                                </div>
                                <div className="text-[9px] text-zinc-500">{mode.desc}</div>
                              </div>
                            </div>
                            
                            {/* Auth quick-action button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCliproxyAuth(mode.id)
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-mono border transition-all ${
                                authFlowActive === mode.id
                                  ? 'bg-white/10 border-white/30 text-white animate-pulse'
                                  : 'bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/20'
                              }`}
                              title={`Run: ${mode.cmd}`}
                            >
                              {authFlowActive === mode.id ? (
                                <>
                                  <ClipboardPasteIcon className="w-3 h-3" />
                                  <span>Waiting for key...</span>
                                </>
                              ) : (
                                <>
                                  <ExternalLinkIcon className="w-3 h-3" />
                                  <span>Auth</span>
                                </>
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <div className="text-[9px] text-zinc-600 bg-zinc-900/50 rounded-lg px-3 py-2 border border-white/[0.03] font-mono">
                      <span className="text-zinc-400">Tip:</span> Click <span className="text-zinc-300">Auth</span> to copy the login command. Run it in your terminal, complete OAuth, then come back — the key auto-fills.
                    </div>
                  </div>
                )}

                {/* Custom Endpoint URL — only when Custom is selected */}
                {aiProvider === 'custom' && (
                  <div className="space-y-1.5 pane-fade-in border-t border-white/[0.04] pt-4">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Custom API Base URL</label>
                    <div className="relative">
                      <GlobeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={customEndpointUrl}
                        onChange={(e) => {
                          setCustomEndpointUrl(e.target.value)
                          setGatewayUrl(e.target.value)
                        }}
                        className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans"
                        placeholder="https://your-api.example.com/v1"
                      />
                    </div>
                  </div>
                )}

                {/* API Key Input — always visible */}
                <div className="space-y-4 border-t border-white/[0.04] pt-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        {getKeyLabel()}
                      </label>
                      {getProviderAuthTarget(aiProvider) && (
                        <button
                          type="button"
                          onClick={() => handleProviderAuth(aiProvider)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-zinc-300 hover:text-white flex items-center gap-1.5"
                        >
                          <ExternalLinkIcon className="w-3 h-3" />
                          <span>Auth</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <KeyIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        ref={apiKeyInputRef}
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className={`w-full bg-zinc-900 border rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans ${
                          authFlowActive ? 'border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.08)]' : 'border-white/[0.06] focus:border-white/30'
                        }`}
                        placeholder={getKeyPlaceholder()}
                      />
                      {authFlowActive && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400 font-mono animate-pulse">
                          ⌘V to paste
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Gateway URL — for CLIProxy and OpenRouter */}
                  {(aiProvider === 'cliproxyapi' || aiProvider === 'openrouter') && (
                    <div className="space-y-1.5 pane-fade-in">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        {aiProvider === 'openrouter' ? 'OpenRouter Gateway' : 'CLIProxyAPI Gateway URL'}
                      </label>
                      <div className="relative">
                        <GlobeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          value={gatewayUrl}
                          onChange={(e) => setGatewayUrl(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans"
                          placeholder={getDefaultGateway()}
                        />
                      </div>
                    </div>
                  )}

                  {/* Model Name Input — only visible for Custom, OpenRouter, CLIProxyAPI */}
                  {(aiProvider === 'custom' || aiProvider === 'openrouter' || aiProvider === 'cliproxyapi') && (
                    <div className="space-y-3 pt-3 border-t border-white/[0.04] pane-fade-in">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                          Model Name
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const currentUrl = aiProvider === 'custom' ? customEndpointUrl : gatewayUrl
                            fetchModelsForProvider(aiProvider, apiKey.trim() || null, currentUrl)
                          }}
                          disabled={scanningModels}
                          className="text-[9px] font-bold text-zinc-500 hover:text-white font-mono flex items-center gap-1 transition-colors"
                        >
                          {scanningModels ? (
                            <span className="w-2.5 h-2.5 rounded-full border border-t-transparent border-zinc-500 animate-spin"></span>
                          ) : '↻'}
                          <span>{scanningModels ? 'Scanning...' : 'Scan Available Models'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <CpuIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-all font-sans"
                          placeholder={aiProvider === 'custom' ? "e.g., llama3, mixtral-8x7b, etc." : "e.g., gemini-1.5-flash, gpt-4o-mini..."}
                        />
                      </div>

                      {/* Quick Selection Dropdown (scanned models) */}
                      {scannedModels.length > 0 && (
                        <div className="space-y-1.5 pane-fade-in">
                          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                            Quick Select Scanned Model
                          </label>
                          <select
                            value={scannedModels.includes(customModel) ? customModel : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                setCustomModel(e.target.value)
                              }
                            }}
                            className="w-full bg-zinc-900 border border-white/[0.06] focus:border-white/30 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none transition-all font-sans"
                          >
                            <option value="">-- Select from scanned models --</option>
                            {scannedModels.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Connection Test Result Indicator */}
                {testResult && (
                  <div className={`text-xs font-medium flex flex-col gap-1.5 p-4 rounded-xl border animate-fade-in ${
                    testResult.status === 'success' 
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {testResult.status === 'success' ? (
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircleIcon className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.reply && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-black/40 border border-white/[0.04] text-[10px] font-mono text-zinc-400 whitespace-pre-wrap max-h-20 overflow-y-auto">
                        Reply: {testResult.reply}
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="mt-6 flex justify-between items-center gap-3 border-t border-white/[0.04] pt-4">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2.5 rounded-xl font-medium text-xs text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-900 border border-white/[0.04] hover:border-white/10 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={testingConnection || !apiKey.trim()}
                      onClick={handleTestConnection}
                      className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.06] text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all flex items-center gap-1.5"
                    >
                      {testingConnection ? (
                        <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin"></span>
                      ) : (
                        <GlobeIcon className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                      <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      onClick={handleLaunch}
                      disabled={!apiKey.trim()}
                      className={`px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 border transition-all ${
                        apiKey.trim()
                          ? 'lava-btn-luxury text-white border-white/20 hover:border-white/40 shadow-lg'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-800/40 cursor-not-allowed'
                      }`}
                    >
                      <span>Initialize Startup OS</span> <RocketIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Activating OS Log Console */}
            {wizardStep === 4 && (
              <div className="flex flex-col items-center justify-center py-6 text-center select-none pane-fade-in">
                <div className="relative mb-6">
                  <div className="w-14 h-14 rounded-full border-2 border-white/5 border-t-white animate-spin" />
                  <SparklesIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white animate-pulse" />
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 font-display tracking-tight">
                  Activating Startup OS
                </h3>
                <p className="text-[11px] text-zinc-400 max-w-[280px] leading-relaxed mb-6 font-sans">
                  Bootstrapping secure workspaces, loading presets, and dispatching virtual AI staff.
                </p>
                
                <div className="w-full bg-zinc-950/80 border border-white/[0.05] rounded-xl p-4 text-left font-mono text-[10px] space-y-2 text-zinc-500 max-h-[140px] overflow-y-auto">
                  {initLogs.map((log, index) => (
                    <div key={index} className="flex items-center gap-2 text-zinc-300">
                      <CheckIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{log}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-white animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-ping" />
                    <span>Launching Beo Solopreneur OS dashboard...</span>
                  </div>
                </div>
              </div>
            )}

            </div>{/* end scrollable content */}
          </div>
        </div>
      )}

      <CommandPalette />

      <HistoryModal
        isOpen={Boolean(historyTargetTab)}
        targetTab={historyTargetTab}
        messages={chatMessages}
        workflows={workflows}
        onClose={() => setHistoryTargetTab(null)}
      />

    </div>
  )
}
