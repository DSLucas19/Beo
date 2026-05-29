import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Table,
  FileText,
  Presentation,
  Sun,
  Moon,
  HelpCircle,
  Columns,
  BookOpen,
  List,
  Plus,
  Trash2,
  ArrowUpRight,
  Maximize,
  Grid,
  Settings,
  RefreshCw,
  Sparkles
} from 'lucide-react'

export default function DocPreviewer({
  filePath,
  content,
  onSave,
  onClose,
  workspaceId = 'beo_corp'
}) {
  const [activeTab, setActiveTab] = useState('view') // 'view' | 'edit'
  const [editedText, setEditedText] = useState('')
  
  // Format state
  const isPDF = filePath?.toLowerCase().endsWith('.pdf')
  const isCSV = filePath?.toLowerCase().endsWith('.csv')
  const isExcel = filePath?.toLowerCase().endsWith('.xlsx') || filePath?.toLowerCase().endsWith('.xls')
  const isSlide = filePath?.toLowerCase().includes('.slide.md') || filePath?.toLowerCase().endsWith('.ppt') || filePath?.toLowerCase().endsWith('.pptx')
  const isMD = filePath?.toLowerCase().endsWith('.md') && !isSlide
  const isHTML = filePath?.toLowerCase().endsWith('.html') || filePath?.toLowerCase().endsWith('.htm')

  // Helper to resolve static file URL from the backend
  const getFileUrl = () => {
    if (!filePath) return ''
    const cleanPath = filePath.replace(/^\//, '')
    if (cleanPath.startsWith('attachments/')) {
      return `http://localhost:8000/${cleanPath}`
    }
    if (cleanPath.startsWith('projects/')) {
      return `http://localhost:8000/attachments/${workspaceId}/${cleanPath}`
    }
    if (cleanPath.startsWith('workspace/')) {
      return `http://localhost:8000/attachments/${workspaceId}/${cleanPath}`
    }
    return `http://localhost:8000/attachments/${workspaceId}/workspace/${cleanPath}`
  }

  // 1. PDF State & Configs
  const [pdfZoom, setPdfZoom] = useState(100)
  const [pdfTheme, setPdfTheme] = useState('light') // 'light' | 'dark'
  const [pdfLayout, setPdfLayout] = useState('single') // 'single' | 'double'
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1)
  const [isIframePdf, setIsIframePdf] = useState(isPDF)

  // 2. Sheet State & Configs
  const [csvGrid, setCsvGrid] = useState([['']])
  const [activeCell, setActiveCell] = useState({ r: 0, c: 0 })
  const [formulaValue, setFormulaValue] = useState('')

  // 3. Slides State & Configs
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [slideTheme, setSlideTheme] = useState('tokyo-night') // 'tokyo-night' | 'platinum' | 'forest-mint' | 'sunset-amber'
  const [isAutoplay, setIsAutoplay] = useState(false)
  const [autoplayTimer, setAutoplayTimer] = useState(null)
  
  // 4. Document Outline State
  const [activeSection, setActiveSection] = useState('')

  // Export State
  const [exportingState, setExportingState] = useState(null)

  const exportingMessages = {
    analyzing: "Analyzing document outline & structure...",
    generating: "Generating responsive Tailwind CSS grid layouts...",
    rendering: "Launching Playwright to render slide vector frames...",
    assembling: "Converting layers to native PowerPoint PPTX shapes...",
    printing: "Printing high-fidelity document PDF with A4 grid pages...",
  }

  const handleExportPPTX = async () => {
    try {
      setExportingState('analyzing')
      const t1 = setTimeout(() => setExportingState('generating'), 1500)
      const t2 = setTimeout(() => setExportingState('rendering'), 3000)
      const t3 = setTimeout(() => setExportingState('assembling'), 4500)
      
      const response = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/slides/export-pptx?file_path=${encodeURIComponent(filePath)}`, {
        method: 'POST'
      })
      
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.replace('.slide.md', '.pptx').split('/').pop()
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
    try {
      setExportingState('analyzing')
      const t1 = setTimeout(() => setExportingState('generating'), 1000)
      const t2 = setTimeout(() => setExportingState('printing'), 2500)
      
      const response = await fetch(`http://localhost:8000/api/workspaces/${workspaceId}/docs/export-pdf?file_path=${encodeURIComponent(filePath)}`, {
        method: 'POST'
      })
      
      clearTimeout(t1)
      clearTimeout(t2)
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.replace('.md', '.pdf').split('/').pop()
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

  // Sync content
  useEffect(() => {
    if (content !== null && content !== undefined) {
      setEditedText(content)
      if (isCSV) {
        setCsvGrid(parseCSV(content))
      }
    }
  }, [content, filePath])

  // Autoplay handler for Slides
  useEffect(() => {
    if (isAutoplay && isSlide) {
      const timer = setInterval(() => {
        setCurrentSlideIndex(prev => {
          if (prev >= slides.length - 1) return 0
          return prev + 1
        })
      }, 4000)
      setAutoplayTimer(timer)
      return () => clearInterval(timer)
    } else {
      if (autoplayTimer) {
        clearInterval(autoplayTimer)
        setAutoplayTimer(null)
      }
    }
  }, [isAutoplay, isSlide])

  // --- CSV parsing & serializing helper ---
  const parseCSV = (text) => {
    if (!text) return [['']]
    return text.split('\n')
      .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
      .filter(row => row.length > 0 && (row.length > 1 || row[0] !== ""))
  }

  const serializeCSV = (grid) => {
    return grid.map(row =>
      row.map(cell => {
        if (cell.includes(',')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    ).join('\n')
  }

  const handleCellChange = (r, c, val) => {
    const updated = csvGrid.map((row, rowIdx) =>
      row.map((cell, colIdx) => (rowIdx === r && colIdx === c ? val : cell))
    )
    setCsvGrid(updated)
    if (activeCell.r === r && activeCell.c === c) {
      setFormulaValue(val)
    }
  }

  const handleAddRow = () => {
    const colCount = csvGrid[0]?.length || 1
    setCsvGrid([...csvGrid, Array(colCount).fill('')])
  }

  const handleRemoveRow = (idx) => {
    if (csvGrid.length <= 1) return
    setCsvGrid(csvGrid.filter((_, i) => i !== idx))
    setActiveCell({ r: 0, c: 0 })
  }

  const handleAddCol = () => {
    setCsvGrid(csvGrid.map(row => [...row, '']))
  }

  const handleRemoveCol = () => {
    if (csvGrid[0]?.length <= 1) return
    setCsvGrid(csvGrid.map(row => row.slice(0, -1)))
    setActiveCell({ r: 0, c: 0 })
  }

  // --- Slides Parsing ---
  const slides = useMemo(() => {
    if (!editedText || !isSlide) return []
    return editedText.split('---').map(s => s.trim()).filter(Boolean)
  }, [editedText, isSlide])

  // --- PDF Simulated Pages ---
  const pdfPages = useMemo(() => {
    // If it's a text-based simulated PDF, divide contents into A4 pages
    if (!editedText) return []
    const lines = editedText.split('\n')
    const pages = []
    let currentPage = []
    lines.forEach((line, idx) => {
      currentPage.push(line)
      // Every 30 lines is a page
      if (currentPage.length >= 30 || idx === lines.length - 1) {
        pages.push(currentPage.join('\n'))
        currentPage = []
      }
    })
    return pages
  }, [editedText])

  // --- Outline Navigation ---
  const docOutline = useMemo(() => {
    if (!editedText || !isMD) return []
    const lines = editedText.split('\n')
    const headings = []
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/)
      if (match) {
        headings.push({
          level: match[1].length,
          title: match[2].trim(),
          id: `heading-${index}`
        })
      }
    })
    return headings
  }, [editedText, isMD])

  const handleSaveContent = () => {
    let finalContent = editedText
    if (isCSV) {
      finalContent = serializeCSV(csvGrid)
    }
    if (onSave) {
      onSave(finalContent)
    }
  }

  // --- RENDERERS ---

  // High-fidelity React-based Markdown Parser supporting styled tables, lists, headers and text styling
  const renderInlineFormatting = (text) => {
    if (!text) return ''
    const boldParts = text.split('**')
    return boldParts.map((part, index) => {
      const isBold = index % 2 === 1
      const codeParts = part.split('`')
      const renderedCodeParts = codeParts.map((subPart, subIndex) => {
        const isCode = subIndex % 2 === 1
        if (isCode) {
          return <code key={subIndex} className="bg-white/10 px-1 py-0.5 rounded font-mono text-cyan-300 text-xs">{subPart}</code>
        }
        return subPart
      })
      if (isBold) {
        return <strong key={index} className="text-white font-bold">{renderedCodeParts}</strong>
      }
      return <React.Fragment key={index}>{renderedCodeParts}</React.Fragment>
    })
  }

  const parseMarkdownToReact = (text) => {
    if (!text) return null
    const lines = text.split('\n')
    const elements = []
    let i = 0
    
    while (i < lines.length) {
      let line = lines[i]
      let trimmed = line.trim()
      
      // Code Block
      if (trimmed.startsWith('```')) {
        let codeLines = []
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        elements.push(
          <pre key={i} className="p-4 bg-zinc-900 border border-white/[0.05] rounded-xl font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed my-3 shadow-inner">
            <code>{codeLines.join('\n')}</code>
          </pre>
        )
        i++
        continue
      }
      
      // Divider / Horizontal Rule (---, ***, ___)
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        elements.push(
          <hr key={i} className="my-6 border-t border-white/[0.08]" />
        )
        i++
        continue
      }
      
      // Table Block
      if (trimmed.startsWith('|')) {
        let tableLines = []
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim())
          i++
        }
        const rows = tableLines.map(row => {
          let cells = row.split('|').map(cell => cell.trim())
          if (cells.length > 0 && cells[0] === '') {
            cells.shift()
          }
          if (cells.length > 0 && cells[cells.length - 1] === '') {
            cells.pop()
          }
          return cells
        }).filter(row => row.length > 0)
        
        if (rows.length > 0) {
          const hasDivider = rows[1] && rows[1].every(cell => cell.length > 0 && /^[:-]+$/.test(cell))
          const headers = rows[0]
          const dataRows = hasDivider ? rows.slice(2) : rows.slice(1)
          
          elements.push(
            <div key={i} className="my-4 overflow-x-auto border border-white/[0.05] rounded-xl bg-zinc-950/20 shadow-inner select-text">
              <table className="min-w-full divide-y divide-white/[0.05] text-left">
                <thead className="bg-white/[0.02]">
                  <tr className="divide-x divide-white/[0.04]">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-4 py-2.5 text-xs font-bold text-white font-sans uppercase tracking-wider bg-white/[0.01]">
                        {renderInlineFormatting(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.01] divide-x divide-white/[0.04]">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-xs md:text-sm text-zinc-300">
                          {renderInlineFormatting(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        continue
      }
      
      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const title = headingMatch[2].trim()
        const inlineTitle = renderInlineFormatting(title)
        
        if (level === 1) {
          elements.push(<h1 key={i} id={`heading-${i}`} className="text-xl font-extrabold text-white mt-5 mb-3 font-display">{inlineTitle}</h1>)
        } else if (level === 2) {
          elements.push(<h2 key={i} id={`heading-${i}`} className="text-lg font-bold text-white mt-4 mb-2.5 border-b border-white/5 pb-1 font-display">{inlineTitle}</h2>)
        } else {
          elements.push(<h3 key={i} id={`heading-${i}`} className="text-sm font-semibold text-purple-400 uppercase tracking-wider font-mono mt-3 mb-2">{inlineTitle}</h3>)
        }
        i++
        continue
      }
      
      // Bullet List
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let listItems = []
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().substring(2))
          i++
        }
        elements.push(
          <ul key={i} className="list-disc pl-5 my-2 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ul>
        )
        continue
      }
      
      // Paragraph / Plain lines
      if (trimmed) {
        elements.push(<p key={i} className="text-xs md:text-sm text-zinc-300 leading-relaxed my-2">{renderInlineFormatting(line)}</p>)
      }
      i++
    }
    return <div className="space-y-1">{elements}</div>
  }

  // Slide Presenter Themes
  const getSlideThemeStyles = () => {
    switch (slideTheme) {
      case 'platinum':
        return 'bg-gradient-to-br from-[#f4f4f5] to-[#e4e4e7] text-zinc-900 border-zinc-300 shadow-xl'
      case 'forest-mint':
        return 'bg-gradient-to-br from-[#0c1310] to-[#12221b] text-emerald-100 border-emerald-900/30 shadow-[0_10px_30px_rgba(16,185,129,0.05)]'
      case 'sunset-amber':
        return 'bg-gradient-to-br from-[#1c120c] to-[#28180e] text-amber-100 border-amber-900/30 shadow-[0_10px_30px_rgba(245,158,11,0.05)]'
      case 'tokyo-night':
      default:
        return 'bg-gradient-to-br from-[#0f1015] to-[#131520] text-zinc-100 border-white/5 shadow-[0_12px_40px_rgba(0,0,0,0.8)]'
    }
  }

  const renderSlideFrame = (slideText) => {
    const isDark = slideTheme !== 'platinum'
    const textTheme = isDark ? 'text-zinc-400' : 'text-zinc-600'
    const boldTheme = isDark ? 'text-white' : 'text-zinc-950'
    const codeTheme = isDark ? 'bg-white/10 text-cyan-300' : 'bg-black/10 text-cyan-700'

    const html = slideText
      .replace(/^### (.*$)/gim, `<h3 class="text-xs font-semibold uppercase tracking-wider font-mono mt-4 mb-2 ${isDark ? 'text-purple-400' : 'text-purple-700'}">$1</h3>`)
      .replace(/^## (.*$)/gim, `<h2 class="text-lg font-bold border-b ${isDark ? 'border-white/5' : 'border-black/5'} pb-2.5 mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}">$1</h2>`)
      .replace(/^# (.*$)/gim, `<h1 class="text-2xl font-black mb-6 tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}">$1</h1>`)
      .replace(/^\s*\-\s*(.*$)/gim, `<li class="ml-6 list-disc mb-2.5 text-xs text-left ${textTheme}">$1</li>`)
      .replace(/\*\*(.*?)\*\*/g, `<strong class="font-bold ${boldTheme}">$1</strong>`)
      .replace(/`(.*?)`/g, `<code class="px-1.5 py-0.5 rounded font-mono text-[11px] ${codeTheme}">$1</code>`)
      .replace(/\n/g, '<br />')

    return (
      <div 
        className={`w-full max-w-3xl border rounded-2xl p-10 min-h-[300px] flex flex-col justify-center transition-all duration-500 relative ${getSlideThemeStyles()}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Double page layout calculation for PDF
  const doublePages = useMemo(() => {
    const pairs = []
    for (let i = 0; i < pdfPages.length; i += 2) {
      pairs.push([pdfPages[i], pdfPages[i + 1] || null])
    }
    return pairs
  }, [pdfPages])

  // --- STATS ---
  const stats = useMemo(() => {
    const words = editedText ? editedText.split(/\s+/).filter(Boolean).length : 0
    const chars = editedText ? editedText.length : 0
    const readTime = Math.max(1, Math.ceil(words / 200))
    return { words, chars, readTime }
  }, [editedText])

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950/98 backdrop-blur-md border border-white/[0.08] rounded-2xl overflow-hidden p-0 text-left pane-fade-in select-text">
      
      {/* 1. TOP CONTROL BAR */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05] bg-zinc-950 select-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            {isPDF && <FileText className="w-4 h-4 text-rose-400" />}
            {isCSV && <Table className="w-4 h-4 text-emerald-400" />}
            {isSlide && <Presentation className="w-4 h-4 text-purple-400" />}
            {isMD && <FileText className="w-4 h-4 text-sky-400" />}
            {isHTML && <FileText className="w-4 h-4 text-orange-400" />}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-white truncate block font-mono">{filePath}</span>
            <span className="text-[9px] text-zinc-500 font-mono capitalize">
              {isPDF && 'Portable PDF Document'}
              {isCSV && 'Spreadsheet Sheet Grid'}
              {isSlide && 'Presentation Deck / Slideshow'}
              {isMD && 'Markdown Document'}
              {isHTML && 'HTML Live Webpage Document'}
            </span>
          </div>
        </div>

        {/* View / Edit Tab controls for CSV, Markdown & HTML */}
        {(isCSV || isMD || isSlide || isHTML) && (
          <div className="flex border border-white/[0.08] rounded-lg p-0.5 bg-black/40">
            <button
              onClick={() => setActiveTab('view')}
              className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${
                activeTab === 'view' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${
                activeTab === 'edit' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Raw Editor
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isSlide && activeTab === 'view' && (
            <button
              onClick={handleExportPPTX}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold transition-all shadow-sm"
            >
              <Presentation className="w-3 h-3 text-amber-400" /> Export PPTX
            </button>
          )}
          {isMD && activeTab === 'view' && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF
            </button>
          )}
          {activeTab === 'edit' || isCSV ? (
            <button
              onClick={handleSaveContent}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold rounded-lg transition-transform hover:scale-[1.02] shadow-sm select-none"
            >
              Save Changes
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="text-[10px] font-bold text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>

      {/* 2. MAIN VIEWER CONTENT CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative items-stretch bg-zinc-950/20">
        
        {/* ==================== A. VIEW PREVIEW MODE ==================== */}
        {activeTab === 'view' && (
          <div className="flex-1 flex overflow-hidden h-full">
            
            {/* -------------------- I. PDF VIEW LAYOUT -------------------- */}
            {isPDF && (
              <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
                {/* PDF Toolbar */}
                <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.04] bg-zinc-950/40 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPdfZoom(prev => Math.max(50, prev - 10))}
                      className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono text-zinc-500 w-10 text-center">{pdfZoom}%</span>
                    <button
                      onClick={() => setPdfZoom(prev => Math.min(200, prev + 10))}
                      className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

                    {/* Single/Double layout selector */}
                    <div className="flex border border-white/[0.06] rounded bg-black/20 p-0.5">
                      <button
                        onClick={() => setPdfLayout('single')}
                        className={`p-1 rounded text-[10px] transition-colors ${pdfLayout === 'single' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Single Page"
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPdfLayout('double')}
                        className={`p-1 rounded text-[10px] transition-colors ${pdfLayout === 'double' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Two Pages"
                      >
                        <Columns className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Theme Toggles */}
                    <div className="flex border border-white/[0.06] rounded bg-black/20 p-0.5">
                      <button
                        onClick={() => setPdfTheme('light')}
                        className={`p-1 rounded text-[10px] transition-colors ${pdfTheme === 'light' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="White Paper"
                      >
                        <Sun className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPdfTheme('dark')}
                        className={`p-1 rounded text-[10px] transition-colors ${pdfTheme === 'dark' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Dark Paper"
                      >
                        <Moon className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="w-[1px] h-3.5 bg-white/10" />

                    {/* Page Numbers */}
                    {!isIframePdf && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {pdfLayout === 'single' 
                          ? `Page ${pdfCurrentPage} of ${pdfPages.length}`
                          : `Spread ${pdfCurrentPage} of ${doublePages.length}`}
                      </span>
                    )}

                    {/* PDF Toggle between iframe and custom simulated layout */}
                    <button
                      onClick={() => setIsIframePdf(!isIframePdf)}
                      className={`text-[9px] font-mono border px-2 py-0.5 rounded transition-all ${
                        isIframePdf 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                      title="Native PDF Viewer Mode"
                    >
                      {isIframePdf ? 'Browser native viewer' : 'Simulated viewer'}
                    </button>
                  </div>
                </div>

                {/* PDF Content Area */}
                <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-zinc-950/40">
                  {isIframePdf ? (
                    // Load actual file served via backend attachments mount
                    <iframe
                      src={getFileUrl()}
                      className="w-full h-full border-none rounded-xl bg-zinc-900 shadow-2xl"
                      title="Native PDF Viewer"
                    />
                  ) : (
                    // Render simulated paper container
                    <div 
                      className="transition-transform duration-300 origin-center flex gap-6"
                      style={{ transform: `scale(${pdfZoom / 100})` }}
                    >
                      {pdfLayout === 'single' ? (
                        <div 
                          className={`w-[595px] h-[842px] border shadow-2xl p-14 relative flex flex-col justify-between text-xs leading-relaxed transition-colors ${
                            pdfTheme === 'light' 
                              ? 'bg-white text-zinc-800 border-zinc-300' 
                              : 'bg-zinc-900 text-zinc-200 border-zinc-800'
                          }`}
                        >
                          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2 text-[9px] uppercase tracking-wider font-mono text-zinc-400 flex justify-between select-none">
                            <span>Beo OS Publisher</span>
                            <span>PDF Draft</span>
                          </div>
                          <pre className="flex-1 mt-6 whitespace-pre-wrap font-sans text-xs leading-relaxed overflow-hidden">
                            {pdfPages[pdfCurrentPage - 1]}
                          </pre>
                          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 text-[9px] font-mono text-zinc-400 flex justify-between select-none">
                            <span>{filePath}</span>
                            <span>Page {pdfCurrentPage}</span>
                          </div>
                        </div>
                      ) : (
                        // Double sheet layout
                        <div className="flex gap-4">
                          {[0, 1].map(offset => {
                            const pIndex = (pdfCurrentPage - 1) * 2 + offset
                            if (pIndex >= pdfPages.length) return null
                            return (
                              <div 
                                key={offset}
                                className={`w-[450px] h-[636px] border shadow-xl p-10 relative flex flex-col justify-between text-[11px] leading-relaxed transition-colors ${
                                  pdfTheme === 'light' 
                                    ? 'bg-white text-zinc-800 border-zinc-300' 
                                    : 'bg-zinc-900 text-zinc-200 border-zinc-800'
                                }`}
                              >
                                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-1.5 text-[8px] uppercase tracking-wider font-mono text-zinc-400 flex justify-between select-none">
                                  <span>PDF Double View</span>
                                  <span>Page {pIndex + 1}</span>
                                </div>
                                <pre className="flex-1 mt-4 whitespace-pre-wrap font-sans text-[11px] leading-relaxed overflow-hidden">
                                  {pdfPages[pIndex]}
                                </pre>
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1.5 text-[8px] font-mono text-zinc-400 flex justify-between select-none">
                                  <span>{filePath}</span>
                                  <span>P. {pIndex + 1}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PDF Page Navigation */}
                {!isIframePdf && (
                  <div className="px-5 py-3.5 border-t border-white/[0.04] bg-zinc-950/20 flex justify-center items-center gap-6 select-none">
                    <button
                      onClick={() => setPdfCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={pdfCurrentPage === 1}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {pdfLayout === 'single' 
                        ? `${pdfCurrentPage} / ${pdfPages.length}`
                        : `${pdfCurrentPage} / ${doublePages.length}`}
                    </span>
                    <button
                      onClick={() => setPdfCurrentPage(prev => Math.min(pdfLayout === 'single' ? pdfPages.length : doublePages.length, prev + 1))}
                      disabled={pdfCurrentPage === (pdfLayout === 'single' ? pdfPages.length : doublePages.length)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* -------------------- II. SHEET VIEW LAYOUT -------------------- */}
            {isCSV && (
              <div className="flex-1 flex flex-col h-full overflow-hidden text-left select-text">
                {/* Spreadsheet Toolbar */}
                <div className="px-5 py-2.5 border-b border-white/[0.04] bg-zinc-950/40 select-none flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg text-[10px] font-bold font-mono transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Add Row</span>
                    </button>
                    <button
                      onClick={handleAddCol}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg text-[10px] font-bold font-mono transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Add Column</span>
                    </button>
                    <button
                      onClick={handleRemoveCol}
                      disabled={csvGrid[0]?.length <= 1}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg text-[10px] font-bold font-mono transition-all disabled:opacity-30"
                    >
                      <span>Remove Col</span>
                    </button>
                  </div>

                  {/* Cell stats */}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                    <span>Rows: {csvGrid.length}</span>
                    <span>Cols: {csvGrid[0]?.length || 0}</span>
                  </div>
                </div>

                {/* Formula Bar */}
                <div className="px-5 py-2 bg-zinc-950 border-b border-white/[0.04] flex items-center gap-2">
                  <div className="bg-white/[0.03] border border-white/[0.06] px-2 py-1 rounded font-mono text-[10px] text-zinc-400 min-w-12 text-center">
                    {String.fromCharCode(65 + activeCell.c)}
                    {activeCell.r + 1}
                  </div>
                  <span className="font-mono text-xs text-zinc-500 italic">fx</span>
                  <input
                    type="text"
                    value={formulaValue}
                    onChange={(e) => {
                      setFormulaValue(e.target.value)
                      handleCellChange(activeCell.r, activeCell.c, e.target.value)
                    }}
                    placeholder="Enter cell content or equation"
                    className="flex-1 bg-zinc-900 border border-white/[0.05] rounded px-3 py-1 text-xs text-white placeholder:text-zinc-700 font-mono focus:outline-none focus:border-white/10"
                  />
                </div>

                {/* Spreadsheet Grid Scroll */}
                <div className="flex-1 overflow-auto p-6 bg-zinc-950/20">
                  <div className="border border-white/[0.05] rounded-xl bg-zinc-950/40 overflow-hidden shadow-inner w-fit min-w-full">
                    <table className="min-w-full divide-y divide-white/[0.04]">
                      <thead className="bg-white/[0.02]">
                        <tr className="divide-x divide-white/[0.04]">
                          <th className="w-10 px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-600">#</th>
                          {csvGrid[0]?.map((_, colIdx) => (
                            <th key={colIdx} className="px-3 py-2 text-left text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                              {String.fromCharCode(65 + colIdx)}
                            </th>
                          ))}
                          <th className="w-12 px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-600">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {csvGrid.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-white/[0.01] divide-x divide-white/[0.04]">
                            <td className="px-3 py-2 text-center text-[10px] font-mono font-bold text-zinc-600 bg-black/10 select-none">
                              {rowIdx + 1}
                            </td>
                            {row.map((cellValue, colIdx) => {
                              const isSelected = activeCell.r === rowIdx && activeCell.c === colIdx
                              return (
                                <td 
                                  key={colIdx} 
                                  className={`p-0 min-w-32 transition-all ${
                                    isSelected 
                                      ? 'ring-2 ring-white z-10 shadow-[0_0_10px_rgba(255,255,255,0.06)]' 
                                      : 'hover:bg-white/[0.02]'
                                  }`}
                                  onClick={() => {
                                    setActiveCell({ r: rowIdx, c: colIdx })
                                    setFormulaValue(cellValue)
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={cellValue}
                                    onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                                    className="w-full bg-transparent text-xs text-zinc-300 border-0 focus:outline-none px-3 py-2 rounded font-sans"
                                  />
                                </td>
                              )
                            })}
                            <td className="p-0 text-center bg-black/5 select-none">
                              <button
                                onClick={() => handleRemoveRow(rowIdx)}
                                disabled={csvGrid.length <= 1}
                                className="p-2 text-zinc-600 hover:text-rose-400 rounded transition-colors disabled:opacity-20"
                                title="Delete Row"
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
              </div>
            )}

            {/* -------------------- III. SLIDE SHOW VIEW LAYOUT -------------------- */}
            {isSlide && slides.length > 0 && (
              <div className="flex-1 flex h-full overflow-hidden select-text text-left">
                {/* Left side: Thumbnails Column */}
                <div className="w-[180px] border-r border-white/[0.05] bg-zinc-950/40 flex flex-col overflow-y-auto p-4 gap-3 shrink-0 select-none">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider pb-1.5 border-b border-white/[0.04]">Slides Deck ({slides.length})</div>
                  {slides.map((sText, idx) => {
                    const isSelected = idx === currentSlideIndex
                    // Extract title from slide
                    const titleMatch = sText.match(/##?\s+(.*)$/m)
                    const titleText = titleMatch ? titleMatch[1].trim() : `Slide ${idx + 1}`
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`w-full p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          isSelected
                            ? 'bg-white/[0.08] border-white/20 shadow'
                            : 'bg-zinc-900/40 border-white/[0.02] hover:border-white/10 hover:bg-zinc-900/60'
                        }`}
                      >
                        <span className="text-[9px] font-mono text-zinc-500">Slide {idx + 1}</span>
                        <span className="text-[11px] font-semibold text-white truncate block">{titleText}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Right side: Active Slide Stage */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Slideshow Toolbar */}
                  <div className="px-6 py-3 border-b border-white/[0.04] bg-zinc-950/20 select-none flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsAutoplay(!isAutoplay)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                          isAutoplay 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isAutoplay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-zinc-400" />}
                        <span>{isAutoplay ? 'Pause Presentation' : 'Play slideshow'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Theme selection dropdown */}
                      <span className="text-[10px] font-mono text-zinc-500">Theme:</span>
                      <div className="flex border border-white/[0.06] rounded bg-black/20 p-0.5">
                        {[
                          { id: 'tokyo-night', label: 'Indigo' },
                          { id: 'platinum', label: 'Silver' },
                          { id: 'forest-mint', label: 'Mint' },
                          { id: 'sunset-amber', label: 'Amber' }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSlideTheme(t.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                              slideTheme === t.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Slide Stage */}
                  <div className="flex-1 overflow-auto p-12 flex items-center justify-center bg-black/20">
                    <div className="w-full flex items-center justify-center animate-fade-in">
                      {renderSlideFrame(slides[currentSlideIndex])}
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="px-6 py-4 border-t border-white/[0.04] bg-zinc-950/20 flex justify-center items-center gap-6 select-none">
                    <button
                      onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentSlideIndex === 0}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {currentSlideIndex + 1} / {slides.length}
                    </span>
                    <button
                      onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                      disabled={currentSlideIndex === slides.length - 1}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------- IV. MARKDOWN VIEW LAYOUT -------------------- */}
            {isMD && (
              <div className="flex-1 flex h-full overflow-hidden text-left">
                {/* Left side: Section Navigator */}
                <div className="w-[180px] border-r border-white/[0.05] bg-zinc-950/40 flex flex-col overflow-y-auto p-4 gap-2 shrink-0 select-none">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider pb-1.5 border-b border-white/[0.04]">Outline</div>
                  {docOutline.length === 0 ? (
                    <span className="text-[10px] text-zinc-600 p-2 italic">No headings found</span>
                  ) : (
                    docOutline.map(h => (
                      <button
                        key={h.id}
                        onClick={() => {
                          const el = document.getElementById(h.id)
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          setActiveSection(h.id)
                        }}
                        className={`w-full text-left py-1.5 px-2 rounded text-[11px] truncate transition-all ${
                          activeSection === h.id 
                            ? 'text-white bg-white/[0.04] font-semibold' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        } ${h.level === 2 ? 'pl-4' : h.level === 3 ? 'pl-6' : ''}`}
                      >
                        {h.title}
                      </button>
                    ))
                  )}
                </div>

                {/* Right side: Markdown rendering pane */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/10 select-text">
                  <div className="flex-1 overflow-y-auto p-10">
                    <div className="max-w-5xl mx-auto text-sm text-zinc-300 leading-relaxed space-y-4">
                      {editedText ? (
                        parseMarkdownToReact(editedText)
                      ) : (
                        <p className="text-zinc-600 italic">No content inside tệp.</p>
                      )}
                    </div>
                  </div>

                  {/* Document Footer Stats */}
                  <div className="px-6 py-2.5 border-t border-white/[0.04] bg-zinc-950/40 flex items-center justify-between select-none font-mono text-[10px] text-zinc-500">
                    <span>Words: {stats.words}</span>
                    <span>Characters: {stats.chars}</span>
                    <span>Reading Time: {stats.readTime} min</span>
                  </div>
                </div>
              </div>
            )}
            {/* -------------------- V. HTML VIEW LAYOUT -------------------- */}
            {isHTML && (
              <div className="flex-1 flex flex-col h-full overflow-hidden text-left">
                {/* HTML toolbar */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04] bg-zinc-950/40 select-none font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">HTML Live Page Render Stage</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-zinc-600 uppercase font-semibold">
                    <span>Sandboxed Sandbox Preview</span>
                  </div>
                </div>
                {/* HTML content frame */}
                <div className="flex-1 p-6 bg-zinc-900/30 overflow-hidden">
                  <iframe
                    srcDoc={editedText}
                    className="w-full h-full border border-white/[0.08] rounded-xl bg-white shadow-xl"
                    title="HTML Preview"
                    sandbox="allow-scripts"
                  />
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== B. RAW CODE EDITOR MODE ==================== */}
        {activeTab === 'edit' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden text-left bg-zinc-950">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="flex-1 p-6 bg-transparent text-zinc-300 font-mono text-xs outline-none resize-none leading-relaxed"
              placeholder="Write raw content here..."
            />
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
