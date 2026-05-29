import React, { useState, useEffect, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  EyeIcon,
  PlusIcon,
  Trash2Icon,
  FilterIcon,
  ArrowUpDownIcon,
  LayersIcon,
  LayoutGridIcon,
  ListIcon,
  ColumnsIcon,
  XIcon,
  PlusCircleIcon,
  InfoIcon
} from 'lucide-react'

const DEPT_SEED_DATA = {
  planning: [
    { id: 'PLN-001', title: 'Q3 Strategic Competitor Analysis', status: 'In Progress', priority: 'High', assignee: 'Sarah (COO Agent)', dueDate: '2026-06-15', quarter: 'Q3', impact: 'High', description: 'Perform in-depth competitor pricing and features review for the new SEO SaaS.' },
    { id: 'PLN-002', title: 'Establish Weekly Sync SOP', status: 'Completed', priority: 'Medium', assignee: 'Lucas', dueDate: '2026-05-20', quarter: 'Q2', impact: 'Medium', description: 'Define standard operating procedures for sync meetings.' },
    { id: 'PLN-003', title: 'Set Up Onboarding Wizard UI Flow', status: 'Backlog', priority: 'High', assignee: 'John (CTO Agent)', dueDate: '2026-07-01', quarter: 'Q3', impact: 'High', description: 'Draft the screen-by-screen navigation maps for user setup.' }
  ],
  engineering: [
    { id: 'DEV-001', title: 'Implement SSE Streaming Endpoint', status: 'Merged', priority: 'Critical', type: 'Feature', repository: 'backend-api', branch: 'main', storyPoints: 5, description: 'Add support for Server-Sent Events in chatbot API for smooth agent updates.' },
    { id: 'DEV-002', title: 'Fix CORS issue with Local Hostnames', status: 'Code Review', priority: 'High', type: 'Bug', repository: 'frontend-core', branch: 'fix/cors-local', storyPoints: 2, description: 'Resolve cross-origin request blockages when developing with customized network aliases.' },
    { id: 'DEV-003', title: 'Optimize SQLite Query Indexing', status: 'In Development', priority: 'Medium', type: 'Refactor', repository: 'backend-api', branch: 'perf/db-index', storyPoints: 3, description: 'Benchmark message history queries and construct index on workspace session_id.' }
  ],
  marketing: [
    { id: 'MKT-001', title: 'Solopreneur Product Launch Post', status: 'Scheduled', priority: 'High', channel: 'Twitter/X', contentType: 'AIDA Copy', targetAudience: 'Solopreneurs', budget: 0, reach: '5k-10k', campaignName: 'Early Access Launch', description: 'Viral launch thread targeting solopreneurs and indie hackers.' },
    { id: 'MKT-002', title: 'Newsletter Campaign Blast #1', status: 'Drafting', priority: 'Medium', channel: 'Email Newsletter', contentType: 'PAS Thread', targetAudience: 'Registered Beta Users', budget: 50, reach: '2k', campaignName: 'Beta Feedback Drive', description: 'Engage early beta users to submit detailed feedback reports.' },
    { id: 'MKT-003', title: 'A/B Test Facebook Landing Ad', status: 'Analyzing', priority: 'High', channel: 'Facebook', contentType: 'Product Announcement', targetAudience: 'Indie Hackers', budget: 200, reach: '15k', campaignName: 'Paid Lead Acquisition', description: 'Acquire early signups using a direct response ad copy.' }
  ],
  finance: [
    { id: 'FIN-001', title: 'Google Cloud Hosting Payment', status: 'Paid', priority: 'High', category: 'Server Infrastructure', amount: 245.80, paymentMethod: 'Credit Card', date: '2026-05-25', requestedBy: 'Dev Lead', description: 'Monthly hosting charges for development and staging environments.' },
    { id: 'FIN-002', title: 'Gemini Pro API Over-limit Review', status: 'Pending Approval', priority: 'Critical', category: 'API Call Costs', amount: 78.40, paymentMethod: 'Stripe', date: '2026-05-27', requestedBy: 'COO Agent', description: 'Extra LLM queries during parallel workflow execution test.' },
    { id: 'FIN-003', title: 'LLM Retainer Agreement retainer', status: 'Approved', priority: 'Medium', category: 'Legal Consulting', amount: 1500.00, paymentMethod: 'Bank Wire', date: '2026-05-28', requestedBy: 'Founder Lucas', description: 'Upfront legal retainer for software license terms validation.' }
  ]
}

const DEPT_PROPERTIES = {
  planning: [
    { name: 'id', label: 'Task ID', type: 'text', required: true, placeholder: 'e.g. PLN-004' },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Backlog', 'In Progress', 'Completed', 'On Hold'] },
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
    { name: 'assignee', label: 'Assignee', type: 'text' },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    { name: 'quarter', label: 'Quarter', type: 'select', options: ['Q1', 'Q2', 'Q3', 'Q4'] },
    { name: 'impact', label: 'Business Impact', type: 'select', options: ['High', 'Medium', 'Low'] },
    { name: 'description', label: 'Description', type: 'textarea' }
  ],
  engineering: [
    { name: 'id', label: 'Item ID', type: 'text', required: true, placeholder: 'e.g. DEV-004' },
    { name: 'title', label: 'Summary', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['Feature', 'Bug', 'Refactor', 'Security'] },
    { name: 'priority', label: 'Severity', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
    { name: 'status', label: 'Status', type: 'select', options: ['Backlog', 'In Development', 'Code Review', 'Merged'] },
    { name: 'repository', label: 'Repository', type: 'text' },
    { name: 'branch', label: 'Git Branch', type: 'text' },
    { name: 'storyPoints', label: 'Story Points', type: 'number' },
    { name: 'description', label: 'Details', type: 'textarea' }
  ],
  marketing: [
    { name: 'id', label: 'Campaign ID', type: 'text', required: true, placeholder: 'e.g. MKT-004' },
    { name: 'campaignName', label: 'Campaign Name', type: 'text', required: true },
    { name: 'title', label: 'Deliverable Title', type: 'text', required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['Blog', 'Twitter/X', 'LinkedIn', 'Email Newsletter', 'Facebook'] },
    { name: 'contentType', label: 'Content Type', type: 'select', options: ['Infographic', 'AIDA Copy', 'PAS Thread', 'Product Announcement'] },
    { name: 'status', label: 'Status', type: 'select', options: ['Drafting', 'Scheduled', 'Published', 'Analyzing'] },
    { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
    { name: 'targetAudience', label: 'Target Audience', type: 'text' },
    { name: 'budget', label: 'Budget ($)', type: 'number' },
    { name: 'reach', label: 'Estimated Reach', type: 'text' },
    { name: 'description', label: 'Campaign Objective', type: 'textarea' }
  ],
  finance: [
    { name: 'id', label: 'Txn ID', type: 'text', required: true, placeholder: 'e.g. FIN-004' },
    { name: 'title', label: 'Expense Title', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['API Call Costs', 'Server Infrastructure', 'Tooling Subscription', 'Legal Consulting'] },
    { name: 'amount', label: 'Amount ($)', type: 'number', required: true },
    { name: 'status', label: 'Approval Status', type: 'select', options: ['Pending Approval', 'Approved', 'Paid', 'Rejected'] },
    { name: 'priority', label: 'Urgency', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
    { name: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['Stripe', 'Credit Card', 'Bank Wire'] },
    { name: 'date', label: 'Txn Date', type: 'date' },
    { name: 'requestedBy', label: 'Requested By', type: 'text' },
    { name: 'description', label: 'Line Item Details', type: 'textarea' }
  ]
}

export default function TeamViewPane({ department }) {
  const { workspaceId } = useWorkspaceStore()
  const deptKey = useMemo(() => department.replace('dep_', '').toLowerCase(), [department])
  
  // Scoped localStorage keys
  const dataStorageKey = `beo_data_${workspaceId}_${deptKey}`
  const viewsStorageKey = `beo_views_${workspaceId}_${deptKey}`

  // States
  const [dataItems, setDataItems] = useState([])
  const [views, setViews] = useState([])
  const [selectedViewId, setSelectedViewId] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddItemModal, setShowAddItemModal] = useState(false)

  // Form states for creating view
  const [viewName, setViewName] = useState('')
  const [viewLayout, setViewLayout] = useState('table')
  const [filterProp, setFilterProp] = useState('all')
  const [filterVal, setFilterVal] = useState('')
  const [sortProp, setSortProp] = useState('id')
  const [sortOrder, setSortOrder] = useState('asc')

  // Form state for adding item
  const [newItemData, setNewItemData] = useState({})

  // Fetch properties for current department
  const properties = useMemo(() => DEPT_PROPERTIES[deptKey] || [], [deptKey])

  // Load views and dataset
  useEffect(() => {
    // Load dataset (with seed fallback)
    const savedData = localStorage.getItem(dataStorageKey)
    if (savedData) {
      setDataItems(JSON.parse(savedData))
    } else {
      const seed = DEPT_SEED_DATA[deptKey] || []
      setDataItems(seed)
      localStorage.setItem(dataStorageKey, JSON.stringify(seed))
    }

    // Load views
    const savedViews = localStorage.getItem(viewsStorageKey)
    if (savedViews && JSON.parse(savedViews).length > 0) {
      const parsedViews = JSON.parse(savedViews)
      setViews(parsedViews)
      setSelectedViewId(parsedViews[0].id)
    } else {
      // Auto-seed standard enterprise views directly
      const defaultViews = [
        {
          id: 'view_default_all',
          name: 'All Items (Table)',
          layout: 'table',
          filterProperty: 'all',
          filterValue: '',
          sortProperty: 'id',
          sortOrder: 'asc'
        },
        {
          id: 'view_default_high',
          name: 'High Priority (Cards)',
          layout: 'cards',
          filterProperty: 'priority',
          filterValue: 'High',
          sortProperty: 'id',
          sortOrder: 'asc'
        },
        {
          id: 'view_default_board',
          name: 'Status Board',
          layout: 'board',
          filterProperty: 'all',
          filterValue: '',
          sortProperty: 'id',
          sortOrder: 'asc'
        }
      ]
      setViews(defaultViews)
      localStorage.setItem(viewsStorageKey, JSON.stringify(defaultViews))
      setSelectedViewId(defaultViews[0].id)
    }
  }, [dataStorageKey, viewsStorageKey, deptKey])

  // Get active view config
  const activeView = useMemo(() => {
    return views.find(v => v.id === selectedViewId) || null
  }, [views, selectedViewId])

  // Filter & Sort Data based on Active View Configuration
  const processedData = useMemo(() => {
    if (!activeView) return []
    let items = [...dataItems]

    // 1. Filtering
    if (activeView.filterProperty && activeView.filterProperty !== 'all') {
      const fProp = activeView.filterProperty
      const fVal = activeView.filterValue ? activeView.filterValue.toString().toLowerCase() : ''
      if (fVal) {
        items = items.filter(item => {
          const val = item[fProp] ? item[fProp].toString().toLowerCase() : ''
          return val.includes(fVal)
        })
      }
    }

    // 2. Sorting
    if (activeView.sortProperty) {
      const sProp = activeView.sortProperty
      const isAsc = activeView.sortOrder === 'asc'
      items.sort((a, b) => {
        let valA = a[sProp]
        let valB = b[sProp]

        // Parse numbers if numerical
        if (sProp === 'amount' || sProp === 'budget' || sProp === 'storyPoints') {
          valA = valA ? parseFloat(valA) : 0
          valB = valB ? parseFloat(valB) : 0
        } else {
          valA = valA ? valA.toString().toLowerCase() : ''
          valB = valB ? valB.toString().toLowerCase() : ''
        }

        if (valA < valB) return isAsc ? -1 : 1
        if (valA > valB) return isAsc ? 1 : -1
        return 0
      })
    }

    return items
  }, [dataItems, activeView])

  // Create custom view handler
  const handleCreateView = (e) => {
    e.preventDefault()
    if (!viewName.trim()) return

    const newView = {
      id: `view_${Date.now()}`,
      name: viewName.trim(),
      layout: viewLayout,
      filterProperty: filterProp,
      filterValue: filterVal.trim(),
      sortProperty: sortProp,
      sortOrder: sortOrder
    }

    const updatedViews = [...views, newView]
    setViews(updatedViews)
    localStorage.setItem(viewsStorageKey, JSON.stringify(updatedViews))
    setSelectedViewId(newView.id)
    setShowCreateModal(false)

    // Reset inputs
    setViewName('')
    setViewLayout('table')
    setFilterProp('all')
    setFilterVal('')
    setSortProp('id')
    setSortOrder('asc')
  }

  // Delete view handler by ID
  const handleDeleteView = (viewId) => {
    const updatedViews = views.filter(v => v.id !== viewId)
    if (updatedViews.length === 0) {
      handleSeedDefaultViews()
      return
    }
    setViews(updatedViews)
    localStorage.setItem(viewsStorageKey, JSON.stringify(updatedViews))
    if (selectedViewId === viewId) {
      setSelectedViewId(updatedViews[0].id)
    }
  }

  // Add Item handler
  const handleAddItem = (e) => {
    e.preventDefault()
    if (!newItemData.id || !newItemData.title) {
      alert("Please fill in ID and Title/Name fields")
      return
    }

    // Check duplicate ID
    if (dataItems.some(i => i.id.toLowerCase() === newItemData.id.toLowerCase())) {
      alert("Item ID already exists!")
      return
    }

    const updatedData = [...dataItems, newItemData]
    setDataItems(updatedData)
    localStorage.setItem(dataStorageKey, JSON.stringify(updatedData))
    setShowAddItemModal(false)
    setNewItemData({})
  }

  // Delete item handler
  const handleDeleteItem = (itemId) => {
    const updatedData = dataItems.filter(i => i.id !== itemId)
    setDataItems(updatedData)
    localStorage.setItem(dataStorageKey, JSON.stringify(updatedData))
  }

  // Pre-seed some default views if the user wants a quick start
  const handleSeedDefaultViews = () => {
    const defaultViews = [
      {
        id: 'view_default_all',
        name: 'All Items (Table)',
        layout: 'table',
        filterProperty: 'all',
        filterValue: '',
        sortProperty: 'id',
        sortOrder: 'asc'
      },
      {
        id: 'view_default_high',
        name: 'High Priority (Cards)',
        layout: 'cards',
        filterProperty: 'priority',
        filterValue: 'High',
        sortProperty: 'id',
        sortOrder: 'asc'
      },
      {
        id: 'view_default_board',
        name: 'Status Board',
        layout: 'board',
        filterProperty: 'all',
        filterValue: '',
        sortProperty: 'id',
        sortOrder: 'asc'
      }
    ]
    setViews(defaultViews)
    localStorage.setItem(viewsStorageKey, JSON.stringify(defaultViews))
    setSelectedViewId(defaultViews[0].id)
  }

  // Column keys for Board View grouping
  const boardColumns = useMemo(() => {
    if (deptKey === 'planning') return ['Backlog', 'In Progress', 'Completed', 'On Hold']
    if (deptKey === 'engineering') return ['Backlog', 'In Development', 'Code Review', 'Merged']
    if (deptKey === 'marketing') return ['Drafting', 'Scheduled', 'Published', 'Analyzing']
    if (deptKey === 'finance') return ['Pending Approval', 'Approved', 'Paid', 'Rejected']
    return []
  }, [deptKey])

  // Group items for Board View
  const groupedBoardData = useMemo(() => {
    const groups = {}
    boardColumns.forEach(col => {
      groups[col] = []
    })
    processedData.forEach(item => {
      const colVal = item.status || boardColumns[0]
      if (groups[colVal]) {
        groups[colVal].push(item)
      } else {
        // Fallback for custom statuses
        if (boardColumns.length > 0) {
          groups[boardColumns[0]].push(item)
        }
      }
    })
    return groups
  }, [processedData, boardColumns])

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950/10 text-left overflow-hidden">
      {/* Sleek Minimalist Top Divider & View Bar */}
      <div className="border-t border-white/[0.04] pt-4 px-6 flex items-center justify-between bg-transparent shrink-0">
        {/* Left Side: Notion-style View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[75%] no-scrollbar py-0.5">
          {views.map(v => {
            const isActive = v.id === selectedViewId
            return (
              <button
                key={v.id}
                onClick={() => setSelectedViewId(v.id)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all ${
                  isActive
                    ? 'bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                }`}
              >
                <span className="truncate">{v.name}</span>
                
                {/* Deletion inline trigger on hover */}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteView(v.id)
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Delete View"
                >
                  <XIcon className="w-2.5 h-2.5" />
                </span>
              </button>
            )
          })}
        </div>

        {/* Right Side: Sleek lowercase 'add view' button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-zinc-400 hover:text-white hover:underline transition-all text-xs font-semibold px-3 py-1.5 flex items-center gap-1 shrink-0"
        >
          <span>add view</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeView && (
          /* Render Active View */
          <div className="space-y-4">
            {/* Toolbar for the Active View */}
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.03]">
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] px-2.5 py-1 rounded-lg">
                  <FilterIcon className="w-3.5 h-3.5 opacity-55" />
                  <span>Filter: {activeView.filterProperty === 'all' ? 'All Data' : `${activeView.filterProperty}="${activeView.filterValue}"`}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] px-2.5 py-1 rounded-lg">
                  <ArrowUpDownIcon className="w-3.5 h-3.5 opacity-55" />
                  <span>Sort: {activeView.sortProperty} ({activeView.sortOrder.toUpperCase()})</span>
                </div>
              </div>
              
              <button
                onClick={() => setShowAddItemModal(true)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Layout representations */}
            {processedData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-500 bg-white/[0.01] border border-white/[0.02] rounded-2xl p-6">
                <InfoIcon className="w-8 h-8 opacity-25 mb-2" />
                <span className="text-xs font-semibold">No items match the view filters.</span>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-3 text-[11px] font-bold text-white hover:underline"
                >
                  Create a new item matching this view
                </button>
              </div>
            ) : (
              <>
                {/* 1. TABLE LAYOUT */}
                {activeView.layout === 'table' && (
                  <div className="border border-white/[0.04] rounded-2xl overflow-hidden bg-zinc-950/10">
                    <table className="min-w-full divide-y divide-white/[0.04]">
                      <thead className="bg-white/[0.02]">
                        <tr>
                          {properties.map(p => (
                            <th key={p.name} className="px-4 py-3 text-left text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">{p.label}</th>
                          ))}
                          <th className="px-4 py-3 text-right text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03] bg-transparent">
                        {processedData.map(item => (
                          <tr key={item.id} className="hover:bg-white/[0.01] group">
                            {properties.map(p => (
                              <td key={p.name} className="px-4 py-3 text-xs text-zinc-300 font-sans">
                                {p.name === 'id' ? (
                                  <span className="font-mono text-zinc-500 font-semibold">{item[p.name]}</span>
                                ) : p.name === 'status' || p.name === 'priority' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                                    item[p.name]?.toString().toLowerCase() === 'high' || item[p.name]?.toString().toLowerCase() === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                    item[p.name]?.toString().toLowerCase() === 'in progress' || item[p.name]?.toString().toLowerCase() === 'in development' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                    item[p.name]?.toString().toLowerCase() === 'completed' || item[p.name]?.toString().toLowerCase() === 'merged' || item[p.name]?.toString().toLowerCase() === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                    'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                                  }`}>
                                    {item[p.name]}
                                  </span>
                                ) : p.name === 'amount' || p.name === 'budget' ? (
                                  <span className="font-mono font-bold text-white">${parseFloat(item[p.name] || 0).toLocaleString()}</span>
                                ) : (
                                  <span className="truncate max-w-[200px] inline-block">{item[p.name]}</span>
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 rounded bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 transition-all text-zinc-500"
                                title="Delete Item"
                              >
                                <Trash2Icon className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. BOARD LAYOUT */}
                {activeView.layout === 'board' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    {boardColumns.map(col => {
                      const list = groupedBoardData[col] || []
                      return (
                        <div key={col} className="bg-zinc-950/20 border border-white/[0.03] rounded-2xl p-4 flex flex-col min-h-[400px]">
                          <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">{col}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.05] text-zinc-300 font-mono font-semibold">{list.length}</span>
                          </div>

                          <div className="space-y-2.5">
                            {list.map(item => (
                              <div key={item.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all flex flex-col gap-2 relative group text-left">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="absolute top-2 right-2 p-1 rounded bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 text-zinc-500 transition-all"
                                >
                                  <Trash2Icon className="w-3 h-3" />
                                </button>
                                <div className="text-[9px] font-mono text-zinc-500 font-semibold">{item.id}</div>
                                <h4 className="text-xs font-semibold text-zinc-200 pr-4 leading-snug">{item.title || item.campaignName}</h4>
                                
                                {item.description && (
                                  <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2 mt-0.5">{item.description}</p>
                                )}

                                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/[0.03]">
                                  {item.priority && (
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                                      item.priority.toLowerCase() === 'high' || item.priority.toLowerCase() === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' : 'bg-white/5 text-zinc-400'
                                    }`}>
                                      {item.priority}
                                    </span>
                                  )}
                                  {item.amount && (
                                    <span className="font-mono text-xs font-bold text-white">${item.amount}</span>
                                  )}
                                  {item.assignee && (
                                    <span className="text-[9px] text-zinc-500 truncate max-w-[80px]">{item.assignee}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 3. CARDS LAYOUT */}
                {activeView.layout === 'cards' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {processedData.map(item => (
                      <div key={item.id} className="p-5 rounded-2xl bg-zinc-950/20 border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all flex flex-col gap-3 group relative text-left">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 text-zinc-500 transition-all"
                        >
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono font-bold text-zinc-500">{item.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                            item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'merged' || item.status?.toLowerCase() === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            item.status?.toLowerCase() === 'in progress' || item.status?.toLowerCase() === 'in development' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                          }`}>
                            {item.status}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white leading-snug">{item.title || item.campaignName}</h4>
                          {item.description && (
                            <p className="text-xs text-zinc-400 mt-1.5 leading-normal line-clamp-3">{item.description}</p>
                          )}
                        </div>

                        {/* Extra metadata grids */}
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/[0.03] text-[10px] font-sans">
                          {Object.keys(item).filter(k => k !== 'id' && k !== 'title' && k !== 'description' && k !== 'status' && k !== 'campaignName').map(key => (
                            <div key={key} className="flex flex-col">
                              <span className="text-[9px] font-mono text-zinc-500 capitalize">{key}</span>
                              <span className="text-zinc-300 font-semibold truncate mt-0.5">
                                {key === 'amount' || key === 'budget' ? `$${item[key]}` : item[key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. LIST LAYOUT */}
                {activeView.layout === 'list' && (
                  <div className="space-y-2 max-w-3xl mx-auto">
                    {processedData.map(item => (
                      <div key={item.id} className="p-4 rounded-xl bg-zinc-950/20 border border-white/[0.03] hover:border-white/[0.06] hover:bg-white/[0.015] transition-all flex items-center justify-between gap-4 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-zinc-500 font-semibold shrink-0">{item.id}</span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-zinc-200 truncate">{item.title || item.campaignName}</h4>
                            {item.description && (
                              <p className="text-[10px] text-zinc-500 truncate max-w-md mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                            item.priority?.toLowerCase() === 'high' || item.priority?.toLowerCase() === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' : 'bg-white/5 text-zinc-400'
                          }`}>
                            {item.priority}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                            item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'merged' || item.status?.toLowerCase() === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-white/5 text-zinc-400'
                          }`}>
                            {item.status}
                          </span>
                          
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 transition-all text-zinc-500"
                          >
                            <Trash2Icon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* CREATE VIEW DIALOG/MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-4xl bg-zinc-950 border border-white/[0.08] rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.85)] p-6 relative flex flex-col gap-5 text-left">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">Configure Representation</span>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Layout selector buttons (top) */}
            <div className="grid grid-cols-4 gap-3 pb-4 border-b border-white/[0.04]">
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl select-none transition-all ${
                  viewLayout === 'table'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.08)] font-bold'
                    : 'bg-white/[0.01] border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <ListIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Table View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLayout('board')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl select-none transition-all ${
                  viewLayout === 'board'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.08)] font-bold'
                    : 'bg-white/[0.01] border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <ColumnsIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Status Board</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLayout('cards')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl select-none transition-all ${
                  viewLayout === 'cards'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.08)] font-bold'
                    : 'bg-white/[0.01] border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <LayoutGridIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Grid Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLayout('list')}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl select-none transition-all ${
                  viewLayout === 'list'
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.08)] font-bold'
                    : 'bg-white/[0.01] border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <LayersIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Condensed List</span>
              </button>
            </div>

            {/* Split Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Dynamic Animated Illustration Panel */}
              <div className="lg:col-span-6 bg-zinc-950/40 border border-white/[0.04] rounded-2xl h-[260px] relative overflow-hidden flex items-center justify-center">
                
                {/* 1. TABLE ILLUSTRATION */}
                <div className={`absolute inset-0 transition-opacity duration-500 ease-in-out flex flex-col justify-center p-4 ${
                  viewLayout === 'table' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}>
                  <div className="text-[9px] font-semibold text-zinc-500 border-b border-white/[0.04] pb-1.5 mb-2 font-mono uppercase tracking-widest flex items-center justify-between">
                    <span>Query Results</span>
                    <span className="w-2 h-2 rounded-full bg-white/[0.06] border border-white/[0.08]" />
                  </div>
                  
                  <div className="space-y-2 relative h-[120px] illust-t-container">
                    <div className="grid grid-cols-3 gap-2 pb-1.5 border-b border-white/[0.03] text-[9px] font-semibold text-zinc-600">
                      <div className="h-2 w-10 bg-zinc-800/80 rounded" />
                      <div className="h-2 w-12 bg-zinc-800/80 rounded" />
                      <div className="h-2 w-8 bg-zinc-800/80 rounded" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 items-center py-1.5 illust-t-row-swap-1 absolute left-0 right-0 top-[18px] bg-zinc-950/40 p-1 rounded border border-white/[0.01]">
                      <div className="h-1.5 w-14 bg-white/10 rounded" />
                      <div className="h-1.5 w-8 bg-emerald-500/10 border border-emerald-500/20 rounded" />
                      <div className="h-1.5 w-10 bg-zinc-800/60 rounded" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 items-center py-1.5 illust-t-row-swap-2 absolute left-0 right-0 top-[50px] bg-zinc-950/40 p-1 rounded border border-white/[0.01]">
                      <div className="h-1.5 w-10 bg-white/10 rounded" />
                      <div className="h-1.5 w-8 bg-rose-500/10 border border-rose-500/20 rounded" />
                      <div className="h-1.5 w-12 bg-zinc-800/60 rounded" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center py-1.5 absolute left-0 right-0 top-[82px] p-1 bg-zinc-950/10 rounded">
                      <div className="h-1.5 w-16 bg-white/10 rounded" />
                      <div className="h-1.5 w-8 bg-zinc-700/30 rounded" />
                      <div className="h-1.5 w-6 bg-zinc-800/60 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="absolute inset-0 pointer-events-none rounded-2xl illust-shimmer-bg opacity-25" />
                </div>

                {/* 2. BOARD ILLUSTRATION */}
                <div className={`absolute inset-0 transition-opacity duration-500 ease-in-out flex flex-col justify-center p-4 ${
                  viewLayout === 'board' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}>
                  <div className="grid grid-cols-3 gap-2.5 h-[180px]">
                    <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-2 flex flex-col gap-1.5 h-full">
                      <div className="text-[8px] font-semibold text-zinc-500 border-b border-white/[0.03] pb-1 font-mono uppercase tracking-wider">Backlog</div>
                      <div className="p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg space-y-1 illust-k-card-1">
                        <div className="h-1.5 w-full bg-zinc-700/60 rounded" />
                        <div className="h-1 w-6 bg-zinc-800 rounded" />
                      </div>
                      <div className="p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg space-y-1 illust-k-card-2">
                        <div className="h-1.5 w-8 bg-zinc-700/60 rounded" />
                        <div className="h-1 w-4 bg-zinc-800 rounded" />
                      </div>
                    </div>

                    <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-2 flex flex-col gap-1.5 h-full relative">
                      <div className="text-[8px] font-semibold text-zinc-500 border-b border-white/[0.03] pb-1 font-mono uppercase tracking-wider">Running</div>
                      
                      <div className="p-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg space-y-1 absolute left-2 right-2 top-[24px] z-10 illust-k-card-drag">
                        <div className="h-1.5 w-10 bg-zinc-400 rounded" />
                        <div className="h-1 w-4 bg-blue-500/20 text-blue-400 rounded" />
                      </div>
                      
                      <div className="p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg space-y-1 opacity-0">
                        <div className="h-1.5 w-full" />
                      </div>
                    </div>

                    <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-2 flex flex-col gap-1.5 h-full">
                      <div className="text-[8px] font-semibold text-zinc-500 border-b border-white/[0.03] pb-1 font-mono uppercase tracking-wider">Done</div>
                      <div className="p-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg space-y-1 illust-k-card-3">
                        <div className="h-1.5 w-full bg-zinc-700/60 rounded" />
                        <div className="h-1 w-4 bg-emerald-500/20 text-emerald-400 rounded" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. CARDS ILLUSTRATION */}
                <div className={`absolute inset-0 transition-opacity duration-500 ease-in-out flex flex-col justify-center p-4 ${
                  viewLayout === 'cards' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}>
                  <div className="grid grid-cols-2 gap-2.5 illust-c-grid">
                    <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-1.5 w-6 bg-zinc-700 rounded" />
                        <div className="w-1 h-1 rounded-full bg-zinc-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-zinc-500/50 rounded" />
                        <div className="h-1 w-8 bg-zinc-600/30 rounded" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border space-y-2 illust-c-hover-card transition-all">
                      <div className="flex justify-between items-center">
                        <div className="h-1.5 w-8 bg-zinc-300 rounded" />
                        <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-zinc-100 rounded" />
                        <div className="h-1 w-10 bg-zinc-400 rounded" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-1.5 w-7 bg-zinc-700 rounded" />
                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-zinc-500/50 rounded" />
                        <div className="h-1 w-12 bg-zinc-600/30 rounded" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-1.5 w-5 bg-zinc-700 rounded" />
                        <div className="w-1 h-1 rounded-full bg-zinc-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-zinc-500/50 rounded" />
                        <div className="h-1 w-6 bg-zinc-600/30 rounded" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. LIST ILLUSTRATION */}
                <div className={`absolute inset-0 transition-opacity duration-500 ease-in-out flex flex-col justify-center p-4 ${
                  viewLayout === 'list' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}>
                  <div className="space-y-2 relative h-[130px] illust-l-container">
                    <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full border border-white/20 flex items-center justify-center illust-l-dot shrink-0" />
                        <div className="h-2 w-24 bg-zinc-200/80 rounded illust-l-strike" />
                      </div>
                      <div className="h-1.5 w-6 bg-zinc-800 rounded shrink-0" />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full border border-white/20 flex items-center justify-center shrink-0" />
                        <div className="h-2 w-16 bg-zinc-400 rounded" />
                      </div>
                      <div className="h-1.5 w-10 bg-zinc-800 rounded shrink-0" />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-white/[0.01] border border-white/[0.03]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full border border-white/20 flex items-center justify-center shrink-0" />
                        <div className="h-2 w-20 bg-zinc-400 rounded" />
                      </div>
                      <div className="h-1.5 w-8 bg-zinc-800 rounded shrink-0" />
                    </div>
                    
                    <div className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none illust-l-sweep" />
                  </div>
                </div>
              </div>

              {/* Right Column: Minimally Structured Glass Form */}
              <div className="lg:col-span-6 flex flex-col justify-between">
                <form onSubmit={handleCreateView} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">View Name</label>
                    <input
                      type="text"
                      required
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                      placeholder="e.g. Completed Tasks, Urgent Bugs..."
                      className="w-full bg-zinc-900/50 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Filter By</label>
                      <select
                        value={filterProp}
                        onChange={(e) => setFilterProp(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="all">None (Show All)</option>
                        {properties.map(p => (
                          <option key={p.name} value={p.name}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Sort By</label>
                      <select
                        value={sortProp}
                        onChange={(e) => setSortProp(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        {properties.map(p => (
                          <option key={p.name} value={p.name}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filterProp !== 'all' && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Matches Value</label>
                      <input
                        type="text"
                        value={filterVal}
                        onChange={(e) => setFilterVal(e.target.value)}
                        placeholder="e.g. High, Backlog, Sarah..."
                        className="w-full bg-zinc-900/50 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Sort Order</label>
                    <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-white/[0.06] mt-0.5">
                      <button
                        type="button"
                        onClick={() => setSortOrder('asc')}
                        className={`flex-1 py-1 rounded-md text-[10px] font-semibold text-center transition-all ${
                          sortOrder === 'asc' ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Ascending
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('desc')}
                        className={`flex-1 py-1 rounded-md text-[10px] font-semibold text-center transition-all ${
                          sortOrder === 'desc' ? 'bg-white/10 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Descending
                      </button>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 flex justify-end gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
                    >
                      Create View
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM DIALOG/MODAL */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setShowAddItemModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" />
              <span>Add Database Record ({deptKey})</span>
            </h3>

            <form onSubmit={handleAddItem} className="space-y-4">
              {properties.map(p => (
                <div key={p.name}>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    {p.label} {p.required && <span className="text-rose-400">*</span>}
                  </label>
                  
                  {p.type === 'select' ? (
                    <select
                      value={newItemData[p.name] || p.options[0]}
                      onChange={(e) => setNewItemData({ ...newItemData, [p.name]: e.target.value })}
                      className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                    >
                      {p.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : p.type === 'textarea' ? (
                    <textarea
                      value={newItemData[p.name] || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, [p.name]: e.target.value })}
                      rows={3}
                      className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none resize-none font-sans"
                    />
                  ) : (
                    <input
                      type={p.type}
                      required={p.required}
                      placeholder={p.placeholder || ''}
                      value={newItemData[p.name] || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, [p.name]: e.target.value })}
                      className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                    />
                  )}
                </div>
              ))}

              <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
