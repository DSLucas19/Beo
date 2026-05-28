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
    { id: 'PLN-001', title: 'Q3 Strategic Competitor Analysis', status: 'In Progress', priority: 'High', assignee: 'Sarah (Planner Agent)', dueDate: '2026-06-15', quarter: 'Q3', impact: 'High', description: 'Perform in-depth competitor pricing and features review for the new SEO SaaS.' },
    { id: 'PLN-002', title: 'Establish Weekly Sync SOP', status: 'Completed', priority: 'Medium', assignee: 'Lucas', dueDate: '2026-05-20', quarter: 'Q2', impact: 'Medium', description: 'Define standard operating procedures for sync meetings.' },
    { id: 'PLN-003', title: 'Set Up Onboarding Wizard UI Flow', status: 'Backlog', priority: 'High', assignee: 'John (Developer)', dueDate: '2026-07-01', quarter: 'Q3', impact: 'High', description: 'Draft the screen-by-screen navigation maps for user setup.' }
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
    { id: 'FIN-002', title: 'Gemini Pro API Over-limit Review', status: 'Pending Approval', priority: 'Critical', category: 'API Call Costs', amount: 78.40, paymentMethod: 'Stripe', date: '2026-05-27', requestedBy: 'Planner Agent', description: 'Extra LLM queries during parallel workflow execution test.' },
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
    if (savedViews) {
      const parsedViews = JSON.parse(savedViews)
      setViews(parsedViews)
      if (parsedViews.length > 0) {
        setSelectedViewId(parsedViews[0].id)
      } else {
        setSelectedViewId('')
      }
    } else {
      setViews([])
      setSelectedViewId('')
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

  // Delete current view handler
  const handleDeleteView = () => {
    if (!activeView) return
    const updatedViews = views.filter(v => v.id !== activeView.id)
    setViews(updatedViews)
    localStorage.setItem(viewsStorageKey, JSON.stringify(updatedViews))
    if (updatedViews.length > 0) {
      setSelectedViewId(updatedViews[0].id)
    } else {
      setSelectedViewId('')
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
      {/* Header bar */}
      <div className="h-16 border-b border-white/[0.04] px-6 flex items-center justify-between bg-zinc-950/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300">
            <EyeIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider capitalize">{deptKey} View Panel</h2>
            <p className="text-[10px] text-zinc-500">Custom business visualizations of the team database</p>
          </div>
        </div>

        {/* View selection controls */}
        {views.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedViewId}
              onChange={(e) => setSelectedViewId(e.target.value)}
              className="bg-zinc-900 border border-white/[0.08] hover:border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-colors font-semibold"
            >
              {views.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.layout})</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1 transition-all"
              title="Add new View representation"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>New View</span>
            </button>

            <button
              onClick={handleDeleteView}
              className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition-all"
              title="Delete current representation"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {views.length === 0 ? (
          /* Empty State */
          <div className="h-[60vh] max-w-md mx-auto flex flex-col items-center justify-center text-center p-6 bg-zinc-900/10 border border-white/[0.03] rounded-3xl mt-6">
            <LayersIcon className="w-12 h-12 text-zinc-600 mb-4 opacity-40 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Views Configured</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              This department has no custom view representations of its dataset yet. You can create a new view to layout, filter, and sort tasks and items specifically.
            </p>
            <div className="flex flex-col gap-2 mt-6 w-full">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-white/5"
              >
                <PlusCircleIcon className="w-4 h-4" />
                <span>Create View Customly</span>
              </button>
              <button
                onClick={handleSeedDefaultViews}
                className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Seed Standard Enterprise Views</span>
              </button>
            </div>
          </div>
        ) : (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <EyeIcon className="w-4 h-4" />
              <span>Create Custom Representation</span>
            </h3>

            <form onSubmit={handleCreateView} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">View Name</label>
                <input
                  type="text"
                  required
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g. Completed Tasks, High Budget, Bug Backlog..."
                  className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Layout Type</label>
                  <select
                    value={viewLayout}
                    onChange={(e) => setViewLayout(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="table">Table View</option>
                    <option value="board">Status Kanban Board</option>
                    <option value="cards">Detail Grid Cards</option>
                    <option value="list">Condensed List</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Sort Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="asc">Ascending (A-Z)</option>
                    <option value="desc">Descending (Z-A)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Filter By Property</label>
                  <select
                    value={filterProp}
                    onChange={(e) => setFilterProp(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="all">None (Show All)</option>
                    {properties.map(p => (
                      <option key={p.name} value={p.name}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Sort By Property</label>
                  <select
                    value={sortProp}
                    onChange={(e) => setSortProp(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {properties.map(p => (
                      <option key={p.name} value={p.name}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filterProp !== 'all' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Filter Matches Value</label>
                  <input
                    type="text"
                    value={filterVal}
                    onChange={(e) => setFilterVal(e.target.value)}
                    placeholder="e.g. High, Completed, Google..."
                    className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors"
                >
                  Create View
                </button>
              </div>
            </form>
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
