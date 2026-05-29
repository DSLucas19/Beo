import os
import tempfile
import asyncio
from pathlib import Path
from sqlalchemy.orm import Session
from app.agents.base import AgentWrapper

PDF_DOCUMENT_INSTRUCTIONS = """
You are a master typographer and publication designer. Convert the provided Markdown document into a single complete, highly polished A4-compatible HTML document.
Return ONLY the complete HTML starting with <!DOCTYPE html> — do NOT wrap it in markdown code blocks or fences (no ```html), do not write any explanations or comments outside the HTML.

## Styling Rules for A4 PDF Print:
- **Margins**: Configure page margins nicely using CSS `@page` so headers/footers print perfectly:
  ```css
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
  }
  ```
- **Typography**: Load beautiful typography from Google Fonts:
  `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`
  - Body: Use `Merriweather` or `Inter` for extremely readable text (`font-size: 11pt; line-height: 1.6; color: #2d3748;`).
  - Headings: Use `Inter` (`font-weight: 700; color: #1a202c;`). Add clear margin/padding around headings.
- **Header & Footer**:
  Add a subtle, professional header (document title) and footer (with page numbers or copyright) on every page.
- **Visual Vocabulary**:
  - Code Snippets: Clean background with light gray border, monospace font (`JetBrains Mono`), padding, and inline styling.
  - Tables: 100% width, thin borders, centered headings, clean padding, and alternate row background colors (`#f7fafc`).
  - Blockquotes: Sleek left accent bar (`3px solid #3182ce`), italicized text, and light blue tint background.
  - Badges/Monospace caps kickers for section dividers.
  - Visual hierarchy: Always wrap all text blocks in `<p>`, headings, lists, or blockquotes. No naked text nodes.
- **Tailwind CSS**: Use Tailwind to structure the layout if helpful:
  `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`
"""

def convert_doc_to_pdf(workspace_id: str, file_path: str, db: Session, project_name: str = None) -> Path:
    """Reads a workspace .md file, calls LLM to generate highly polished A4 printable HTML, and prints it to PDF via Playwright."""
    from app.utils.file_manager import read_workspace_file, get_workspace_files_path, read_project_file, get_project_root
    
    # 1. Read markdown file
    if project_name:
        content = read_project_file(workspace_id, project_name, file_path)
    else:
        content = read_workspace_file(workspace_id, file_path)
    
    # 2. Call LLM to format markdown to beautiful A4 HTML
    wrapper = AgentWrapper(workspace_id, db)
    
    prompt = f"""
Convert the following Markdown file into a premium, beautifully styled HTML document optimized for A4 PDF printing.
Keep the exact text content, but structure it with gorgeous tables, lists, code blocks, quote segments, and professional headings.

Document Content:
{content}
"""
    
    system_msg = {
        "role": "system",
        "content": PDF_DOCUMENT_INSTRUCTIONS
    }
    user_msg = {
        "role": "user",
        "content": prompt
    }
    
    # Use LiteLLM call through AgentWrapper
    html_content = wrapper.call([system_msg, user_msg], role="secretary")
    
    # Clean up potential markdown fences wrapped by LLM
    html_content = html_content.strip()
    if html_content.startswith("```html"):
        html_content = html_content[7:]
    if html_content.endswith("```"):
        html_content = html_content[:-3]
    html_content = html_content.strip()
    
    # 3. Save to a temporary HTML file
    temp_dir = tempfile.mkdtemp(prefix="beo_pdf_")
    temp_html_path = Path(temp_dir) / "document.html"
    temp_html_path.write_text(html_content, encoding="utf-8")
    
    # Determine output PDF path
    pdf_name = Path(file_path).stem + ".pdf"
    if project_name:
        output_pdf_path = get_project_root(workspace_id, project_name) / pdf_name
    else:
        output_pdf_path = get_workspace_files_path(workspace_id) / pdf_name
    
    # 4. Use Playwright in python to print to PDF
    # We run inside the event loop using asyncio.run() or a new thread, or inline if running in an async router.
    # Since main.py runs FastAPI (which is async), we can launch Playwright!
    async def _print_pdf():
        from playwright.async_api import async_playwright
        
        # Configure local playwright browsers path to avoid permission or path issues
        # (uses the same local directory structure as openswarm if set)
        from app.config import BEO_ROOT
        local_browsers = BEO_ROOT / ".playwright-browsers"
        if local_browsers.exists():
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(local_browsers.absolute())
            
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(temp_html_path.absolute().as_uri(), wait_until="load")
            await page.wait_for_timeout(1000)  # let typography and custom fonts settle
            
            await page.pdf(
                path=str(output_pdf_path.absolute()),
                format="A4",
                print_background=True,
                margin={
                    "top": "0mm",
                    "bottom": "0mm",
                    "left": "0mm",
                    "right": "0mm"
                }
            )
            await browser.close()
            
    # Run Playwright print
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_print_pdf())
    finally:
        loop.close()
        
    # Clean up temporary HTML file and folder
    try:
        temp_html_path.unlink()
    except Exception:
        pass
    try:
        Path(temp_dir).rmdir()
    except Exception:
        pass
        
    return output_pdf_path
