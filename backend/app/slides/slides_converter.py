import os
import re
import json
import tempfile
import subprocess
from pathlib import Path
from sqlalchemy.orm import Session
from app.agents.base import AgentWrapper

HTML_WRITER_INSTRUCTIONS = """
You are a master presentation designer. You generate a single highly polished, visually stunning slide HTML.
Return ONLY the complete HTML document starting with <!DOCTYPE html> — do NOT wrap it in markdown code blocks or fences (no ```html), do not write any explanations or comments outside the HTML.

## Design Vocabulary & Primitives:
- **Dimensions**: Root container must be exactly `width: 1280px; height: 720px; overflow: hidden; position: relative;`
- **Gradients & Depth**: Use sleek dark mode backgrounds (e.g. HSL tailored charcoal, deep slate, or rich dark blue). Free to use linear or radial CSS gradients.
- **Glowing Orbs**: Position absolute divs with `filter: blur(80px–120px)` and low opacity (`0.10–0.15`) behind content to add visual depth.
- **Accent Bars**: A thin 2-4px colored accent bar at the top or left of cards, columns, or sections.
- **Kickers**: Tiny caps tags (monospace or condensed font) above titles for crisp section markers.
- **Grid Layout**: Use grid or flexbox for robust, aligned structures. Cards should have relative positioning, premium dark glass background, subtle thin border, and rounded corners (`border-radius: 20px`).
- **Typography**: Google Fonts (Inter, Space Grotesk, Merriweather, Roboto Mono) loaded via CDN:
  `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600;800&family=Merriweather:wght@300;400;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />`
- **Tailwind CSS**: Style using Tailwind: `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`
- **Icons**: Font Awesome 6 icons loaded via CDN:
  `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" />`
  Use FA6 classes like `<i class="fa-solid fa-rocket"></i>` inside standard `<span>` tags with explicit typography styles.
- **Pills/Badges**: Never put pills with background colors inline inside paragraphs. Give them their own container or list item.
- **Text Wrapping**: Always wrap text inside `<p>`, `<h1>`-`<h6>`, `<ul>`, `<li>` or `<span>` tags. Never leave naked text nodes inside `<div>` elements.

## Derive Layout from Slide Content:
- If slide has a single major highlight or metric -> Hero layout (huge centered text/stat with details below).
- If slide has 2 opposing/contrasting parts -> Split vertical panel (50/50 division with dynamic details).
- If slide has 3-4 list items -> Sleek multi-column grid layout (3 or 4 cards side by side).
- If slide is chronological -> Timeline path layout or sequential numbered steps.
"""

def parse_slide_md(md_content: str) -> list[dict]:
    """Parses .slide.md content, splitting by '---' and extracting title and points."""
    raw_slides = md_content.split("---")
    parsed_slides = []
    
    for raw in raw_slides:
        raw = raw.strip()
        if not raw:
            continue
            
        lines = raw.split("\n")
        title = "Untitled Slide"
        bullets = []
        body_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                title = re.sub(r"^#+\s*", "", line)
            elif line.startswith("-") or line.startswith("*"):
                bullets.append(re.sub(r"^[-*]\s*", "", line))
            else:
                body_lines.append(line)
                
        parsed_slides.append({
            "title": title,
            "bullets": bullets,
            "body": " ".join(body_lines)
        })
        
    return parsed_slides

def convert_slides_to_pptx(workspace_id: str, file_path: str, db: Session, project_name: str = None) -> Path:
    """Reads a .slide.md file, generates HTML slides, and runs html2pptx_runner.js to create a PPTX."""
    from app.utils.file_manager import read_workspace_file, get_workspace_files_path, read_project_file, get_project_root
    
    # 1. Read slide markdown
    if project_name:
        content = read_project_file(workspace_id, project_name, file_path)
    else:
        content = read_workspace_file(workspace_id, file_path)
        
    parsed_slides = parse_slide_md(content)
    if not parsed_slides:
        raise ValueError("Tệp slide không chứa nội dung hợp lệ.")
        
    wrapper = AgentWrapper(workspace_id, db)
    html_files = []
    
    # 2. Create temporary directory to store slide assets
    temp_dir = tempfile.mkdtemp(prefix="beo_slides_")
    temp_dir_path = Path(temp_dir)
    
    try:
        # Write dummy _theme.css in the temp folder so the runner does not fail
        theme_path = temp_dir_path / "_theme.css"
        theme_path.write_text("/* Beo Theme */\n.text-content-highlight { color: #ffffff; }", encoding="utf-8")
        
        # 3. Call LLM for each slide to build beautiful HTML
        for idx, slide in enumerate(parsed_slides):
            prompt = f"""
Generate slide HTML for Slide #{idx+1}:
Title: {slide['title']}
Key Points / Bullets:
{chr(10).join(f'- {b}' for b in slide['bullets'])}
Additional Context:
{slide['body']}

Ensure the layout is highly dynamic, modern, using custom typography and glassmorphic panels. Follow HTML_WRITER_INSTRUCTIONS strictly.
"""
            
            system_msg = {
                "role": "system",
                "content": HTML_WRITER_INSTRUCTIONS
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
            
            # Write to HTML file
            slide_file_name = f"slide_{idx:02d}.html"
            slide_file_path = temp_dir_path / slide_file_name
            slide_file_path.write_text(html_content, encoding="utf-8")
            html_files.append(str(slide_file_path.absolute()))
            
        # 4. Determine output PPTX path
        pptx_name = Path(file_path).stem + ".pptx"
        if project_name:
            output_pptx_path = get_project_root(workspace_id, project_name) / pptx_name
        else:
            output_pptx_path = get_workspace_files_path(workspace_id) / pptx_name
        
        # 5. Spawn html2pptx_runner.js
        runner_js = Path(__file__).parent / "html2pptx_runner.js"
        
        cmd = [
            "node",
            str(runner_js),
            "--output", str(output_pptx_path),
            "--layout", "LAYOUT_16x9_1280",
            "--tmp-dir", temp_dir,
            "--",
        ] + html_files
        
        # Inject PLAYWRIGHT_BROWSERS_PATH so Playwright inside node can locate the chromium binary
        from app.config import BEO_ROOT
        sub_env = os.environ.copy()
        local_browsers = BEO_ROOT / ".playwright-browsers"
        if local_browsers.exists():
            sub_env["PLAYWRIGHT_BROWSERS_PATH"] = str(local_browsers.absolute())
            
        kwargs = {
            "capture_output": True,
            "text": True,
            "timeout": 300,
            "cwd": str(Path(__file__).parent.parent.parent),  # backend/ directory where node_modules reside
            "env": sub_env,
        }
        if os.name == "nt":
            kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
            
        result = subprocess.run(cmd, **kwargs)
        
        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(f"Lỗi chuyển đổi slide sang PPTX:\n{error_msg}")
            
        return output_pptx_path
        
    finally:
        # Clean up HTML slide files, but preserve output PPTX
        for file in temp_dir_path.glob("*.html"):
            try:
                file.unlink()
            except Exception:
                pass
        try:
            theme_path.unlink()
        except Exception:
            pass
        try:
            temp_dir_path.rmdir()
        except Exception:
            pass
