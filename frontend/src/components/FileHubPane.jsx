import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  FileTextIcon,
  PlusIcon,
  UploadIcon,
  ChevronDownIcon
} from 'lucide-react'
import { normalizeDocumentName } from '../utils/documentInteractions'
import DocPreviewer from './DocPreviewer'

export default function FileHubPane() {
  const {
    files,
    fetchFiles,
    selectedFileContent,
    selectedFilePath,
    loadFileContent,
    saveFileContent,
    workspaceId
  } = useWorkspaceStore()

  const [expandedAIs, setExpandedAIs] = useState({
    secretary: false,
    coo: false,
    cto: false,
    cmo: false,
    cfo: false,
    cpo: false
  })

  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    if (files.length > 0 && !selectedFilePath) {
      handleSelectFile(files[0].path)
    }
  }, [files])

  const handleSelectFile = async (path) => {
    await loadFileContent(path)
  }

  const handleNewFile = async () => {
    const rawName = prompt('Enter document name (e.g. business_pitch.slide.md, budget.csv, index.html, notes.md):', 'notes.md')
    const fileName = normalizeDocumentName(rawName)
    if (!fileName) return

    let template = `# ${fileName}\n\n`
    if (fileName.endsWith('.slide.md')) {
      template = `# Presentation Deck\n\n---\n## Slide 1\n- Point one\n- Point two\n\n---\n## Slide 2\n- Next point`
    } else if (fileName.endsWith('.csv')) {
      template = `Item,Qty,Unit Price,Total Cost\nMarketing Ads,1,$500,$500\nTotal,,,500`
    }

    const ok = await saveFileContent(fileName, template)
    if (ok) {
      await fetchFiles()
      await loadFileContent(fileName)
    }
  }

  const handleUploadFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const fileName = normalizeDocumentName(file.name)
    const reader = new FileReader()

    reader.onload = async () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      const ok = await saveFileContent(fileName, content)
      if (ok) {
        await fetchFiles()
        await loadFileContent(fileName)
      }
    }

    reader.readAsText(file)
  }

  // Group files into AI files and general files
  const { aiGroups, general } = useMemo(() => {
    const groups = {
      secretary: [],
      coo: [],
      cto: [],
      cmo: [],
      cfo: [],
      cpo: []
    }
    const gen = []

    files.forEach(file => {
      if (file.path.startsWith('agents/')) {
        const parts = file.path.split('/')
        const role = parts[1] // e.g. 'secretary'
        if (groups[role]) {
          groups[role].push(file)
        } else {
          if (!groups[role]) groups[role] = []
          groups[role].push(file)
        }
      } else {
        gen.push(file)
      }
    })

    return { aiGroups: groups, general: gen }
  }, [files])

  // Get display tag for general files
  const getFileTag = (path) => {
    if (path === 'AIM.md') return 'Core'
    if (path === 'OPERATIONS.md') return 'Ops'
    if (path === 'FINANCE.md') return 'Finance'
    if (path.endsWith('.slide.md')) return 'Slide'
    if (path.endsWith('.csv')) return 'CSV'
    if (path.endsWith('.md')) return 'Doc'
    if (path.endsWith('.html') || path.endsWith('.htm')) return 'HTML'
    return 'File'
  }

  const toggleAI = (role) => {
    setExpandedAIs(prev => ({ ...prev, [role]: !prev[role] }))
  }

  return (
    <div className="flex h-full bg-transparent animate-fade-in relative overflow-hidden items-stretch">
      
      {/* LEFT DOCUMENT SIDEBAR */}
      <div className="w-[220px] my-3 ml-3 mr-1.5 rounded-2xl glass-sub-sidebar flex flex-col select-none text-left overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Docs Hub</h2>
            <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Workspace Files</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 border-b border-white/[0.04] flex gap-2">
          <button
            onClick={handleNewFile}
            className="flex-1 h-8 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5 text-zinc-300" />
            <span>New</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-8 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold transition-all"
          >
            <UploadIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload</span>
          </button>
        </div>

        {/* Scrollable File List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* AI Staff Files Dropdowns */}
          <div className="space-y-2.5">
            <div className="px-2 pb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">AI Staff Docs</div>
            {Object.keys(aiGroups).map(role => {
              const roleFiles = aiGroups[role]
              if (roleFiles.length === 0) return null
              const isExpanded = expandedAIs[role]
              return (
                <div key={role} className="space-y-1.5">
                  <button
                    onClick={() => toggleAI(role)}
                    className={`w-full h-9 px-3 rounded-lg flex items-center justify-between text-xs font-semibold transition-colors ${
                      isExpanded ? 'text-white bg-white/[0.04]' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>{role === 'secretary' ? 'Secretary' : role.toUpperCase()}</span>
                    <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  {isExpanded && (
                    <div className="pl-3 border-l border-white/[0.04] ml-2.5 space-y-1.5 mt-1">
                      {roleFiles.map(file => {
                        const isSelected = file.path === selectedFilePath
                        const baseName = file.path.split('/').pop()
                        return (
                          <button
                            key={file.path}
                            onClick={() => handleSelectFile(file.path)}
                            className={`w-full text-left px-2.5 py-2 rounded-md text-[11px] truncate transition-colors ${
                              isSelected
                                ? 'bg-white/[0.08] text-white font-semibold'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                            }`}
                          >
                            {baseName}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* General Workspace Files */}
          <div className="space-y-2.5">
            <div className="px-2 pb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Documents</div>
            {general.length === 0 ? (
              <div className="text-[10px] text-zinc-500 px-2 py-2">No custom documents</div>
            ) : (
              <div className="space-y-1.5">
                {general.map(file => {
                  const isSelected = file.path === selectedFilePath
                  const tag = getFileTag(file.path)
                  return (
                    <button
                      key={file.path}
                      onClick={() => handleSelectFile(file.path)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/10 text-white font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border-transparent'
                      }`}
                    >
                      <span className="truncate flex-1 pr-1.5">{file.path}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/70 border border-white/[0.08] text-[9px] font-medium font-mono uppercase tracking-wider shrink-0">
                        {tag}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".md,.txt,.csv,.json,.yaml,.yml,.log,.html,.htm"
        onChange={handleUploadFile}
      />

      {/* Main File Viewer/Editor Area (Full Widescreen) */}
      <div className="flex-1 my-3 mr-3 ml-1.5 rounded-2xl glass-content-card flex flex-col overflow-hidden relative">
        {selectedFilePath ? (
          <DocPreviewer
            filePath={selectedFilePath}
            content={selectedFileContent}
            onSave={async (newContent) => {
              await saveFileContent(selectedFilePath, newContent)
            }}
            onClose={() => {
              // Reset selected file to close preview
              useWorkspaceStore.setState({ selectedFilePath: null, selectedFileContent: null })
            }}
            workspaceId={workspaceId}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60 select-none">
            <FileTextIcon className="w-10 h-10 text-zinc-600 mb-4" />
            <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">Company Document</h3>
            <p className="text-xs text-zinc-500 max-w-[240px] font-sans">
              Select a document to read or edit.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
