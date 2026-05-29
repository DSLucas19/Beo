import React, { useEffect, useState, useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import {
  FolderIcon,
  FileTextIcon,
  PlayIcon,
  ClipboardListIcon,
  ScrollTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PresentationIcon,
  ListIcon,
  ChevronDownIcon
} from 'lucide-react'

export default function ProjectPane() {
  const { 
    activeTab, 
    workflows, 
    projectFiles, 
    selectedProjectFileContent, 
    selectedProjectFilePath,
    fetchProjectFiles, 
    loadProjectFileContent,
    runWorkflowStep,
    retryWorkflowStep,
    workspaceId
  } = useWorkspaceStore()

  const projectName = activeTab.replace('proj_', '')
  const [activeSubView, setActiveSubView] = useState('specs') // 'specs' | 'workflows' | 'files'

  const [isSlideshowMode, setIsSlideshowMode] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [csvGrid, setCsvGrid] = useState(null)
  
  const [exportingState, setExportingState] = useState(null)

  const exportingMessages = {
    analyzing: "Analyzing document outline & structure...",
    generating: "Generating responsive Tailwind CSS grid layouts...",
    rendering: "Launching Playwright to render slide vector frames...",
    assembling: "Converting layers to native editable PowerPoint shapes...",
    printing: "Printing high-fidelity document PDF with A4 grid pages...",
  }

  const handleExportPPTX = async () => {
    if (!selectedProjectFilePath) return
    try {
      setExportingState('analyzing')
      const t1 = setTimeout(() => setExportingState('generating'), 1500)
      const t2 = setTimeout(() => setExportingState('rendering'), 3000)
      const t3 = setTimeout(() => setExportingState('assembling'), 4500)
      
      const effectiveWorkspaceId = workspaceId || 'beo_corp'
      const response = await fetch(`http://localhost:8000/api/workspaces/${effectiveWorkspaceId}/slides/export-pptx?file_path=${encodeURIComponent(selectedProjectFilePath)}&project_name=${encodeURIComponent(projectName)}`, {
        method: 'POST'
      })
      
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedProjectFilePath.replace('.slide.md', '.pptx').split('/').pop()
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting PPTX: ' + error.message)
    } finally {
      setExportingState(null)
    }
  }

  const handleExportPDF = async () => {
    if (!selectedProjectFilePath) return
    try {
      setExportingState('analyzing')
      const t1 = setTimeout(() => setExportingState('generating'), 1000)
      const t2 = setTimeout(() => setExportingState('printing'), 2500)
      
      const effectiveWorkspaceId = workspaceId || 'beo_corp'
      const response = await fetch(`http://localhost:8000/api/workspaces/${effectiveWorkspaceId}/docs/export-pdf?file_path=${encodeURIComponent(selectedProjectFilePath)}&project_name=${encodeURIComponent(projectName)}`, {
        method: 'POST'
      })
      
      clearTimeout(t1)
      clearTimeout(t2)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedProjectFilePath.replace('.md', '.pdf').split('/').pop()
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setExportingState(null)
    }
  }

  useEffect(() => {
    fetchProjectFiles(projectName)
  }, [activeTab])

  // Tự động load PRODUCT.md khi mở Specs
  useEffect(() => {
    if (activeSubView === 'specs') {
      loadProjectFileContent(projectName, 'PRODUCT.md')
    } else if (activeSubView === 'files' && projectFiles.length > 0) {
      loadProjectFileContent(projectName, projectFiles[0].path)
    }
  }, [activeSubView, projectFiles])

  // Parse CSV and slides when content loads
  useEffect(() => {
    if (selectedProjectFileContent !== null) {
      if (selectedProjectFilePath?.endsWith('.slide.md')) {
        setIsSlideshowMode(true)
        setCurrentSlideIndex(0)
      } else {
        setIsSlideshowMode(false)
      }

      if (selectedProjectFilePath?.endsWith('.csv')) {
        const rows = selectedProjectFileContent.split('\n')
          .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
          .filter(row => row.length > 0 && (row.length > 1 || row[0] !== ""))
        setCsvGrid(rows)
      } else {
        setCsvGrid(null)
      }
    }
  }, [selectedProjectFileContent, selectedProjectFilePath])

  // Lọc các workflows thuộc dự án này
  const projectWorkflows = workflows.filter(w => w.project_name === projectName)

  const slides = useMemo(() => {
    if (!selectedProjectFileContent || !selectedProjectFilePath?.endsWith('.slide.md')) return []
    return selectedProjectFileContent.split('---').map(s => s.trim()).filter(Boolean)
  }, [selectedProjectFileContent, selectedProjectFilePath])

  // Markdown renderer đơn giản
  const renderMarkdown = (text) => {
    if (!text) return <p className="text-xs text-content-muted">Loading specification document...</p>
    let html = text
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-semibold text-content-highlight uppercase tracking-wider font-mono mt-5 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-content-highlight font-display mt-6 mb-3 border-b border-white/[0.04] pb-1">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-lg font-extrabold text-content-highlight font-display mt-2 mb-4">$1</h1>')
      .replace(/^\s*\-\s*(.*$)/gim, '<li class="ml-5 list-disc mb-1.5 text-sm">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-border-muted px-1.5 py-0.5 rounded font-mono text-[#00f0ff] text-xs">$1</code>')
      .replace(/\n/g, '<br />')
    return <div className="space-y-1.5 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
  }

  const renderSlide = (slideText) => {
    const html = slideText
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-content-highlight/90 font-mono mt-3 mb-1.5">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-content-highlight font-display border-b border-white/5 pb-2 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-extrabold text-white font-display mb-4 tracking-tight">$1</h1>')
      .replace(/^\s*\-\s*(.*$)/gim, '<li class="ml-5 list-disc mb-2 text-xs text-content-normal text-left">$2</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-white text-xs">$1</code>')
      .replace(/\n/g, '<br />')

    return (
      <div 
        className="w-full max-w-xl bg-zinc-950/70 border border-white/[0.08] rounded-2xl p-8 min-h-[280px] flex flex-col justify-center shadow-xl relative"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden select-none font-sans file-content-fade-in text-content-normal relative">
      
      {/* Header bar */}
      <div className="flex items-center justify-center border-b border-white/[0.04] px-6 py-4 bg-[#0d0e12]">
        <div className="flex bg-[#13151b] border border-white/[0.03] p-1 rounded-xl">
          <button 
            onClick={() => setActiveSubView('specs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeSubView === 'specs' 
                ? 'bg-border-muted text-content-highlight shadow-md' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            <ScrollTextIcon className="w-3.5 h-3.5" />
            <span>Product Specs</span>
          </button>
          <button 
            onClick={() => setActiveSubView('workflows')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeSubView === 'workflows' 
                ? 'bg-border-muted text-content-highlight shadow-md' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            <ClipboardListIcon className="w-3.5 h-3.5" />
            <span>Workflows ({projectWorkflows.length})</span>
          </button>
          <button 
            onClick={() => setActiveSubView('files')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeSubView === 'files' 
                ? 'bg-border-muted text-content-highlight shadow-md' 
                : 'text-content-muted hover:text-content-normal'
            }`}
          >
            <FileTextIcon className="w-3.5 h-3.5" />
            <span>Workspace Files</span>
          </button>
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* Specs View */}
        {activeSubView === 'specs' && (
          <div className="h-full overflow-y-auto p-8 select-text">
            <div className="max-w-3xl mx-auto bg-[#0f1116] border border-white/[0.04] rounded-3xl p-8 shadow-2xl">
              {renderMarkdown(selectedProjectFileContent)}
            </div>
          </div>
        )}

        {/* Workflows view */}
        {activeSubView === 'workflows' && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <div className="max-w-3xl mx-auto space-y-3 text-left">
              <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider mb-2">
                Project Workflow Steps
              </div>
              {projectWorkflows.length === 0 ? (
                <div className="bg-[#0f1116] border border-white/[0.03] rounded-2xl p-8 text-center text-xs text-content-muted">
                  No sequential workflow steps compiled yet. Run "Compile SOP" on any SOP document to initialize.
                </div>
              ) : (
                projectWorkflows.map(step => {
                  const isRunning = step.status === 'running'
                  const isFailed = step.status === 'failed'
                  return (
                    <div 
                      key={step.id} 
                      className="bg-[#0f1116] border border-white/[0.03] rounded-2xl p-4 flex items-center justify-between shadow"
                    >
                      <div className="flex flex-col gap-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            step.status === 'completed' ? 'bg-emerald-400' :
                            isFailed ? 'bg-red-400' :
                            isRunning ? 'bg-[#ff007f] animate-ping' : 'bg-content-muted/30'
                          }`} />
                          <span className="text-xs font-bold text-content-highlight capitalize">{step.role} Agent</span>
                        </div>
                        <p className="text-xs text-content-normal mt-1">{step.step_name}</p>
                        {step.error_log && (
                          <p className="text-[10px] text-red-400 font-mono mt-1.5 bg-red-950/20 p-2 rounded-lg border border-red-500/10">
                            {step.error_log}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-border-muted/30 px-2 py-0.5 rounded uppercase mr-2">
                          {step.status}
                        </span>
                        {(step.status === 'pending' || isFailed) && (
                          <button
                            onClick={() => runWorkflowStep(step.id)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff007f] to-[#7f00ff] hover:brightness-110 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(127,0,255,0.3)]"
                          >
                            <PlayIcon className="w-3 h-3" />
                            <span>{isFailed ? 'Retry' : 'Run'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Files view */}
        {activeSubView === 'files' && (
          <div className="h-full flex overflow-hidden relative items-stretch">
            
            {/* LEFT PROJECT FILES SIDEBAR */}
            <div className="w-[220px] my-3 ml-3 mr-1.5 rounded-2xl glass-sub-sidebar flex flex-col select-none text-left shrink-0 overflow-hidden">
              <div className="p-4 border-b border-white/[0.04]">
                <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Project Files</h2>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">/{projectName}</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {projectFiles.length === 0 ? (
                  <div className="text-xs text-zinc-500 px-2 py-4 text-center font-medium">No files found</div>
                ) : (
                  projectFiles.map(file => {
                    const isSelected = file.path === selectedProjectFilePath
                    
                    // Determine tag
                    let tag = 'File'
                    if (file.path === 'PRODUCT.md') tag = 'Specs'
                    else if (file.path.endsWith('.slide.md')) tag = 'Slide'
                    else if (file.path.endsWith('.csv')) tag = 'CSV'
                    else if (file.path.endsWith('.md')) tag = 'Doc'

                    return (
                      <button
                        key={file.path}
                        onClick={() => loadProjectFileContent(projectName, file.path)}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between border ${
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
                  })
                )}
              </div>
            </div>

            {/* File Viewer */}
            <div className="flex-1 my-3 mr-3 ml-1.5 rounded-2xl glass-content-card overflow-auto p-6 select-text">
              {selectedProjectFilePath ? (
                <div className="max-w-3xl mx-auto text-left font-sans">
                  <div className="flex items-center justify-between gap-3 mb-3 border-b border-white/[0.03] pb-2">
                    <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider font-mono">
                      /{projectName}/{selectedProjectFilePath}
                    </div>
                    {/* Slides Toggle */}
                    {selectedProjectFilePath.endsWith('.slide.md') && (
                      <div className="flex items-center gap-2">
                        <div className="flex border border-white/[0.08] rounded-lg p-0.5 bg-black/30">
                          <button
                            onClick={() => setIsSlideshowMode(true)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${isSlideshowMode ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            <PresentationIcon className="w-2.5 h-2.5" /> Slides
                          </button>
                          <button
                            onClick={() => setIsSlideshowMode(false)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${!isSlideshowMode ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            <ListIcon className="w-2.5 h-2.5" /> Raw
                          </button>
                        </div>
                        <button
                          onClick={handleExportPPTX}
                          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                        >
                          <PresentationIcon className="w-3 h-3 text-amber-400" /> Export PPTX
                        </button>
                      </div>
                    )}
                    {/* PDF Export for standard documents */}
                    {!selectedProjectFilePath.endsWith('.slide.md') && selectedProjectFilePath.endsWith('.md') && (
                      <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold transition-colors"
                      >
                        <FileTextIcon className="w-3.5 h-3.5" />
                        <span>Export PDF</span>
                      </button>
                    )}
                  </div>

                  {isSlideshowMode && slides.length > 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 py-4">
                      {renderSlide(slides[currentSlideIndex])}
                      <div className="flex items-center gap-4 bg-[#0d0e12] border border-white/[0.04] p-2 rounded-xl">
                        <button
                          onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentSlideIndex === 0}
                          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white disabled:opacity-20 transition-all"
                        >
                          <ChevronLeftIcon className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {currentSlideIndex + 1} / {slides.length}
                        </span>
                        <button
                          onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                          disabled={currentSlideIndex === slides.length - 1}
                          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white disabled:opacity-20 transition-all"
                        >
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : selectedProjectFilePath.endsWith('.csv') && csvGrid ? (
                    <div className="overflow-x-auto border border-white/[0.05] rounded-xl bg-zinc-950/20">
                      <table className="min-w-full divide-y divide-white/[0.05]">
                        <thead className="bg-white/[0.02]">
                          <tr>
                            {csvGrid[0]?.map((colHeader, colIdx) => (
                              <th key={colIdx} className="px-3.5 py-2.5 text-left text-xs font-bold text-content-highlight font-sans border-r border-white/[0.05]">
                                {colHeader}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {csvGrid.slice(1).map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-white/[0.01]">
                              {row.map((cellValue, colIdx) => (
                                <td key={colIdx} className="px-3.5 py-2.5 text-xs text-zinc-300 border-r border-white/[0.05]">
                                  {cellValue}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : selectedProjectFilePath.endsWith('.md') ? (
                    <div className="bg-[#0f1116] border border-white/[0.04] rounded-3xl p-6 shadow-xl">
                      {renderMarkdown(selectedProjectFileContent)}
                    </div>
                  ) : (
                    <pre className="p-5 bg-[#0d0e13] border border-white/[0.03] rounded-2xl font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
                      {selectedProjectFileContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-content-muted text-xs">
                  Select a project document to display.
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {exportingState && (
        <div className="absolute inset-0 z-50 bg-[#07080b]/90 backdrop-blur-md flex flex-col items-center justify-center select-none animate-fade-in text-left">
          <div className="p-8 rounded-3xl border border-white/[0.08] bg-[#0c0d12]/80 backdrop-blur flex flex-col items-center justify-center max-w-sm text-center shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-blue-500/10 filter blur-xl animate-pulse" />
            <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-purple-500/10 filter blur-xl animate-pulse" />
            
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-white/5" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-purple-500 animate-spin" />
            </div>
            
            <h3 className="text-xs font-bold text-white uppercase tracking-widest font-mono mb-2">Beo Publisher</h3>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed animate-pulse">
              {exportingMessages[exportingState]}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
