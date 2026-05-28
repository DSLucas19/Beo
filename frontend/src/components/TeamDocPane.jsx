import React, { useState, useEffect, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  EyeIcon,
  EditIcon,
  BookOpenIcon,
  PlusCircleIcon,
  CheckIcon,
  XIcon,
  InfoIcon,
  AlertCircleIcon
} from 'lucide-react'

export default function TeamDocPane({ department }) {
  const { workspaceId, files, fetchFiles, saveFileContent } = useWorkspaceStore()
  const deptKey = useMemo(() => department.replace('dep_', '').toLowerCase(), [department])
  
  // States
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [docContent, setDocContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [editorMode, setEditorMode] = useState('preview') // 'edit' | 'preview'
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'success' | 'error' | null
  const [loadingContent, setLoadingContent] = useState(false)

  // Get documents belonging exclusively to this team/department
  // e.g. path starts with "docs/planning/"
  const teamDocs = useMemo(() => {
    if (!files || !Array.isArray(files)) return []
    const prefix = `docs/${deptKey}/`
    return files.filter(f => {
      const path = (f.path || '').toLowerCase()
      return path.startsWith(prefix)
    })
  }, [files, deptKey])

  // Load active file content
  useEffect(() => {
    if (selectedFilePath) {
      const loadContent = async () => {
        setLoadingContent(true)
        setSaveStatus(null)
        try {
          const res = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/files/${selectedFilePath}`)
          if (res.ok) {
            const data = await res.json()
            setDocContent(data.content)
            setOriginalContent(data.content)
          } else {
            console.error('Failed to load file content')
          }
        } catch (e) {
          console.error(e)
        } finally {
          setLoadingContent(false)
        }
      }
      loadContent()
    } else {
      setDocContent('')
      setOriginalContent('')
    }
  }, [selectedFilePath, workspaceId])

  // Auto select first file if none selected
  useEffect(() => {
    if (teamDocs.length > 0 && !selectedFilePath) {
      setSelectedFilePath(teamDocs[0].path)
    } else if (teamDocs.length === 0) {
      setSelectedFilePath('')
    }
  }, [teamDocs, selectedFilePath])

  // Create new document
  const handleCreateDocument = async (e) => {
    e.preventDefault()
    if (!newDocName.trim()) return

    // Clean name and append .md
    let cleanName = newDocName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')
    if (!cleanName.endsWith('.md')) {
      cleanName += '.md'
    }

    const filePath = `docs/${deptKey}/${cleanName}`
    const displayTitle = newDocName.trim().replace(/\.md$/, '')
    const initialContent = `# ${displayTitle}\n\nThis document is exclusive to the **${deptKey.toUpperCase()}** team.\n\n## Section 1: Overview\nProvide a brief summary of this document here.\n\n## Section 2: Operational Steps\n1. Step one\n2. Step two\n3. Step three\n`

    try {
      const ok = await saveFileContent(filePath, initialContent)
      if (ok) {
        // Refresh store files list
        await fetchFiles()
        setSelectedFilePath(filePath)
        setEditorMode('edit')
        setShowCreateModal(false)
        setNewDocName('')
      } else {
        alert("Failed to create document on server.")
      }
    } catch (err) {
      console.error(err)
      alert("Error creating document.")
    }
  }

  // Save document changes
  const handleSaveDocument = async () => {
    if (!selectedFilePath) return
    setIsSaving(true)
    setSaveStatus(null)
    try {
      const ok = await saveFileContent(selectedFilePath, docContent)
      if (ok) {
        setOriginalContent(docContent)
        setSaveStatus('success')
        // Hide success badge after 3 seconds
        setTimeout(() => setSaveStatus(null), 3000)
      } else {
        setSaveStatus('error')
      }
    } catch (e) {
      setSaveStatus('error')
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  // Simple custom Markdown rendering for premium previews
  const renderMarkdownPreview = (text) => {
    if (!text) return <p className="text-zinc-500 italic text-xs">No content in document.</p>
    const lines = text.split('\n')
    
    let currentList = null
    const elements = []

    const flushList = (key) => {
      if (currentList) {
        const Tag = currentList.type
        elements.push(
          <Tag key={`list-${key}`} className="my-3 pl-6 space-y-1.5 list-outside">
            {currentList.items.map((item, idx) => (
              <li key={idx} className={`${currentList.type === 'ul' ? 'list-disc' : 'list-decimal'} text-zinc-300 text-sm leading-relaxed`}>
                {item}
              </li>
            ))}
          </Tag>
        )
        currentList = null
      }
    }

    const parseInline = (lineText) => {
      const parts = lineText.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
      return parts.map((part, index) => {
        if (!part) return null
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={index} className="bg-white/[0.06] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono text-zinc-300 text-xs">{part.slice(1, -1)}</code>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>
        }
        return part
      })
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushList(i)
        elements.push(<hr key={i} className="my-5 border-t border-white/[0.08]" />)
        continue
      }

      if (/^\s*[\-\*\+]\s+(.*)/.test(line)) {
        const content = line.match(/^\s*[\-\*\+]\s+(.*)/)[1]
        const rendered = parseInline(content)
        if (!currentList || currentList.type !== 'ul') {
          flushList(i)
          currentList = { type: 'ul', items: [rendered] }
        } else {
          currentList.items.push(rendered)
        }
        continue
      }

      if (/^\s*\d+\s*\.\s+(.*)/.test(line)) {
        const content = line.match(/^\s*\d+\s*\.\s+(.*)/)[1]
        const rendered = parseInline(content)
        if (!currentList || currentList.type !== 'ol') {
          flushList(i)
          currentList = { type: 'ol', items: [rendered] }
        } else {
          currentList.items.push(rendered)
        }
        continue
      }

      flushList(i)

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-xl font-bold text-white font-display mt-6 mb-3 border-b border-white/[0.06] pb-2 tracking-tight">
            {parseInline(trimmed.slice(2))}
          </h1>
        )
        continue
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-base font-bold text-white font-display mt-5 mb-2.5 border-b border-white/[0.04] pb-1.5 tracking-tight">
            {parseInline(trimmed.slice(3))}
          </h2>
        )
        continue
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-xs font-bold text-zinc-300 font-mono uppercase tracking-wider mt-4 mb-1.5">
            {parseInline(trimmed.slice(4))}
          </h3>
        )
        continue
      }
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="pl-4 border-l-2 border-white/20 text-zinc-400 italic my-3 text-xs leading-relaxed">
            {parseInline(trimmed.slice(2))}
          </blockquote>
        )
        continue
      }

      if (trimmed) {
        elements.push(
          <p key={i} className="leading-relaxed text-sm text-zinc-300 my-2">
            {parseInline(line)}
          </p>
        )
      } else {
        elements.push(<div key={i} className="h-2" />)
      }
    }

    flushList('end')
    return <div className="markdown-preview max-w-none text-left select-text">{elements}</div>
  }

  const hasUnsavedChanges = docContent !== originalContent

  return (
    <div className="flex-1 flex h-full bg-zinc-950/10 text-left overflow-hidden">
      
      {/* LEFT COLUMN: DOCUMENT EXPLORER (200px) */}
      <div className="w-[200px] border-r border-white/[0.04] flex flex-col bg-zinc-950/20 shrink-0">
        <div className="p-3 border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Team Docs</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white transition-all"
            title="Create new team SOP/Document"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {teamDocs.length === 0 ? (
            <div className="py-8 px-2 text-center text-[10px] text-zinc-600 font-mono">
              No docs configured.
            </div>
          ) : (
            teamDocs.map(doc => {
              const isActive = doc.path === selectedFilePath
              const docTitle = doc.name.replace(/\.md$/, '').replace(/_/g, ' ')
              return (
                <button
                  key={doc.path}
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (!confirm("You have unsaved changes. Discard them?")) return
                    }
                    setSelectedFilePath(doc.path)
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-white/[0.08] text-white font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <FileTextIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  <span className="truncate capitalize">{docTitle}</span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: EDITOR & VIEWPORT */}
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        {selectedFilePath ? (
          <>
            {/* Toolbar */}
            <div className="h-12 border-b border-white/[0.04] px-6 flex items-center justify-between bg-zinc-950/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-zinc-300 truncate font-mono">
                  {selectedFilePath.split('/').pop()}
                </span>
                {hasUnsavedChanges && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] shrink-0" title="Unsaved changes" />
                )}
              </div>

              {/* Mode toggles */}
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg bg-zinc-900 border border-white/[0.05] p-0.5">
                  <button
                    onClick={() => setEditorMode('preview')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                      editorMode === 'preview'
                        ? 'bg-white/[0.06] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <EyeIcon className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setEditorMode('edit')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                      editorMode === 'edit'
                        ? 'bg-white/[0.06] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <EditIcon className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveDocument}
                  disabled={!hasUnsavedChanges || isSaving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    hasUnsavedChanges && !isSaving
                      ? 'bg-white text-black hover:bg-zinc-200 shadow-md'
                      : 'bg-zinc-900 border border-white/[0.06] text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <span className="w-3 h-3 rounded-full border-2 border-zinc-400 border-t-zinc-800 animate-spin" />
                  ) : (
                    <SaveIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-auto p-6 relative">
              {/* Floating Save Status */}
              {saveStatus === 'success' && (
                <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 z-10 animate-fade-in shadow-lg">
                  <CheckIcon className="w-4 h-4" />
                  <span>Saved successfully</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="absolute top-4 right-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 z-10 animate-fade-in shadow-lg">
                  <AlertCircleIcon className="w-4 h-4" />
                  <span>Failed to save</span>
                </div>
              )}

              {loadingContent ? (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  <span className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white animate-spin mr-2" />
                  <span className="text-xs font-semibold">Loading document...</span>
                </div>
              ) : (
                <>
                  {editorMode === 'edit' ? (
                    <textarea
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full h-full bg-transparent border-0 resize-none outline-none font-mono text-[13.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:ring-0 select-text p-2"
                      placeholder="Write your team documentation here using Markdown..."
                    />
                  ) : (
                    <div className="p-2 prose prose-invert prose-sm">
                      {renderMarkdownPreview(docContent)}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* Empty state - No docs configured */
          <div className="h-[60vh] max-w-md mx-auto flex flex-col items-center justify-center text-center p-6 mt-6">
            <BookOpenIcon className="w-12 h-12 text-zinc-600 mb-4 opacity-40 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Team Documents</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              There are no documents configured for the {deptKey} department. Document internal SOPs, meeting notes, guides, and workflows exclusive to this team.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-white/5"
            >
              <PlusCircleIcon className="w-4 h-4" />
              <span>Create First Document</span>
            </button>
          </div>
        )}
      </div>

      {/* CREATE DOCUMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FileTextIcon className="w-4 h-4" />
              <span>Create SOP / Document</span>
            </h3>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="e.g. Code Review Checklist, SEO Marketing Guide..."
                  className="w-full bg-zinc-900 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>

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
                  Create Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
