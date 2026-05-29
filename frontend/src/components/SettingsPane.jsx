import React, { useState, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { getCliproxyAuthTarget, getProviderAuthTarget } from '../utils/authInteractions'
import { 
  KeyIcon, 
  CpuIcon, 
  PlusIcon, 
  ShieldCheckIcon, 
  InfoIcon,
  CheckCircle2Icon,
  XCircleIcon,
  GlobeIcon,
  UserCheckIcon,
  SaveIcon,
  FileTextIcon,
  SparklesIcon,
  ZapIcon,
  ServerIcon,
  TerminalIcon,
  LinkIcon,
  AlertTriangleIcon,
  Trash2Icon
} from 'lucide-react'

export default function SettingsPane() {
  const { 
    apiKeys, 
    apiKeysDetail,
    testApiKey,
    scanApiKeyModels,
    mcpServers, 
    agents,
    agentFiles,
    presets,
    registerApiKey, 
    registerMcpServer, 
    fetchApiKeys, 
    fetchMcpServers,
    fetchAgents,
    fetchAgentFiles,
    saveAgentFile,
    configureAgent,
    fetchPresets,
    spawnCliproxy,
    systemSettings,
    updateSystemSettings,
    deleteWorkspace,
    workspaceName
  } = useWorkspaceStore()

  const handleDeleteCompany = async () => {
    const confirm1 = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn công ty "${workspaceName}"?\nHành động này sẽ xóa toàn bộ API Keys, Agent Blueprints, tài liệu vật lý và lịch sử trò chuyện.`);
    if (!confirm1) return;
    
    const confirm2 = window.prompt(`Để xác nhận xóa, vui lòng nhập chữ "DELETE" vào ô bên dưới:`);
    if (confirm2 !== 'DELETE') {
      alert("Xác nhận không khớp. Hủy bỏ quá trình xóa.");
      return;
    }
    
    const ok = await deleteWorkspace();
    if (ok) {
      alert("Đã xóa công ty và toàn bộ dữ liệu thành công!");
    } else {
      alert("Đã xảy ra lỗi trong quá trình xóa công ty.");
    }
  }

  // System settings state
  const [localCostCap, setLocalCostCap] = useState('5.00')
  const [localLoopLimit, setLocalLoopLimit] = useState(5)
  const [localSandbox, setLocalSandbox] = useState(true)
  const [localApprovalPolicy, setLocalApprovalPolicy] = useState('user')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(null)
  const [settingsError, setSettingsError] = useState(null)

  useEffect(() => {
    if (systemSettings) {
      setLocalCostCap(systemSettings.daily_cost_cap !== undefined ? systemSettings.daily_cost_cap.toString() : '5.00')
      setLocalLoopLimit(systemSettings.loop_guard_limit !== undefined ? systemSettings.loop_guard_limit : 5)
      setLocalSandbox(systemSettings.shell_security_sandbox !== undefined ? systemSettings.shell_security_sandbox : true)
      setLocalApprovalPolicy(systemSettings.approval_policy !== undefined ? systemSettings.approval_policy : 'user')
    }
  }, [systemSettings])

  const handleSaveSystemSettings = async () => {
    setSavingSettings(true)
    setSettingsSuccess(null)
    setSettingsError(null)
    const success = await updateSystemSettings({
      daily_cost_cap: parseFloat(localCostCap) || 5.00,
      loop_guard_limit: parseInt(localLoopLimit) || 5,
      shell_security_sandbox: localSandbox,
      approval_policy: localApprovalPolicy
    })
    setSavingSettings(false)
    if (success) {
      setSettingsSuccess("Cập nhật quy tắc an toàn thành công!")
      setTimeout(() => setSettingsSuccess(null), 3000)
    } else {
      setSettingsError("Lỗi cập nhật cấu hình hệ thống.")
    }
  }

  // Navigation tab
  const [activeSubTab, setActiveSubTab] = useState('keys') // 'keys', 'agents', 'mcp'

  // API Keys state
  const [selectedProvider, setSelectedProvider] = useState('gemini')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [cliproxyUrl, setCliproxyUrl] = useState('http://localhost:8317/v1')
  const [customModel, setCustomModel] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [keyError, setKeyError] = useState(null)
  const [keySuccess, setKeySuccess] = useState(null)
  const [authPending, setAuthPending] = useState(null)
  const [cliproxyMode, setCliproxyMode] = useState('claude_code')
  const apiKeyInputRef = useRef(null)
  
  // Model scanning state
  const [scannedModels, setScannedModels] = useState([])
  const [scanningModels, setScanningModels] = useState(false)
  const [isManualModelInput, setIsManualModelInput] = useState(false)

  // MCP state
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpError, setMcpError] = useState(null)
  const [mcpSuccess, setMcpSuccess] = useState(null)

  // Agent configuration state
  const [selectedAgentRole, setSelectedAgentRole] = useState('secretary')
  const [agentModel, setAgentModel] = useState('gemini/gemini-1.5-flash')
  const [agentIsActive, setAgentIsActive] = useState(true)
  const [agentSkills, setAgentSkills] = useState([])
  const [agentMcpServers, setAgentMcpServers] = useState([])
  const [agentSuccess, setAgentSuccess] = useState(null)
  const [agentError, setAgentError] = useState(null)

  // Agent File Editor state
  const [editingFileType, setEditingFileType] = useState('soul') // 'soul', 'personality'
  const [agentFileContent, setAgentFileContent] = useState('')
  const [agentFileSuccess, setAgentFileSuccess] = useState(null)
  const [agentFileError, setAgentFileError] = useState(null)

  useEffect(() => {
    fetchApiKeys()
    fetchMcpServers()
    fetchAgents()
    fetchPresets()
  }, [])

  useEffect(() => {
    if (!authPending) return
    const handleFocus = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text.trim().length > 8) {
          setApiKeyInput(text.trim())
          setAuthPending(null)
        }
      } catch (e) {
        // Clipboard access can be denied; manual paste still works.
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [authPending])

  const fetchModelsForProvider = async (provider, key, url, fallbackModel = null) => {
    setScanningModels(true)
    try {
      const res = await scanApiKeyModels(provider, key || null, url || null)
      if (res && res.models) {
        setScannedModels(res.models)
        
        // Prioritize:
        // 1. fallbackModel (the model value currently passed by the user or useEffect)
        // 2. saved database model name
        const saved = apiKeysDetail?.find(k => k.provider === provider)
        const savedModelName = fallbackModel || saved?.model || ''
        
        // If there's an active model name, check if it's in the list
        if (savedModelName && res.models.includes(savedModelName)) {
          setCustomModel(savedModelName)
          setIsManualModelInput(false)
        } else if (savedModelName) {
          setCustomModel(savedModelName)
          setIsManualModelInput(true)
        } else if (res.models.length > 0) {
          setCustomModel(res.models[0])
          setIsManualModelInput(false)
        } else {
          setCustomModel('')
          setIsManualModelInput(false)
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

  useEffect(() => {
    if (apiKeysDetail) {
      const saved = apiKeysDetail.find(k => k.provider === selectedProvider)
      let currentUrl = ''
      let currentModel = ''
      if (saved) {
        currentUrl = saved.url || ''
        currentModel = saved.model || ''
        setCliproxyUrl(currentUrl)
        setCustomModel(currentModel)
        setApiKeyInput('••••••••••••••••')
      } else {
        // Reset defaults
        if (selectedProvider === 'cliproxyapi') {
          currentUrl = 'http://localhost:8317/v1'
          currentModel = ''
        } else if (selectedProvider === 'openrouter') {
          currentUrl = 'https://openrouter.ai/api/v1'
          currentModel = ''
        } else if (selectedProvider === 'mimo') {
          currentUrl = 'https://api.xiaomimimo.com/v1'
          currentModel = 'mimo-v2.5-pro'
        } else if (selectedProvider === 'custom') {
          currentUrl = ''
          currentModel = ''
        } else {
          currentUrl = ''
          currentModel = ''
        }
        setCliproxyUrl(currentUrl)
        setCustomModel(currentModel)
        setApiKeyInput('')
      }
      setTestResult(null)
      setIsManualModelInput(false)
      
      // Auto-scan models from the saved provider key on mount or provider select
      fetchModelsForProvider(selectedProvider, null, currentUrl, currentModel)
    }
  }, [selectedProvider, apiKeysDetail])

  // Auto populate agent settings when role changes
  useEffect(() => {
    if (agents && agents.length > 0) {
      const activeAgent = agents.find(a => a.role === selectedAgentRole)
      if (activeAgent) {
        setAgentModel(activeAgent.model || 'gemini/gemini-1.5-flash')
        setAgentIsActive(activeAgent.is_active)
        setAgentSkills(activeAgent.enabled_skills || [])
        setAgentMcpServers(activeAgent.enabled_mcp_servers || [])
      }
    }
    
    // Fetch Agent soul/personality files
    const loadFiles = async () => {
      setAgentFileSuccess(null)
      setAgentFileError(null)
      const data = await fetchAgentFiles(selectedAgentRole)
      if (data) {
        setAgentFileContent(editingFileType === 'soul' ? data.soul : data.personality)
      }
    }
    loadFiles()
  }, [selectedAgentRole, agents])

  // Reload file content when switching file type tab
  useEffect(() => {
    if (agentFiles) {
      setAgentFileContent(editingFileType === 'soul' ? agentFiles.soul : agentFiles.personality)
    }
  }, [editingFileType, agentFiles])

  const handleSaveKey = async (e) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) {
      setKeyError('Please enter an API Key.')
      return
    }
    setKeyError(null)
    setKeySuccess(null)
    setTestResult(null)
    let urlParam = null
    let modelParam = null
    if (selectedProvider === 'cliproxyapi') {
      urlParam = cliproxyUrl.trim() || 'http://localhost:8317/v1'
    } else if (selectedProvider === 'openrouter') {
      urlParam = cliproxyUrl.trim() || 'https://openrouter.ai/api/v1'
    } else if (selectedProvider === 'mimo') {
      urlParam = cliproxyUrl.trim() || 'https://api.xiaomimimo.com/v1'
      modelParam = customModel.trim() || null
    } else if (selectedProvider === 'custom') {
      urlParam = cliproxyUrl.trim() || null
      modelParam = customModel.trim() || null
    }
    const ok = await registerApiKey(selectedProvider, apiKeyInput.trim(), urlParam, modelParam)
    if (ok) {
      setKeySuccess(`API Key for ${selectedProvider.toUpperCase()} saved successfully!`)
      setApiKeyInput('')
      fetchApiKeys()
    } else {
      setKeyError('Failed to save API Key.')
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    setKeyError(null)
    setKeySuccess(null)
    
    let urlParam = null
    let modelParam = null
    if (selectedProvider === 'cliproxyapi') {
      urlParam = cliproxyUrl.trim() || 'http://localhost:8317/v1'
    } else if (selectedProvider === 'openrouter') {
      urlParam = cliproxyUrl.trim() || 'https://openrouter.ai/api/v1'
    } else if (selectedProvider === 'mimo') {
      urlParam = cliproxyUrl.trim() || 'https://api.xiaomimimo.com/v1'
      modelParam = customModel.trim() || null
    } else if (selectedProvider === 'custom') {
      urlParam = cliproxyUrl.trim() || null
      modelParam = customModel.trim() || null
    }
    
    const res = await testApiKey(selectedProvider, apiKeyInput.trim() || null, urlParam, modelParam)
    setTestingConnection(false)
    setTestResult(res)

    if (res && res.status === 'success') {
      fetchModelsForProvider(selectedProvider, apiKeyInput.trim(), urlParam, customModel)
    }
  }

  const handleProviderAuth = async () => {
    if (selectedProvider === 'cliproxyapi') {
      const target = getCliproxyAuthTarget(cliproxyMode)
      navigator.clipboard.writeText(target.command).catch(() => {})
      setAuthPending('cliproxyapi')
      setCliproxyUrl('http://localhost:8317/v1')

      // Call backend to spawn CLI Proxy authentication
      const spawnRes = await spawnCliproxy(cliproxyMode)
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
    } else {
      const target = getProviderAuthTarget(selectedProvider)
      if (!target) return
      window.open(target.url, '_blank', 'noopener,noreferrer')
      setAuthPending(selectedProvider)
    }

    setTimeout(() => {
      apiKeyInputRef.current?.focus()
    }, 300)
  }

  const handleSaveMcp = async (e) => {
    e.preventDefault()
    if (!mcpName.trim() || !mcpUrl.trim()) {
      setMcpError('Please fill in both Name and URL fields.')
      return
    }
    setMcpError(null)
    setMcpSuccess(null)
    const ok = await registerMcpServer(mcpName.trim(), mcpUrl.trim())
    if (ok) {
      setMcpSuccess(`MCP Server registered successfully: ${mcpName}!`)
      setMcpName('')
      setMcpUrl('')
      fetchMcpServers()
    } else {
      setMcpError('Failed to register MCP Server.')
    }
  }

  const handleSaveAgentConfig = async () => {
    setAgentSuccess(null)
    setAgentError(null)
    const ok = await configureAgent(selectedAgentRole, {
      model: agentModel,
      is_active: agentIsActive,
      enabled_skills: agentSkills,
      enabled_mcp_servers: agentMcpServers
    })
    if (ok) {
      setAgentSuccess(`Agent ${selectedAgentRole.toUpperCase()} configured successfully!`)
      fetchAgents()
    } else {
      setAgentError('Failed to save agent configuration.')
    }
  }

  const handleSaveAgentFileContent = async () => {
    setAgentFileSuccess(null)
    setAgentFileError(null)
    const ok = await saveAgentFile(selectedAgentRole, editingFileType, agentFileContent)
    if (ok) {
      setAgentFileSuccess(`Updated ${editingFileType.toUpperCase()} file successfully!`)
    } else {
      setAgentFileError('Failed to save file content.')
    }
  }

  const handleToggleSkill = (skillId) => {
    if (agentSkills.includes(skillId)) {
      setAgentSkills(agentSkills.filter(s => s !== skillId))
    } else {
      setAgentSkills([...agentSkills, skillId])
    }
  }

  const handleToggleMcp = (mcpId) => {
    if (agentMcpServers.includes(mcpId)) {
      setAgentMcpServers(agentMcpServers.filter(m => m !== mcpId))
    } else {
      setAgentMcpServers([...agentMcpServers, mcpId])
    }
  }

  const availableProviders = [
    { id: 'gemini', name: 'Google Gemini AI', desc: 'Default model for Beo OS', icon: SparklesIcon },
    { id: 'openai', name: 'OpenAI GPT-4', desc: 'Logic and coding engine', icon: CpuIcon },
    { id: 'anthropic', name: 'Anthropic Claude 3.5', desc: 'Writing and planning engine', icon: ZapIcon },
    { id: 'mimo', name: 'Xiaomi MiMo', desc: 'Reasoning and flagship models', icon: SparklesIcon },
    { id: 'openrouter', name: 'OpenRouter', desc: 'Unified multi-model gateway', icon: ServerIcon },
    { id: 'cohere', name: 'Cohere API', desc: 'Dynamic RAG lookup API', icon: GlobeIcon },
    { id: 'groq', name: 'Groq Cloud', desc: 'High-speed inference API', icon: CpuIcon },
    { id: 'cliproxyapi', name: 'CLIProxyAPI', desc: 'Local CLI proxy gateway', icon: TerminalIcon },
    { id: 'custom', name: 'Custom Endpoint', desc: 'OpenAI-compatible API base', icon: LinkIcon }
  ]


  const defaultSkills = [
    { id: 'read_file', name: 'Read Files', desc: 'Allows agent to scan workspace documents' },
    { id: 'write_file', name: 'Write/Edit Files', desc: 'Allows agent to create and update files' },
    { id: 'run_command', name: 'Execute Shell', desc: 'Allows agent to run terminal commands' },
    { id: 'send_email', name: 'Send Emails', desc: 'Allows agent to generate client emails' }
  ]

  const modelOptions = [
    { id: 'gemini/gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'ollama/llama3', name: 'Ollama Llama 3 (Local)' }
  ]

  const dynamicModelOptions = [
    ...modelOptions,
    ...apiKeysDetail.filter(k => k.model).map(k => ({
      id: `${k.provider}/${k.model}`,
      name: `${k.provider.toUpperCase()} (Custom): ${k.model}`
    }))
  ]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative pt-20">
      
      {/* FLOATING HEADER TABS (No title header, floating with glassmorphism & smooth edges) */}
      <div className="absolute top-4 left-6 right-6 z-40 flex justify-center pointer-events-none select-none">
        <div className="flex bg-background-card/80 backdrop-blur-md border border-white/[0.06] rounded-2xl p-1.5 font-sans text-xs shadow-2xl pointer-events-auto">
          <button
            onClick={() => setActiveSubTab('keys')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
              activeSubTab === 'keys' 
                ? 'bg-border-muted text-content-highlight shadow-lg scale-105' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            API Keys & Limits
          </button>
          <button
            onClick={() => setActiveSubTab('agents')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
              activeSubTab === 'agents' 
                ? 'bg-border-muted text-content-highlight shadow-lg scale-105' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            AI Staff Customizer
          </button>
          <button
            onClick={() => setActiveSubTab('mcp')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
              activeSubTab === 'mcp' 
                ? 'bg-border-muted text-content-highlight shadow-lg scale-105' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            MCP Gateways
          </button>
        </div>
      </div>

      {/* Pane Content View (Expanded Max Width to Full/None and increased padding to take maximum dashboard space) */}
      <div className="flex-1 overflow-y-auto p-10 w-full mx-auto select-text font-sans mt-2">
        
        {/* TAB 1: API KEYS & LIMITS */}
        {activeSubTab === 'keys' && (
          <div className="space-y-8 animate-fade-in">
            {/* API Keys Configuration */}
            <section className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <KeyIcon className="w-4 h-4 text-white" />
                <h2 className="text-xs font-bold text-content-highlight font-display uppercase tracking-wider">
                  LLM Cloud Providers
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-6">
                
                {/* Form to Save Key */}
                <div className="space-y-6">

                  {selectedProvider === 'cliproxyapi' && (
                    <div className="flex flex-col gap-2 animate-fade-in">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                        CLI Subscription Proxy Mode
                      </label>
                      <select
                          value={cliproxyMode}
                          onChange={(e) => setCliproxyMode(e.target.value)}
                          className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 transition-all duration-300 font-sans shadow-sm"
                      >
                        <option value="claude_code">Claude Code (Anthropic CLI)</option>
                        <option value="codex">OpenAI Codex (ChatGPT CLI)</option>
                        <option value="antigravity">Antigravity (Gemini CLI)</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                        API Credential Key
                      </label>
                      {(selectedProvider === 'cliproxyapi' || getProviderAuthTarget(selectedProvider)) && (
                        <button
                          type="button"
                          onClick={handleProviderAuth}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-content-normal flex items-center gap-1.5"
                        >
                          <GlobeIcon className="w-3 h-3" />
                          <span>{authPending ? 'Waiting' : 'Auth'}</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={apiKeyInputRef}
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onFocus={(e) => {
                        if (apiKeyInput.startsWith('•')) {
                          e.target.select()
                        }
                      }}
                      autoComplete="new-password"
                      placeholder="Paste secret API key..."
                      className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 transition-all duration-300 font-mono shadow-sm"
                    />
                  </div>

                  {(selectedProvider === 'cliproxyapi' || selectedProvider === 'openrouter' || selectedProvider === 'custom' || selectedProvider === 'mimo') && (
                    <div className="flex flex-col gap-2 animate-fade-in">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                        {selectedProvider === 'openrouter' ? 'OpenRouter Gateway URL' : selectedProvider === 'custom' ? 'Custom API Base URL' : selectedProvider === 'mimo' ? 'MiMo API Base URL' : 'CLIProxyAPI Gateway URL'}
                      </label>
                      <input
                        type="text"
                        value={cliproxyUrl}
                        onChange={(e) => setCliproxyUrl(e.target.value)}
                        placeholder={selectedProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : selectedProvider === 'custom' ? 'https://your-api.example.com/v1' : selectedProvider === 'mimo' ? 'https://api.xiaomimimo.com/v1' : 'http://localhost:8317/v1'}
                        className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 transition-all duration-300 font-mono shadow-sm"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-4 animate-fade-in border-t border-white/[0.04] pt-4">
                    {/* Model Name Input Field (always visible) */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                          Model Name
                        </label>
                        <button
                          type="button"
                          onClick={() => fetchModelsForProvider(selectedProvider, apiKeyInput.trim(), selectedProvider === 'cliproxyapi' || selectedProvider === 'openrouter' || selectedProvider === 'custom' || selectedProvider === 'mimo' ? cliproxyUrl.trim() : null, customModel)}
                          disabled={scanningModels}
                          className="text-[9px] font-bold text-content-muted hover:text-content-highlight font-mono flex items-center gap-1 transition-colors"
                        >
                          {scanningModels ? (
                            <span className="w-2.5 h-2.5 rounded-full border border-t-transparent border-content-muted animate-spin"></span>
                          ) : '↻'}
                          <span>{scanningModels ? 'Scanning...' : 'Scan Available Models'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="e.g. gpt-4o, gemini-1.5-flash, etc."
                        className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 transition-all duration-300 font-mono shadow-sm"
                      />
                    </div>

                    {/* Quick Selection Dropdown (scanned models) */}
                    {scannedModels.length > 0 && (
                      <div className="flex flex-col gap-2 animate-fade-in">
                        <label className="text-[9px] font-bold text-content-muted uppercase tracking-wider font-mono">
                          Quick Select Scanned Model
                        </label>
                        <select
                          value={scannedModels.includes(customModel) ? customModel : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              setCustomModel(e.target.value)
                            }
                          }}
                          className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 transition-all duration-300 font-sans shadow-sm text-left"
                        >
                          <option value="">-- Select from scanned models --</option>
                          {scannedModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {keyError && (
                    <div className="text-xs text-accent-danger font-medium flex items-center gap-1.5 animate-fade-in">
                      <XCircleIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{keyError}</span>
                    </div>
                  )}

                  {keySuccess && (
                    <div className="text-xs text-white font-medium flex items-center gap-1.5 animate-fade-in border border-white/20 px-3 py-1.5 rounded-xl bg-white/5">
                      <CheckCircle2Icon className="w-3.5 h-3.5 text-white" />
                      <span>{keySuccess}</span>
                    </div>
                  )}

                  {testResult && (
                    <div className={`text-xs font-medium flex flex-col gap-1.5 p-4 rounded-2xl border animate-fade-in ${
                      testResult.status === 'success' 
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {testResult.status === 'success' ? (
                          <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircleIcon className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                      {testResult.reply && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.04] text-[10px] font-mono text-content-muted whitespace-pre-wrap max-h-24 overflow-y-auto">
                          Reply: {testResult.reply}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleSaveKey}
                      className="px-6 py-3.5 rounded-2xl bg-white hover:bg-zinc-200 hover:scale-[1.02] text-black text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300"
                    >
                      <PlusIcon className="w-3.5 h-3.5 text-black" />
                      <span>Save Key</span>
                    </button>
                    
                    <button
                      type="button"
                      disabled={testingConnection}
                      onClick={handleTestConnection}
                      className="px-6 py-3.5 rounded-2xl bg-zinc-800 border border-white/10 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-300"
                    >
                      {testingConnection ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin"></span>
                      ) : (
                        <GlobeIcon className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>
                </div>

                {/* Configurations Checklist */}
                <div className="space-y-3.5 text-left">
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono block">
                    Cloud AI Providers
                  </label>
                  
                  <div className="space-y-2.5">
                    {availableProviders.map(provider => {
                      const isSaved = apiKeys.includes(provider.id)
                      const isSelected = selectedProvider === provider.id
                      const Icon = provider.icon
                      return (
                        <button 
                          key={provider.id} 
                          type="button"
                          onClick={() => setSelectedProvider(provider.id)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 cursor-pointer ${
                            isSelected 
                              ? 'bg-white/5 border-white/30 shadow-[0_4px_16px_rgba(255,255,255,0.06)] scale-[1.01]' 
                              : isSaved
                                ? 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                                : 'bg-border-muted/10 border-border-muted/20 hover:border-white/10 hover:bg-white/[0.01]'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden text-left">
                            <div className={`p-2 rounded-xl shrink-0 border ${
                              isSelected 
                                ? 'bg-white/10 border-white/20 text-white' 
                                : 'bg-white/[0.02] border-white/[0.05] text-content-muted'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              <span className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-content-highlight'}`}>
                                {provider.name}
                              </span>
                              <span className="text-[9px] text-content-muted truncate">
                                {provider.desc}
                              </span>
                            </div>
                          </div>
                          
                          {isSaved ? (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-2xl bg-white/10 text-white font-mono text-[9px] font-bold border border-white/20">
                              <ShieldCheckIcon className="w-3 h-3 text-white" />
                              Configured
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-2xl bg-border-muted text-content-muted font-mono text-[9px] border border-border-accent/10">
                              Not Set
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </section>

            {/* Cost Limits Card */}
            <section className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="flex items-center gap-2 mb-4">
                <CpuIcon className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold text-content-highlight font-display uppercase tracking-wide">
                  Budget Cap & Safety Rules
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-border-muted/10 border border-border-muted/20 rounded-2xl flex flex-col gap-2.5 text-left shadow-sm">
                  <span className="text-[9px] text-content-muted uppercase tracking-wider font-mono">Loop Guard</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-content-highlight">Active Limit:</span>
                    <input 
                      type="number" 
                      value={localLoopLimit} 
                      onChange={(e) => setLocalLoopLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-background-sidebar border border-border-muted/30 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-border-accent/80 font-mono text-center"
                    />
                  </div>
                  <span className="text-[10px] text-content-muted leading-normal font-sans">
                    Automatically suspends any agent stuck in logical loops to save API resources.
                  </span>
                </div>

                <div className="p-6 bg-border-muted/10 border border-border-muted/20 rounded-2xl flex flex-col gap-2.5 text-left shadow-sm">
                  <span className="text-[9px] text-content-muted uppercase tracking-wider font-mono">Shell Security</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-content-highlight">Policy:</span>
                    <button 
                      type="button"
                      onClick={() => setLocalSandbox(!localSandbox)}
                      className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold font-mono transition-all duration-300 ${
                        localSandbox 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                      }`}
                    >
                      {localSandbox ? 'STRICT SANDBOXED' : 'UNRESTRICTED BYPASS'}
                    </button>
                  </div>
                  <span className="text-[10px] text-content-muted leading-normal font-sans">
                    Flags harmful patterns (`rm -rf`, `shutdown`) directly to High Risk in your Inbox.
                  </span>
                </div>

                <div className="p-6 bg-border-muted/10 border border-border-muted/20 rounded-2xl flex flex-col gap-2.5 relative overflow-hidden text-left shadow-sm">
                  <span className="text-[9px] text-content-muted uppercase tracking-wider font-mono">Daily Cost Cap</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-content-highlight">Spend Limit:</span>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-content-muted font-mono">$</span>
                      <input 
                        type="text" 
                        value={localCostCap} 
                        onChange={(e) => setLocalCostCap(e.target.value)}
                        placeholder="5.00"
                        className="w-24 bg-background-sidebar border border-border-muted/30 rounded-xl pl-6 pr-3 py-1.5 text-xs text-white outline-none focus:border-border-accent/80 font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-content-muted font-mono">USD/day</span>
                  </div>
                  <span className="text-[10px] text-content-muted leading-normal flex items-start gap-1 font-sans">
                    <InfoIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <span>
                      Synchronized inside `FINANCE.md` (Company Documents) to match fiscal guidelines.
                    </span>
                  </span>
                </div>

                <div className="p-6 bg-border-muted/10 border border-border-muted/20 rounded-2xl flex flex-col gap-2.5 text-left shadow-sm">
                  <span className="text-[9px] text-content-muted uppercase tracking-wider font-mono">Approval Policy</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-content-highlight">Flow:</span>
                    <select
                      value={localApprovalPolicy}
                      onChange={(e) => setLocalApprovalPolicy(e.target.value)}
                      className="bg-background-sidebar border border-border-muted/30 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-border-accent/80 font-sans"
                    >
                      <option value="user">Founder Review (Manual)</option>
                      <option value="auto">Auto Approve Actions</option>
                      <option value="secretary">Secretary Delegation</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-content-muted leading-normal font-sans">
                    Choose whether AI actions execute automatically, require Secretary clearance, or wait for manual sign-off.
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex-1 mr-4">
                  {settingsSuccess && (
                    <span className="text-xs text-white font-semibold flex items-center gap-1.5 animate-fade-in border border-white/20 px-3 py-1.5 rounded-xl bg-white/5 w-fit">
                      <CheckCircle2Icon className="w-3.5 h-3.5 text-white" />
                      {settingsSuccess}
                    </span>
                  )}
                  {settingsError && (
                    <span className="text-xs text-accent-danger font-semibold flex items-center gap-1.5 animate-fade-in">
                      <XCircleIcon className="w-3.5 h-3.5 text-zinc-500" />
                      {settingsError}
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={handleSaveSystemSettings}
                  disabled={savingSettings}
                  className="px-6 py-3 rounded-2xl bg-white hover:bg-zinc-200 hover:scale-[1.02] text-black text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSettings ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-black animate-spin"></span>
                  ) : (
                    <SaveIcon className="w-3.5 h-3.5 text-black" />
                  )}
                  <span>{savingSettings ? 'Saving...' : 'Save Safety Rules'}</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: AI AGENTS STAFF CUSTOMIZER */}
        {activeSubTab === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-fade-in">
            
            {/* Roles Sidebar selection */}
            <div className="md:col-span-1 bg-background-sidebar border border-border-muted/30 rounded-3xl p-4 flex flex-col space-y-2 max-h-[600px] overflow-y-auto shadow-md select-none">
              <span className="text-[9px] font-bold text-content-muted uppercase tracking-wider font-mono p-2 block text-left">
                Select Agent
              </span>
              {(agents && agents.length > 0 ? agents.map(a => a.role) : ['secretary', 'coo', 'cto', 'cmo', 'cfo', 'cpo']).map(role => {
                const isSelected = selectedAgentRole === role
                const agentObj = agents?.find(a => a.role === role)
                const displayName = agentObj?.name || role
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedAgentRole(role)}
                    className={`w-full text-left flex items-center gap-3 px-4.5 py-3.5 rounded-2xl text-xs font-bold uppercase transition-all duration-300 ${
                      isSelected 
                        ? 'bg-border-muted text-content-highlight shadow-md scale-105' 
                        : 'text-content-muted hover:text-content-normal hover:bg-border-muted/10 hover:translate-x-1'
                    }`}
                  >
                    <UserCheckIcon className="w-3.5 h-3.5 text-content-muted" />
                    <span className="truncate">{displayName}</span>
                  </button>
                )
              })}
            </div>

            {/* Agent Settings Panel */}
            <div className="md:col-span-3 space-y-8">
              
              <div className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-left">
                
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-border-muted/20 pb-4 mb-6 select-none">
                  <div>
                    <h3 className="text-sm font-bold text-content-highlight uppercase tracking-wide font-display flex items-center gap-1.5">
                      <SparklesIcon className="w-4 h-4 text-white" />
                      Agent Profile: {agents?.find(a => a.role === selectedAgentRole)?.name || selectedAgentRole}
                    </h3>
                    <p className="text-[10px] text-content-muted mt-0.5">
                      Configure workspace model options, skills allocations, and system permissions.
                    </p>
                  </div>
                  
                  {/* Status Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-semibold text-content-muted">Active status:</span>
                    <input 
                      type="checkbox" 
                      checked={agentIsActive} 
                      onChange={(e) => setAgentIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-border-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white/30 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {/* Forms grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Model & General */}
                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                        Model Engine
                      </label>
                      <select
                        value={agentModel}
                        onChange={(e) => setAgentModel(e.target.value)}
                        className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-4 text-xs text-content-normal outline-none focus:border-border-accent/80 font-sans shadow-sm transition-all duration-300"
                      >
                        {dynamicModelOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Presets MCP options */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                        Authorized MCP Gateways
                      </label>
                      <div className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-4 space-y-2.5 h-[160px] overflow-y-auto shadow-sm">
                        {mcpServers && mcpServers.length > 0 ? (
                          mcpServers.map(server => {
                            const isChecked = agentMcpServers.includes(server.name)
                            return (
                              <label key={server.id} className="flex items-center gap-2 text-xs text-content-normal cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => handleToggleMcp(server.name)}
                                  className="rounded border-border-muted text-white bg-background-base focus:ring-0"
                                />
                                <span className="font-mono text-[11px]">{server.name}</span>
                              </label>
                            )
                          })
                        ) : (
                          <span className="text-[10px] text-content-muted italic block py-6 text-center">
                            No MCP servers configured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skills Select (Height Expanded to 260px) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                      Granted Skills / Permissions
                    </label>
                    <div className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-4 space-y-3.5 flex-1 h-[260px] overflow-y-auto shadow-sm">
                      {(presets?.skills?.length > 0 ? presets.skills : defaultSkills).map(skill => {
                        const isChecked = agentSkills.includes(skill.id)
                        return (
                          <label 
                            key={skill.id} 
                            className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-border-muted/15 cursor-pointer text-xs text-content-normal select-none"
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => handleToggleSkill(skill.id)}
                              className="mt-0.5 rounded border-border-muted text-white bg-background-base focus:ring-0"
                            />
                            <div className="flex flex-col gap-0.5 text-left">
                              <span className="font-semibold text-content-highlight">{skill.name || skill.id}</span>
                              <span className="text-[10px] text-content-muted leading-tight">{skill.desc}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                </div>

                {/* Save configs buttons */}
                <div className="mt-6 border-t border-border-muted/20 pt-4 flex items-center justify-between select-none">
                  <div className="flex-1 mr-4">
                    {agentSuccess && <span className="text-xs text-white font-semibold">{agentSuccess}</span>}
                    {agentError && <span className="text-xs text-accent-danger font-semibold">{agentError}</span>}
                  </div>
                  <button
                    onClick={handleSaveAgentConfig}
                    className="px-6 py-3.5 rounded-2xl bg-white hover:bg-zinc-200 hover:scale-[1.02] text-black text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <SaveIcon className="w-3.5 h-3.5 text-black" />
                    <span>Save Config</span>
                  </button>
                </div>

              </div>

              {/* Agent Markdown Editor (Height expanded to a spacious 420px) */}
              <div className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-left">
                
                {/* Editor Header Navigation */}
                <div className="flex items-center justify-between border-b border-border-muted/20 pb-4 mb-4 select-none">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="w-4 h-4 text-content-muted" />
                    <h3 className="text-xs font-bold text-content-muted uppercase tracking-wider font-mono">
                      Edit Agent Blueprint
                    </h3>
                  </div>

                  <div className="flex bg-background-base border border-border-muted/30 rounded-xl p-0.5 font-mono text-[10px] shadow-sm">
                    <button
                      onClick={() => setEditingFileType('soul')}
                      className={`px-4 py-2 rounded-lg font-bold transition-all duration-300 ${
                        editingFileType === 'soul' 
                          ? 'bg-border-muted text-content-highlight shadow-sm' 
                          : 'text-content-muted hover:text-content-normal'
                      }`}
                    >
                      SOUL.md
                    </button>
                    <button
                      onClick={() => setEditingFileType('personality')}
                      className={`px-4 py-2 rounded-lg font-bold transition-all duration-300 ${
                        editingFileType === 'personality' 
                          ? 'bg-border-muted text-content-highlight shadow-sm' 
                          : 'text-content-muted hover:text-content-normal'
                      }`}
                    >
                      PERSONALITY.md
                    </button>
                  </div>
                </div>

                {/* Textarea Workspace (Height expanded to a spacious 420px) */}
                <div className="border border-border-muted/30 rounded-2xl overflow-hidden bg-background-sidebar h-[420px] shadow-inner mb-5">
                  <textarea
                    value={agentFileContent}
                    onChange={(e) => setAgentFileContent(e.target.value)}
                    placeholder={`Write your agent's ${editingFileType.toUpperCase()} settings in markdown...`}
                    className="w-full h-full p-6 bg-background-sidebar text-content-normal font-mono text-xs outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between select-none">
                  <div className="flex-1 mr-4">
                    {agentFileSuccess && <span className="text-xs text-white font-semibold">{agentFileSuccess}</span>}
                    {agentFileError && <span className="text-xs text-accent-danger font-semibold">{agentFileError}</span>}
                  </div>
                  
                  <button
                    onClick={handleSaveAgentFileContent}
                    className="px-6 py-3.5 rounded-2xl bg-zinc-800 border border-border-accent/40 text-content-highlight hover:bg-zinc-700 hover:border-zinc-600 hover:scale-[1.02] text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <SaveIcon className="w-3.5 h-3.5" />
                    <span>Save {editingFileType.toUpperCase()}</span>
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 3: MODEL CONTEXT PROTOCOL (MCP) GATEWAYS */}
        {activeSubTab === 'mcp' && (
          <div className="space-y-8 animate-fade-in">
            <section className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="flex items-center gap-2 mb-4">
                <GlobeIcon className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold text-content-highlight font-display uppercase tracking-wide">
                  MCP Gateway Hub
                </h2>
              </div>
              
              <p className="text-xs text-content-muted leading-relaxed mb-6 font-sans">
                Register outer server ports simulating the Model Context Protocol (MCP). Connected servers extend the tools array, allowing agents to manipulate Slack, Stripe, Google Drive, or custom APIs.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Form to add server */}
                <form onSubmit={handleSaveMcp} className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                      Server name (lowercase)
                    </label>
                    <input
                      type="text"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                      placeholder="e.g., slack-connector"
                      className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 font-mono shadow-sm transition-all duration-300"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                      JSON-RPC Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={mcpUrl}
                      onChange={(e) => setMcpUrl(e.target.value)}
                      placeholder="e.g., http://localhost:8500/rpc"
                      className="bg-background-sidebar border border-border-muted/30 rounded-2xl p-3.5 text-xs text-content-normal outline-none focus:border-border-accent/80 font-mono shadow-sm transition-all duration-300"
                    />
                  </div>

                  {mcpError && (
                    <div className="text-xs text-accent-danger font-medium flex items-center gap-1.5 animate-fade-in">
                      <XCircleIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{mcpError}</span>
                    </div>
                  )}

                  {mcpSuccess && (
                    <div className="text-xs text-white font-medium flex items-center gap-1.5 animate-fade-in border border-white/20 px-3 py-1.5 rounded-xl bg-white/5">
                      <CheckCircle2Icon className="w-3.5 h-3.5 text-white" />
                      <span>{mcpSuccess}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-3.5 rounded-2xl bg-white hover:bg-zinc-200 hover:scale-[1.02] text-black text-xs font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <PlusIcon className="w-3.5 h-3.5 text-black" />
                    <span>Register Server</span>
                  </button>
                </form>

                {/* Configured MCP Gateways list */}
                <div className="space-y-3.5 text-left">
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono block">
                    Configured Servers
                  </label>

                  <div className="space-y-3">
                    {mcpServers && mcpServers.length > 0 ? (
                      mcpServers.map(server => (
                        <div 
                          key={server.id} 
                          className="p-4 bg-border-muted/10 border border-border-muted/20 rounded-2xl flex items-center justify-between text-xs transition-all duration-300 hover:bg-border-muted/15"
                        >
                          <div className="flex flex-col gap-0.5 text-left">
                            <span className="font-bold text-content-highlight font-mono">{server.name}</span>
                            <span className="text-[9px] text-content-muted font-mono">{server.url}</span>
                          </div>
                          
                          <span className={`px-3 py-1 rounded-2xl font-mono text-[9px] font-bold border capitalize ${
                            server.status === 'connected' 
                              ? 'bg-white/10 text-white border-white/20 shadow-sm' 
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}>
                            {server.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 bg-border-muted/5 border border-border-muted/10 rounded-2xl text-center text-xs text-content-muted italic">
                        No MCP servers configured yet. Defaulting to local sandbox tools.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* SKILL & MCP PRESETS MARKETPLACE */}
            <section className="bg-background-card border border-border-muted/30 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-left">
              <div className="flex items-center justify-between mb-4 border-b border-border-muted/20 pb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-white animate-pulse" />
                  <h2 className="text-sm font-bold text-content-highlight font-display uppercase tracking-wide">
                    Kho lưu trữ Skill & MCP (Preset Connectors)
                  </h2>
                </div>
                <span className="text-[10px] bg-white/5 border border-white/10 text-content-muted font-mono px-2.5 py-1 rounded-full">
                  Click to Auto-Activate
                </span>
              </div>
              
              <p className="text-xs text-content-muted leading-relaxed mb-6 font-sans">
                Kích hoạt nhanh các kỹ năng và cổng kết nối nâng cao được định hình sẵn. Click "Kích hoạt" để tích hợp ngay lập tức các cổng kết nối này vào hệ thống Agent của bạn mà không cần cài đặt phức tạp.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {presets?.mcp_servers?.map(preset => {
                  const isRegistered = mcpServers?.some(s => s.name === preset.key)
                  
                  return (
                    <div 
                      key={preset.key} 
                      className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                        isRegistered 
                          ? 'bg-emerald-950/10 border-emerald-500/20 opacity-80' 
                          : 'bg-border-muted/10 border-border-muted/20 hover:border-white/20 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-content-highlight font-mono">
                            {preset.name}
                          </span>
                          {isRegistered ? (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/[0.04]">
                              AVAILABLE
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-content-muted leading-relaxed min-h-[48px]">
                          {preset.description}
                        </p>

                        {/* List preset tools */}
                        {preset.tools && preset.tools.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-white/[0.04]">
                            <span className="text-[8px] font-bold text-content-muted uppercase tracking-wider font-mono block">
                              Granted Tools ({preset.tools.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {preset.tools.map(t => (
                                <span 
                                  key={t.name} 
                                  title={t.description} 
                                  className="text-[9px] font-mono bg-white/5 hover:bg-white/10 text-content-normal px-2 py-0.5 rounded-md border border-white/[0.04] transition-colors"
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                        <span className="text-[9px] text-content-muted font-mono">
                          {preset.default_url}
                        </span>
                        
                        <button
                          type="button"
                          disabled={isRegistered}
                          onClick={async () => {
                            const ok = await registerMcpServer(preset.key, preset.default_url);
                            if (ok) {
                              alert(`Kích hoạt thành công cổng kết nối ${preset.name}!`);
                              fetchMcpServers();
                            } else {
                              alert(`Không thể tự động kích hoạt ${preset.name}.`);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[10px] transition-all duration-300 ${
                            isRegistered 
                              ? 'bg-transparent text-emerald-400 border border-emerald-500/20 cursor-not-allowed' 
                              : 'bg-white hover:bg-zinc-200 text-black hover:scale-[1.02]'
                          }`}
                        >
                          {isRegistered ? 'Đã Kích Hoạt' : 'Kích hoạt'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* Danger Zone: Permanent Delete Company */}
        <div className="mt-12 pt-8 border-t border-dashed border-rose-500/20 text-left">
          <div className="bg-rose-950/5 border border-dashed border-rose-500/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-400 font-display uppercase tracking-wider flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-rose-500 animate-pulse" />
                Danger Zone - Vùng Nguy Hiểm
              </h3>
              <p className="text-xs text-content-muted leading-relaxed max-w-2xl">
                Xóa vĩnh viễn toàn bộ dữ liệu của công ty <strong>"{workspaceName}"</strong> bao gồm khóa API, cấu hình AI Agents, tệp tin nội bộ, các Blueprints (SOUL, PERSONALITY), luồng quy trình công việc và toàn bộ lịch sử hội thoại. Hành động này là <strong>không thể khôi phục</strong>.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleDeleteCompany}
              className="shrink-0 px-6 py-3.5 rounded-2xl bg-transparent hover:bg-rose-500/10 border border-dashed border-rose-500 hover:border-rose-400 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all duration-300 flex items-center gap-2"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              <span>Delete Company</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
