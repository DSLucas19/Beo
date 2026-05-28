import { create } from 'zustand'

const API_BASE = 'http://localhost:8000/api'

export const getTabRole = (tab) => {
  if (tab === 'secretary_chat') {
    return useWorkspaceStore.getState()?.activePrivateAgent || 'secretary'
  }
  if (!tab.startsWith('dep_')) return 'secretary'
  const dep = tab.replace('dep_', '')
  if (dep.includes('planning') || dep.includes('planner')) return 'planner'
  if (dep.includes('engineering') || dep.includes('developer')) return 'developer'
  if (dep.includes('marketing') || dep.includes('marketer')) return 'marketer'
  if (dep.includes('finance') || dep.includes('legal')) return 'finance'
  return dep
}

export const getTabChannel = (tab) => {
  if (tab === 'secretary_chat') {
    return useWorkspaceStore.getState()?.activePrivateAgent || 'secretary'
  }
  if (!tab.startsWith('dep_')) return 'secretary'
  const role = getTabRole(tab)
  if (tab.includes('_chat_group')) {
    return `${role === 'developer' ? 'engineering' : role === 'planner' ? 'planning' : role}_group`
  }
  return role
}

export const useWorkspaceStore = create((set, get) => ({
  workspaceId: 'beo_corp', // Workspace mặc định v1
  workspaceName: 'Beo Corporation',
  onboardingCompleted: false,
  activeTab: 'secretary_chat', // Tab mặc định khi mới mở
  showSetupWizard: false,
  wizardMode: 'onboarding', // 'onboarding' | 'create_workspace'

  chatMessages: [],
  inboxItems: [],
  files: [],
  selectedFileContent: null,
  selectedFilePath: null,
  isSending: false,
  error: null,
  activePrivateAgent: 'secretary',

  // Multi-session State
  activeSessionId: 'default',
  showHistorySidebar: false,
  activeHistoryTab: 'secretary_chat',
  sessionsList: [],

  // Cấu hình bổ sung Phase 2 & 3
  apiKeys: [],            // List các api-key provider đã cấu hình (dưới dạng string name)
  apiKeysDetail: [],      // Chi tiết các cấu hình api-key đã lưu
  systemSettings: { daily_cost_cap: 5.00, loop_guard_limit: 5, shell_security_sandbox: true },
  departments: [],        // Danh sách phòng ban hoạt động trích xuất từ OPERATIONS.md
  projects: [],           // Danh sách dự án
  projectFiles: [],       // File của dự án hiện tại
  selectedProjectFilePath: null,
  selectedProjectFileContent: null,
  workflows: [],          // Các bước quy trình làm việc
  mcpServers: [],         // Danh sách MCP servers
  agents: [],             // Cấu hình AI Agents từ DB
  agentFiles: { soul: '', personality: '' }, // File SOUL/PERSONALITY của Agent đang chọn
  presets: { skills: [], mcp_servers: [] },  // Skills và MCP Server mẫu cấu hình sẵn
  swarms: [],
  activeSwarmDetails: null,

  setSetupWizard: (show, mode = 'onboarding') => set({ showSetupWizard: show, wizardMode: mode }),

  setActivePrivateAgent: (agent) => {
    set({ activePrivateAgent: agent, activeSessionId: 'default' })
    get().fetchMessages()
    get().fetchSessions('secretary_chat')
  },

  setWorkspace: (id, name) => {
    set({ workspaceId: id, workspaceName: name })
    get().loadStatus()

    get().fetchMessages()
    get().fetchInbox()
    get().fetchFiles()
    get().fetchApiKeys()
    get().fetchDepartments()
    get().fetchProjects()
    get().fetchWorkflows()
    get().fetchMcpServers()
    get().fetchAgents()
    get().fetchPresets()
    get().fetchSwarms()
    get().fetchSystemSettings()
  },

  selectTab: (tab) => {
    // Reset activeSessionId to 'default' when changing tab
    const updates = { activeTab: tab, activeSessionId: 'default' }
    if (tab === 'secretary_chat') {
      updates.activePrivateAgent = 'secretary'
    }
    set(updates)
    if (tab === 'inbox') {
      get().fetchInbox()
    } else if (tab === 'company_files') {
      get().fetchFiles()
    } else if (tab === 'settings') {
      get().fetchApiKeys()
      get().fetchMcpServers()
      get().fetchAgents()
      get().fetchPresets()
      get().fetchSystemSettings()
    } else if (tab === 'swarms') {
      get().fetchSwarms()
    } else if (tab.startsWith('swarm_detail_')) {
      const swarmId = tab.replace('swarm_detail_', '')
      get().fetchSwarmDetails(swarmId)
    } else if (tab.startsWith('dep_') || tab === 'secretary_chat') {
      get().fetchMessages()
      get().fetchSessions(tab)
    } else if (tab.startsWith('proj_')) {
      const projectName = tab.replace('proj_', '')
      get().fetchProjectFiles(projectName)
      get().fetchWorkflows()
    }
  },

  toggleHistorySidebar: (tab = null) => {
    const { showHistorySidebar, activeHistoryTab } = get()
    const targetTab = tab || activeHistoryTab || get().activeTab
    if (showHistorySidebar && activeHistoryTab === targetTab) {
      set({ showHistorySidebar: false })
    } else {
      set({ showHistorySidebar: true, activeHistoryTab: targetTab })
      get().fetchSessions(targetTab)
    }
  },

  fetchSessions: async (tab = null) => {
    const { workspaceId } = get()
    const targetTab = tab || get().activeHistoryTab || get().activeTab
    if (targetTab !== 'secretary_chat' && !targetTab.startsWith('dep_')) {
      return
    }
    const role = getTabRole(targetTab)
    const channel = getTabChannel(targetTab)
    try {
      let url;
      if (targetTab === 'secretary_chat' && role === 'secretary') {
        url = `${API_BASE}/workspaces/${workspaceId}/onboarding/sessions`
      } else {
        url = `${API_BASE}/workspaces/${workspaceId}/chat/${role}/sessions?channel=${channel}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        set({ sessionsList: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  selectSession: (sessionId) => {
    set({ activeSessionId: sessionId })
    get().fetchMessages()
  },

  createNewSession: () => {
    const newSessionId = `session_${Date.now()}`
    set({ activeSessionId: newSessionId, chatMessages: [] })
    get().fetchSessions()
  },

  loadStatus: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/onboarding/status`)
      const data = await res.json()
      set({ 
        onboardingCompleted: data.onboarding_completed,
        workspaceName: data.workspace_name || get().workspaceName
      })
      
      // Auto open setup wizard if onboarding is not completed
      if (!data.onboarding_completed) {
        set({ showSetupWizard: true, wizardMode: 'onboarding' })
      }
      
      // Nếu đã hoàn thành onboarding, tải luôn các phòng ban và dự án
      if (data.onboarding_completed) {
        get().fetchDepartments()
        get().fetchProjects()
      }
    } catch (err) {
      set({ error: 'Không thể kết nối API Backend.' })
    }
  },

  fetchMessages: async (channel = null) => {
    const { workspaceId, activeTab, activeSessionId } = get()
    const role = getTabRole(activeTab)
    const sessionId = activeSessionId || 'default'
    const targetChannel = channel || getTabChannel(activeTab)
    try {
      let url;
      if (activeTab === 'secretary_chat' && role === 'secretary') {
        url = `${API_BASE}/workspaces/${workspaceId}/onboarding/messages?session_id=${sessionId}`
      } else {
        url = `${API_BASE}/workspaces/${workspaceId}/chat/${role}/messages?channel=${targetChannel}&session_id=${sessionId}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        set({ chatMessages: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  sendMessage: async (messageText, channel = null) => {
    const { workspaceId, chatMessages, activeTab, activeSessionId } = get()
    if (!messageText.trim()) return

    set({ isSending: true, error: null })
    
    // 1. Optimistic update user message
    const tempUserMsg = { sender: 'user', message: messageText, timestamp: new Date().toISOString() }
    
    // 2. Prepare temporary streaming message from AI
    const role = getTabRole(activeTab)
    const targetChannel = channel || getTabChannel(activeTab)
    const tempAiMsg = { 
      sender: role, 
      message: '', 
      timestamp: new Date().toISOString(), 
      isStreaming: true 
    }
    
    set({ chatMessages: [...chatMessages, tempUserMsg, tempAiMsg] })

    try {
      let url;
      if (activeTab === 'secretary_chat' && role === 'secretary') {
        url = `${API_BASE}/workspaces/${workspaceId}/onboarding/chat`
      } else {
        url = `${API_BASE}/workspaces/${workspaceId}/chat/${role}`
      }
      
      const payload = { 
        message: messageText,
        channel: targetChannel,
        session_id: activeSessionId || 'default'
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error('API Response Error')
      
      // Consume and decode stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false
      let buffer = ''
      let accumulatedMessage = ''
      let proposalCreated = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() // keep the last potentially incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6).trim()
              try {
                const data = JSON.parse(jsonStr)
                if (data.type === 'agent_start') {
                  // Switch to a new agent speaking bubble
                  set((state) => {
                    const updated = state.chatMessages.map(m => m.isStreaming ? { ...m, isStreaming: false } : m)
                    updated.push({
                      sender: data.sender,
                      message: '',
                      timestamp: new Date().toISOString(),
                      isStreaming: true
                    })
                    accumulatedMessage = '' // Reset for new agent
                    return { chatMessages: updated }
                  })
                } else if (data.type === 'chunk' && data.content) {
                  accumulatedMessage += data.content
                  // Update state in real-time
                  set((state) => {
                    const updated = [...state.chatMessages]
                    if (updated.length > 0 && updated[updated.length - 1].isStreaming) {
                      updated[updated.length - 1].message = accumulatedMessage
                    }
                    return { chatMessages: updated }
                  })
                } else if (data.type === 'done') {
                  proposalCreated = data.proposal_created
                  if (data.full_response) {
                    accumulatedMessage = data.full_response
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.content || 'LLM API error')
                }
              } catch (parseErr) {
                console.warn('Failed to parse SSE event:', jsonStr, parseErr)
              }
            }
          }
        }
      }

      // If there is any leftover buffer, process it
      if (buffer.trim()) {
        const trimmedLine = buffer.trim()
        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.slice(6).trim()
          try {
            const data = JSON.parse(jsonStr)
            if (data.type === 'chunk' && data.content) {
              accumulatedMessage += data.content
            } else if (data.type === 'done') {
              proposalCreated = data.proposal_created
            }
          } catch (e) {}
        }
      }

      // 3. Swap the temporary streaming message with official DB entries
      await get().fetchMessages(targetChannel)
      get().fetchSessions()
      
      // If proposals were generated in the process, reload approval inbox
      if (proposalCreated) {
        get().fetchInbox()
      }
    } catch (err) {
      console.error('Error sending message:', err)
      set({ error: `Không thể kết nối đến ${role}.` })
      
      // Remove temp streaming message on failure to keep UI clean
      set((state) => {
        const filtered = state.chatMessages.filter(m => !m.isStreaming)
        return { chatMessages: filtered }
      })
    } finally {
      get().fetchMessages(targetChannel)
      get().fetchSessions()
      set({ isSending: false })
    }
  },

  // --- Inbox / Approval Queue ---
  fetchInbox: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/inbox`)
      if (res.ok) {
        const data = await res.json()
        set({ inboxItems: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  approveItem: async (itemId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/inbox/${itemId}/approve`, {
        method: 'POST'
      })
      if (res.ok) {
        get().fetchInbox()
        get().loadStatus() // Kiểm tra xem onboarding đã xong chưa
        get().fetchFiles()
        get().fetchDepartments() // Cập nhật phòng ban nếu duyệt Operations
        get().fetchWorkflows()   // Cập nhật lại workflow ngầm
        get().fetchSwarms()      // Tải lại swarm khi có thể deploy mới
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  rejectItem: async (itemId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/inbox/${itemId}/reject`, {
        method: 'POST'
      })
      if (res.ok) {
        get().fetchInbox()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  editItemContent: async (itemId, newContent) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/inbox/${itemId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      })
      if (res.ok) {
        get().fetchInbox()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // --- Quản lý File Công Ty ---
  fetchFiles: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files`)
      if (res.ok) {
        const data = await res.json()
        set({ files: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  loadFileContent: async (filePath) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files/${filePath}`)
      if (res.ok) {
        const data = await res.json()
        set({ selectedFileContent: data.content, selectedFilePath: filePath })
      }
    } catch (err) {
      console.error(err)
    }
  },

  saveFileContent: async (filePath, newContent) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files/${filePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      })
      if (res.ok) {
        set({ selectedFileContent: newContent })
        get().fetchFiles()
        // Nếu thay đổi cấu hình phòng ban/tài chính, reload luôn
        if (filePath.endsWith('OPERATIONS.md') || filePath.endsWith('FINANCE.md')) {
          get().fetchDepartments()
        }
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // --- API Keys ---
  fetchApiKeys: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/api-keys`)
      if (res.ok) {
        const data = await res.json()
        // data lúc này là: [{"provider": "gemini", "url": null, "model": null}]
        set({ 
          apiKeys: data.map(k => k.provider), 
          apiKeysDetail: data 
        })
      }
    } catch (err) {
      console.error(err)
    }
  },

  registerApiKey: async (provider, key, url = null, model = null, targetWsId = null) => {
    const wsId = targetWsId || get().workspaceId
    try {
      const payload = { provider, key }
      if (url) payload.url = url
      if (model) payload.model = model
      const res = await fetch(`${API_BASE}/workspaces/${wsId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        if (wsId === get().workspaceId) {
          get().fetchApiKeys()
        }
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  testApiKey: async (provider, key, url = null, model = null) => {
    const { workspaceId } = get()
    try {
      const payload = { provider }
      if (key) payload.key = key
      if (url) payload.url = url
      if (model) payload.model = model
      
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/api-keys/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        return data // Trả về { status: "success" | "error", message: string, reply?: string }
      }
      return { status: "error", message: "Lỗi kết nối Server (" + res.status + ")" }
    } catch (err) {
      console.error(err)
      return { status: "error", message: err.message || "Không thể kết nối đến máy chủ" }
    }
  },

  // --- Phòng Ban ---
  fetchDepartments: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/departments`)
      if (res.ok) {
        const data = await res.json()
        set({ departments: data.departments })
      }
    } catch (err) {
      console.error(err)
    }
  },

  // --- Dự Án (Projects) ---
  fetchProjects: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects`)
      if (res.ok) {
        const data = await res.json()
        set({ projects: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  createProject: async (name, description) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })
      if (res.ok) {
        get().fetchProjects()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // --- Quản lý File Dự Án ---
  fetchProjectFiles: async (projectName) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects/${projectName}/files`)
      if (res.ok) {
        const data = await res.json()
        set({ projectFiles: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  loadProjectFileContent: async (projectName, filePath) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects/${projectName}/files/${filePath}`)
      if (res.ok) {
        const data = await res.json()
        set({ selectedProjectFileContent: data.content, selectedProjectFilePath: filePath })
      }
    } catch (err) {
      console.error(err)
    }
  },

  saveProjectFileContent: async (projectName, filePath, content) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects/${projectName}/files/${filePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        set({ selectedProjectFileContent: content })
        get().fetchProjectFiles(projectName)
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // --- Bộ Máy Quy Trình (Workflows) ---
  fetchWorkflows: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows`)
      if (res.ok) {
        const data = await res.json()
        set({ workflows: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  runWorkflowStep: async (stepId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/${stepId}/run`, {
        method: 'POST'
      })
      if (res.ok) {
        get().fetchWorkflows()
        get().fetchInbox() // Có thể sinh lệnh duyệt
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  retryWorkflowStep: async (stepId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/${stepId}/retry`, {
        method: 'POST'
      })
      if (res.ok) {
        get().fetchWorkflows()
        get().fetchInbox()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  skipWorkflowStep: async (stepId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/${stepId}/skip`, {
        method: 'POST'
      })
      if (res.ok) {
        get().fetchWorkflows()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  editWorkflowStep: async (stepId, stepName, role) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/${stepId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_name: stepName, role })
      })
      if (res.ok) {
        get().fetchWorkflows()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  compileSop: async (filePath, projectName) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/compile-sop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, project_name: projectName })
      })
      if (res.ok) {
        get().fetchWorkflows()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // --- MCP Servers ---
  fetchMcpServers: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/mcp/servers`)
      if (res.ok) {
        const data = await res.json()
        set({ mcpServers: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  registerMcpServer: async (name, url) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
      })
      if (res.ok) {
        get().fetchMcpServers()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  fetchMcpTools: async (serverName) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/mcp/servers/${serverName}/tools`)
      if (res.ok) {
        const data = await res.json()
        const currentTools = get().mcpTools || {}
        set({ 
          mcpTools: { 
            ...currentTools, 
            [serverName]: data.result?.tools || [] 
          } 
        })
        return data.result?.tools || []
      }
      return []
    } catch (err) {
      console.error(err)
      return []
    }
  },

  callMcpTool: async (serverName, toolName, args) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/mcp/call/${serverName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: toolName, arguments: args })
      })
      if (res.ok) {
        const data = await res.json()
        return data
      }
      return { status: "error", message: "Failed to call MCP tool" }
    } catch (err) {
      console.error(err)
      return { status: "error", message: err.message }
    }
  },

  // --- Agents Customizer ---
  fetchAgents: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agents`)
      if (res.ok) {
        const data = await res.json()
        set({ agents: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  configureAgent: async (role, configData) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agents/${role}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })
      if (res.ok) {
        get().fetchAgents()
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  fetchAgentFiles: async (role) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agents/${role}/files`)
      if (res.ok) {
        const data = await res.json()
        set({ agentFiles: data })
        return data
      }
      return null
    } catch (err) {
      console.error(err)
      return null
    }
  },

  saveAgentFile: async (role, fileType, content) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agents/${role}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_type: fileType, content })
      })
      if (res.ok) {
        // Cập nhật lại agentFiles state cục bộ
        const currentFiles = get().agentFiles || {}
        set({ 
          agentFiles: { 
            ...currentFiles, 
            [fileType]: content 
          } 
        })
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      return false
    }
  },

  fetchPresets: async () => {
    try {
      const res = await fetch(`${API_BASE}/presets`)
      if (res.ok) {
        const data = await res.json()
        set({ presets: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  fetchSwarms: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/swarms`)
      if (res.ok) {
        const data = await res.json()
        set({ swarms: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  fetchSwarmDetails: async (swarmId) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/swarms/${swarmId}`)
      if (res.ok) {
        const data = await res.json()
        set({ activeSwarmDetails: data })
      }
    } catch (err) {
      console.error(err)
    }
  },

  deploySwarm: async (name, members) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/swarms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, members })
      })
      if (res.ok) {
        const data = await res.json()
        get().fetchSwarms()
        return data
      }
      return null
    } catch (err) {
      console.error(err)
      return null
    }
  },

  spawnCliproxy: async (mode) => {
    try {
      const res = await fetch(`${API_BASE}/cliproxy/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      if (res.ok) {
        const data = await res.json()
        return data
      }
      return { status: 'error', message: 'Failed to communicate with backend.' }
    } catch (err) {
      console.error(err)
      return { status: 'error', message: err.message || 'Failed to spawn CLIProxy.' }
    }
  },

  scanApiKeyModels: async (provider, key = null, url = null) => {
    const { workspaceId } = get()
    try {
      const payload = { provider }
      if (key) payload.key = key
      if (url) payload.url = url
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/api-keys/scan-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        return data // { status: "success" | "default" | "fallback", models: string[] }
      }
      return { status: 'error', models: [] }
    } catch (err) {
      console.error(err)
      return { status: 'error', models: [] }
    }
  },

  fetchSystemSettings: async () => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/system-settings`)
      if (res.ok) {
        const data = await res.json()
        set({ systemSettings: data })
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err)
    }
  },

  updateSystemSettings: async (settings) => {
    const { workspaceId } = get()
    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/system-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (res.ok) {
        const data = await res.json()
        set({ systemSettings: data.settings })
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update system settings:', err)
      return false
    }
  }
}))
