import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  EditIcon,
  FileTextIcon,
  FolderIcon,
  PlusIcon,
  SaveIcon,
  UploadIcon,
  PresentationIcon,
  TableIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusSquareIcon,
  MinusSquareIcon,
  Trash2Icon,
  ListIcon,
  ChevronDownIcon
} from 'lucide-react'
import { formatBytes, normalizeDocumentName } from '../utils/documentInteractions'

export default function FileHubPane() {
  const {
    files,
    fetchFiles,
    selectedFileContent,
    selectedFilePath,
    loadFileContent,
    saveFileContent
  } = useWorkspaceStore()

  const [editMode, setEditMode] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [isSlideshowMode, setIsSlideshowMode] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [csvGrid, setCsvGrid] = useState(null)
  
  const [expandedAIs, setExpandedAIs] = useState({
    secretary: false,
    planner: false,
    developer: false,
    marketer: false,
    finance: false
  })

  const fileInputRef = useRef(null)

  // Parse CSV into 2D array
  const parseCSV = (text) => {
    if (!text) return [[""]]
    return text.split('\n')
      .map(line => {
        return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      })
      .filter(row => row.length > 0 && (row.length > 1 || row[0] !== ""))
  }

  // Serialize 2D array back to CSV string
  const serializeCSV = (grid) => {
    if (!grid) return ''
    return grid.map(row =>
      row.map(cell => {
        if (cell.includes(',')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    ).join('\n')
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    if (files.length > 0 && !selectedFilePath) {
      handleSelectFile(files[0].path)
    }
  }, [files])

  useEffect(() => {
    if (selectedFileContent !== null) {
      setEditedText(selectedFileContent)
      
      if (selectedFilePath?.endsWith('.slide.md')) {
        setIsSlideshowMode(true)
        setCurrentSlideIndex(0)
      } else {
        setIsSlideshowMode(false)
      }

      if (selectedFilePath?.endsWith('.csv')) {
        setCsvGrid(parseCSV(selectedFileContent))
      } else {
        setCsvGrid(null)
      }
    }
  }, [selectedFileContent, selectedFilePath])

  const handleSelectFile = async (path) => {
    await loadFileContent(path)
    setEditMode(false)
  }

  const handleSave = async () => {
    let contentToSave = editedText
    if (selectedFilePath.endsWith('.csv') && csvGrid) {
      contentToSave = serializeCSV(csvGrid)
    }
    const ok = await saveFileContent(selectedFilePath, contentToSave)
    if (ok) {
      setEditMode(false)
    }
  }

  const handleNewFile = async () => {
    const rawName = prompt('Enter document name (e.g. business_pitch.slide.md, budget.csv, notes.md):', 'notes.md')
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
      setEditMode(true)
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
        setEditMode(false)
      }
    }

    reader.readAsText(file)
  }

  // Parse markdown slides splitting by '---'
  const slides = useMemo(() => {
    if (!selectedFileContent || !selectedFilePath?.endsWith('.slide.md')) return []
    return selectedFileContent.split('---').map(s => s.trim()).filter(Boolean)
  }, [selectedFileContent, selectedFilePath])

  // Cell change handler
  const handleCellChange = (rowIndex, colIndex, value) => {
    if (!csvGrid) return
    const updated = csvGrid.map((row, r) =>
      row.map((cell, c) => (r === rowIndex && c === colIndex ? value : cell))
    )
    setCsvGrid(updated)
  }

  // Row and Column operations
  const handleAddRow = () => {
    if (!csvGrid) return
    const colCount = csvGrid[0]?.length || 1
    const newRow = Array(colCount).fill('')
    setCsvGrid([...csvGrid, newRow])
  }

  const handleRemoveRow = (rowIndex) => {
    if (!csvGrid || csvGrid.length <= 1) return
    setCsvGrid(csvGrid.filter((_, i) => i !== rowIndex))
  }

  const handleAddColumn = () => {
    if (!csvGrid) return
    setCsvGrid(csvGrid.map(row => [...row, '']))
  }

  const handleRemoveColumn = () => {
    if (!csvGrid || csvGrid[0]?.length <= 1) return
    setCsvGrid(csvGrid.map(row => row.slice(0, -1)))
  }

  const renderMarkdown = (text) => {
    if (!text) return ''

    const html = text
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-semibold text-content-highlight uppercase tracking-wider font-mono mt-5 mb-2.5">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-content-highlight font-display mt-7 mb-3.5 border-b border-border-muted/30 pb-1.5">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-lg font-extrabold text-content-highlight font-display mt-3 mb-5">$1</h1>')
      .replace(/^\s*\-\s*(.*$)/gim, '<li class="ml-5 list-disc mb-1.5 text-sm">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-border-muted px-1.5 py-0.5 rounded font-mono text-accent-blue text-xs">$1</code>')
      .replace(/\n/g, '<br />')

    return <div className="space-y-1.5 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
  }

  const renderSlide = (slideText) => {
    const html = slideText
      .replace(/^### (.*$)/gim, '<h3 class="text-[18px] font-semibold text-content-highlight/90 font-mono mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-[26px] font-bold text-content-highlight font-display border-b border-white/5 pb-2.5 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-[36px] font-black text-white font-display mb-6 tracking-tight">$1</h1>')
      .replace(/^\s*\-\s*(.*$)/gim, '<li class="ml-6 list-disc mb-3 text-base text-content-normal text-left">$2</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-2 py-0.5 rounded font-mono text-white text-sm">$1</code>')
      .replace(/\n/g, '<br />')

    return (
      <div 
        className="w-full max-w-2xl bg-zinc-950/70 border border-white/[0.08] rounded-3xl p-12 min-h-[380px] flex flex-col justify-center shadow-2xl relative"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Group files into AI files and general files
  const { aiGroups, general } = useMemo(() => {
    const groups = {
      secretary: [],
      planner: [],
      developer: [],
      marketer: [],
      finance: []
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
                    <span className="capitalize">{role}</span>
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
        accept=".md,.txt,.csv,.json,.yaml,.yml,.log"
        onChange={handleUploadFile}
      />

      {/* Main File Viewer/Editor Area (Full Widescreen) */}
      <div className="flex-1 my-3 mr-3 ml-1.5 rounded-2xl glass-content-card flex flex-col overflow-hidden">
        {selectedFilePath ? (
          <div key={selectedFilePath} className="flex-1 flex flex-col h-full overflow-hidden file-content-fade-in">
            {/* Header controls */}
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-[#0c0d12]/80 backdrop-blur select-none">
              <div className="flex items-center gap-4">
                <h1 className="text-xs font-semibold text-white font-mono">
                  /{selectedFilePath}
                </h1>
                {/* Mode Toggles for Slides */}
                {selectedFilePath.endsWith('.slide.md') && !editMode && (
                  <div className="flex border border-white/[0.08] rounded-lg p-0.5 bg-black/30">
                    <button
                      onClick={() => setIsSlideshowMode(true)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${isSlideshowMode ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <PresentationIcon className="w-3 h-3" /> Slides
                    </button>
                    <button
                      onClick={() => setIsSlideshowMode(false)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${!isSlideshowMode ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <ListIcon className="w-3 h-3" /> Raw MD
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm"
                    >
                      <SaveIcon className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setEditedText(selectedFileContent); if(selectedFilePath.endsWith('.csv')) setCsvGrid(parseCSV(selectedFileContent)) }}
                      className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold transition-colors"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Viewer Panel */}
            <div className="flex-1 overflow-auto p-8 select-text">
              {editMode ? (
                // ------------------ EDIT MODE ------------------
                selectedFilePath.endsWith('.csv') && csvGrid ? (
                  // Editable spreadsheet grid
                  <div className="space-y-4 text-left">
                    <div className="flex items-center gap-3 border-b border-white/[0.05] pb-3 bg-black/10 p-4 rounded-xl">
                      <button
                        onClick={handleAddRow}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white rounded-lg text-[10px] font-bold font-mono transition-all"
                      >
                        <PlusSquareIcon className="w-3.5 h-3.5" /> Add Row
                      </button>
                      <button
                        onClick={handleAddColumn}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white rounded-lg text-[10px] font-bold font-mono transition-all"
                      >
                        <PlusSquareIcon className="w-3.5 h-3.5" /> Add Column
                      </button>
                      <button
                        onClick={handleRemoveColumn}
                        disabled={csvGrid[0]?.length <= 1}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white rounded-lg text-[10px] font-bold font-mono transition-all disabled:opacity-30"
                      >
                        <MinusSquareIcon className="w-3.5 h-3.5" /> Remove Column
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-white/[0.05] rounded-xl bg-zinc-950/20 shadow-inner">
                      <table className="min-w-full divide-y divide-white/[0.05]">
                        <thead className="bg-white/[0.02]">
                          <tr>
                            <th className="w-10 px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-500 border-r border-white/[0.05]">#</th>
                            {csvGrid[0]?.map((_, colIdx) => (
                              <th key={colIdx} className="px-3 py-2 text-left text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider border-r border-white/[0.05]">
                                Col {String.fromCharCode(65 + colIdx)}
                              </th>
                            ))}
                            <th className="w-12 px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-500">Act</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {csvGrid.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-white/[0.01]">
                              <td className="px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-600 border-r border-white/[0.05]">
                                {rowIdx + 1}
                              </td>
                              {row.map((cellValue, colIdx) => (
                                <td key={colIdx} className="p-1 border-r border-white/[0.05]">
                                  <input
                                    type="text"
                                    value={cellValue}
                                    onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                                    className="w-full bg-transparent text-xs text-white border-0 focus:bg-white/[0.04] focus:outline-none px-2 py-1.5 rounded"
                                  />
                                </td>
                              ))}
                              <td className="p-1 text-center">
                                <button
                                  onClick={() => handleRemoveRow(rowIdx)}
                                  disabled={csvGrid.length <= 1}
                                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded hover:bg-white/[0.04] transition-colors disabled:opacity-20"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // Default text editor
                  <div className="w-full h-[80vh] border border-white/[0.06] rounded-2xl overflow-hidden bg-[#0d0e12] shadow-inner text-left">
                    <textarea
                      value={editedText}
                      onChange={(event) => setEditedText(event.target.value)}
                      className="w-full h-full p-6 bg-transparent text-zinc-200 font-mono text-sm outline-none resize-none leading-relaxed"
                    />
                  </div>
                )
              ) : (
                // ------------------ VIEW MODE ------------------
                isSlideshowMode && slides.length > 0 ? (
                  // Markdown Presentation slideshow view
                  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
                    {renderSlide(slides[currentSlideIndex])}
                    
                    <div className="flex items-center gap-6 bg-[#0c0d12]/80 border border-white/[0.05] p-3 rounded-2xl shadow-lg">
                      <button
                        onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentSlideIndex === 0}
                        className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        {currentSlideIndex + 1} / {slides.length}
                      </span>
                      <button
                        onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                        disabled={currentSlideIndex === slides.length - 1}
                        className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : selectedFilePath.endsWith('.csv') && csvGrid ? (
                  // Static CSV table rendering
                  <div className="max-w-3xl mx-auto overflow-x-auto border border-white/[0.05] rounded-xl bg-zinc-950/20 text-left">
                    <table className="min-w-full divide-y divide-white/[0.05]">
                      <thead className="bg-white/[0.02]">
                        <tr>
                          {csvGrid[0]?.map((colHeader, colIdx) => (
                            <th key={colIdx} className="px-4 py-3 text-left text-xs font-bold text-white font-sans border-r border-white/[0.05]">
                              {colHeader}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {csvGrid.slice(1).map((row, rowIdx) => (
                           <tr key={rowIdx} className="hover:bg-white/[0.01]">
                            {row.map((cellValue, colIdx) => (
                              <td key={colIdx} className="px-4 py-3 text-xs text-zinc-300 border-r border-white/[0.05]">
                                {cellValue}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Static document reading
                  <div className="max-w-3xl mx-auto text-sm text-zinc-300 leading-relaxed text-left">
                    {selectedFilePath.endsWith('.md') ? (
                      renderMarkdown(selectedFileContent)
                    ) : (
                      <pre className="p-6 bg-[#0d0e12] border border-white/[0.05] rounded-2xl font-mono whitespace-pre-wrap text-sm leading-relaxed animate-fade-in text-zinc-200">
                        {selectedFileContent}
                      </pre>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
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
