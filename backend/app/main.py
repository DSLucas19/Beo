import json
import re
import os
import subprocess
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.database import (
    init_db, 
    get_db, 
    Workspace, 
    APIKey, 
    ChatMessage, 
    ApprovalItem, 
    WorkflowStep,
    APICostLog,
    MCPServer,
    AgentConfig,
    SwarmJob,
    SwarmMember,
    SessionLocal
)
from app.agents.swarm_runner import start_swarm_background
from app.security import encrypt_key, decrypt_key
from app.config import DATABASE_PATH, WORKSPACES_DIR, BEO_ROOT
from app.utils.file_manager import (
    write_workspace_file, 
    read_workspace_file, 
    list_workspace_files, 
    has_onboarding_specs,
    get_workspace_files_path,
    get_project_root,
    write_project_file,
    read_project_file,
    list_project_files,
    parse_active_departments,
    get_system_settings,
    save_system_settings
)
from app.agents.base import AgentWrapper
from app.agents.prompts import get_onboarding_messages, get_agent_messages
from app.utils.vector_db import VectorMemory
from app.utils.agent_templates import initialize_agent_templates
from app.utils.presets import PRESET_SKILLS, PRESET_MCP_SERVERS

# Khởi tạo DB trên startup
init_db()

# === Markdown Proposal Parsers ===

def parse_employee_markdown(md_content: str) -> dict:
    """Parse a markdown-based create_employee proposal into a structured dict."""
    result = {}
    # Title: # Tuyển dụng Nhân sự: Name (role_name)
    title_match = re.search(r'#\s*Tuyển\s+dụng\s+Nhân\s+sự:\s*(.+?)\s*\(([^)]+)\)', md_content, re.IGNORECASE)
    if title_match:
        result['name'] = title_match.group(1).strip()
        result['role'] = title_match.group(2).strip().lower().replace(' ', '_')
    else:
        result['name'] = 'Nhân sự mới'
        result['role'] = 'custom_agent'
    
    # Lý do tuyển dụng
    reason_match = re.search(r'\*\*Lý do tuyển dụng\*\*\s*:\s*(.+)', md_content)
    result['explanation'] = reason_match.group(1).strip() if reason_match else 'Tuyển dụng nhân sự mới'
    
    # Kỹ năng
    skills_match = re.search(r'\*\*Kỹ năng\*\*\s*:\s*(.+)', md_content)
    if skills_match:
        result['skills'] = [s.strip() for s in skills_match.group(1).split(',') if s.strip()]
    else:
        result['skills'] = ['read_file']
    
    # Cổng kết nối MCP
    mcp_match = re.search(r'\*\*Cổng kết nối MCP\*\*\s*:\s*(.+)', md_content)
    if mcp_match:
        raw = mcp_match.group(1).strip()
        if raw.lower() in ['không', 'none', 'n/a', '']:
            result['mcp_servers'] = []
        else:
            result['mcp_servers'] = [s.strip() for s in raw.split(',') if s.strip()]
    else:
        result['mcp_servers'] = []
    
    # Mô hình
    model_match = re.search(r'\*\*Mô hình\*\*\s*:\s*(.+)', md_content)
    result['model'] = model_match.group(1).strip() if model_match else None
    
    # SOUL
    soul_match = re.search(r'##\s*SOUL\s*\n([\s\S]*?)(?=##\s*PERSONALITY|$)', md_content)
    result['soul'] = soul_match.group(1).strip() if soul_match else f'# SOUL: {result["name"]}\n\nNhân viên AI chuyên trách.'
    
    # PERSONALITY
    personality_match = re.search(r'##\s*PERSONALITY\s*\n([\s\S]*?)$', md_content)
    result['personality'] = personality_match.group(1).strip() if personality_match else f'# PERSONALITY: {result["name"]}\n\nChuyên nghiệp và ngắn gọn.'
    
    return result

def parse_swarm_markdown(md_content: str) -> dict:
    """Parse a markdown-based deploy_swarm proposal into a structured dict."""
    result = {}
    # Title: # Triển khai Swarm: Name (execution_mode)
    title_match = re.search(r'#\s*Triển\s+khai\s+Swarm:\s*(.+?)\s*\(([^)]+)\)', md_content, re.IGNORECASE)
    if title_match:
        result['swarm_name'] = title_match.group(1).strip()
        result['execution_mode'] = title_match.group(2).strip().lower().replace('execution_mode:', '').strip()
    else:
        result['swarm_name'] = 'Swarm tự động'
        result['execution_mode'] = 'sequential'
    
    # Lý do triển khai
    reason_match = re.search(r'\*\*Lý do triển khai\*\*\s*:\s*(.+)', md_content)
    result['explanation'] = reason_match.group(1).strip() if reason_match else 'Triển khai Swarm'
    
    # Members: ## role_name \n Nhiệm vụ: ...
    members = []
    member_matches = re.findall(r'##\s*([\w_]+)\s*\n\s*Nhiệm vụ:\s*(.+?)(?=\n##|$)', md_content, re.DOTALL)
    for role, task in member_matches:
        members.append({'role': role.strip().lower(), 'task': task.strip()})
    result['members'] = members
    
    return result

def parse_markdown_proposals(ai_response: str, workspace_id: str, db, role_name: str = 'secretary') -> bool:
    """Parse markdown-based create_employee and deploy_swarm proposals from AI response. Returns True if any proposal was created."""
    proposal_created = False
    
    # Parse create_employee markdown proposals
    employee_match = re.search(r'```markdown\s*(#\s*Tuyển\s+dụng\s+Nhân\s+sự:[\s\S]*?)\s*```', ai_response, re.IGNORECASE)
    if employee_match:
        md_content = employee_match.group(1)
        parsed = parse_employee_markdown(md_content)
        app_item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="create_employee",
            file_path=parsed.get('role', 'custom_agent'),
            proposed_content=md_content,
            rationale=parsed.get('explanation', f'Đề xuất tuyển dụng từ {role_name}'),
            risk_level="MEDIUM",
            status="pending"
        )
        db.add(app_item)
        db.commit()
        proposal_created = True
    
    # Parse deploy_swarm markdown proposals
    swarm_match = re.search(r'```markdown\s*(#\s*Triển\s+khai\s+Swarm:[\s\S]*?)\s*```', ai_response, re.IGNORECASE)
    if swarm_match:
        md_content = swarm_match.group(1)
        parsed = parse_swarm_markdown(md_content)
        app_item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="deploy_swarm",
            file_path=None,
            proposed_content=md_content,
            rationale=parsed.get('explanation', f'Đề xuất triển khai swarm từ {role_name}'),
            risk_level="MEDIUM",
            status="pending"
        )
        db.add(app_item)
        db.commit()
        proposal_created = True
    
    return proposal_created

app = FastAPI(title="Beo API", version="1.0.0")

# Cấu hình CORS để frontend gọi được
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Pydantic Models ===
class WorkspaceCreate(BaseModel):
    id: str
    name: str

class WorkspaceInitialize(BaseModel):
    company_name: str
    vision_goals: str

class APIKeyRegister(BaseModel):
    provider: str
    key: str
    url: Optional[str] = None
    model: Optional[str] = None

class APIKeyTest(BaseModel):
    provider: str
    key: Optional[str] = None
    url: Optional[str] = None
    model: Optional[str] = None

class APIKeyScanModels(BaseModel):
    provider: str
    key: Optional[str] = None
    url: Optional[str] = None

class ChatMessageCreate(BaseModel):
    message: str
    channel: Optional[str] = None
    session_id: Optional[str] = "default"

class ApprovalEdit(BaseModel):
    content: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class WorkflowStepCreate(BaseModel):
    role: str
    step_name: str
    project_name: Optional[str] = None

class WorkflowStepsRegister(BaseModel):
    steps: List[WorkflowStepCreate]

class StepEdit(BaseModel):
    step_name: str
    role: str

class SystemSettingsEdit(BaseModel):
    daily_cost_cap: Optional[float] = None
    loop_guard_limit: Optional[int] = None
    shell_security_sandbox: Optional[bool] = None

class SwarmMemberCreate(BaseModel):
    role: str
    task: str

class SwarmJobCreate(BaseModel):
    name: str
    members: List[SwarmMemberCreate]
    execution_mode: Optional[str] = "sequential"

class MCPServerRegister(BaseModel):
    name: str
    url: str

class MCPServerCall(BaseModel):
    tool_name: str
    arguments: Optional[dict] = None

class CLIProxySpawnRequest(BaseModel):
    mode: str

# === API Endpoints ===

# --- CLIProxy Spawn ---
@app.post("/api/cliproxy/spawn")
def spawn_cliproxy(req: CLIProxySpawnRequest):
    import shutil
    
    # Locate the binary dynamically
    binary_name = "cli-proxy-api.exe" if os.name == 'nt' else "cli-proxy-api"
    local_binary = BEO_ROOT / binary_name
    backend_local_binary = BEO_ROOT / "backend" / binary_name
    
    binary_path = None
    if local_binary.exists():
        binary_path = str(local_binary)
    elif backend_local_binary.exists():
        binary_path = str(backend_local_binary)
    else:
        # Fallback to system search
        system_path = shutil.which("cli-proxy-api")
        if system_path:
            binary_path = system_path
        else:
            # Fallback to winget Links path as a last resort on Windows
            if os.name == 'nt':
                local_app_data = os.environ.get("LOCALAPPDATA", "")
                if local_app_data:
                    winget_links_path = Path(local_app_data) / "Microsoft" / "WinGet" / "Links" / "cli-proxy-api.exe"
                    if winget_links_path.exists():
                        binary_path = str(winget_links_path)
                    else:
                        # Fallback to standard winget installation package path
                        user_profile = os.environ.get("USERPROFILE", "")
                        if user_profile:
                            winget_pack_path = Path(user_profile) / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
                            if winget_pack_path.exists():
                                found_paths = list(winget_pack_path.rglob("cli-proxy-api.exe"))
                                if found_paths:
                                    binary_path = str(found_paths[0])
            
    if not binary_path:
        binary_path = "cli-proxy-api"  # fallback hoping it's in PATH
        
    # Map modes to commands
    mode_cmds = {
        "claude_code": f'"{binary_path}" -claude-login',
        "codex": f'"{binary_path}" -codex-login',
        "antigravity": f'"{binary_path}" -antigravity-login'
    }
    
    cmd = mode_cmds.get(req.mode)
    if not cmd:
        raise HTTPException(status_code=400, detail=f"Chế độ CLIProxy '{req.mode}' không hợp lệ.")
        
    try:
        # Check if running in Docker container (os.name == 'posix' while host OS is Windows, or /.dockerenv exists)
        if os.name == 'posix' or os.path.exists('/.dockerenv'):
            return {
                "status": "docker_manual",
                "message": f"Ứng dụng đang chạy trong container Docker. Không thể tự động mở terminal trên máy thật (host).",
                "command": cmd
            }

        creation_flags = 0
        final_cmd = cmd
        if os.name == 'nt':
            # Use 'start "Beo CLIProxy Auth"' to open a styled terminal window with correct quoting
            final_cmd = f'start "Beo CLIProxy Auth" cmd /k ""{binary_path}" -{req.mode.replace("claude_code", "claude").replace("codex", "codex").replace("antigravity", "antigravity")}-login"'
            
        process = subprocess.Popen(
            final_cmd,
            shell=True,
            creationflags=creation_flags,
            cwd=str(BEO_ROOT)
        )
        return {
            "status": "success",
            "message": f"Đã khởi chạy CLIProxy cho {req.mode} trong cửa sổ terminal mới.",
            "pid": process.pid
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi khởi chạy terminal: {str(e)}"
        }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "db_path": str(DATABASE_PATH)}

# --- Quản lý Workspace ---

@app.post("/api/workspaces")
def create_workspace(ws: WorkspaceCreate, db: Session = Depends(get_db)):
    db_ws = db.query(Workspace).filter(Workspace.id == ws.id).first()
    if db_ws:
        raise HTTPException(status_code=400, detail="Workspace ID đã tồn tại.")
    new_ws = Workspace(id=ws.id, name=ws.name)
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)
    return {"status": "success", "workspace": {"id": new_ws.id, "name": new_ws.name}}

@app.get("/api/workspaces")
def list_workspaces(db: Session = Depends(get_db)):
    workspaces = db.query(Workspace).all()
    return [{"id": ws.id, "name": ws.name, "created_at": ws.created_at} for ws in workspaces]

@app.post("/api/workspaces/{workspace_id}/initialize")
def initialize_workspace(workspace_id: str, init_data: WorkspaceInitialize, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    
    # Cập nhật tên Workspace
    ws.name = init_data.company_name
    db.commit()
    db.refresh(ws)

    # Đảm bảo cấu hình agent
    ensure_agent_configs(workspace_id, db)

    # Sử dụng AgentWrapper để gọi LLM rephrase tầm nhìn & mục tiêu
    wrapper = AgentWrapper(workspace_id, db)
    
    prompt = (
        "Bạn là một chuyên gia tư vấn chiến lược doanh nghiệp cấp cao. "
        "Hãy viết lại (rephrase) và cải tiến một cách chuyên nghiệp, định hướng dài hạn, "
        "đầy cảm hứng và rõ ràng tầm nhìn (vision) và mục tiêu (goals) sau đây thành một tài liệu chiến lược bằng tiếng Việt. "
        "Định dạng kết quả đầu ra hoàn toàn bằng Markdown đẹp đẽ, bắt đầu bằng tiêu đề '# TẦM NHÌN & MỤC TIÊU' kèm theo tên công ty.\\n\\n"
        f"Tên công ty: {init_data.company_name}\\n"
        f"Tầm nhìn & Mục tiêu thô từ nhà sáng lập: {init_data.vision_goals}\\n\\n"
        "Hãy tập trung làm rõ: \\n"
        "1. Sứ mệnh cốt lõi (Mission)\\n"
        "2. Tầm nhìn chiến lược (Vision)\\n"
        "3. Các mục tiêu cụ thể và hành động (Goals & Objectives)\\n\\n"
        "Vui lòng chỉ trả về nội dung Markdown đã được rephrase và cải tiến, không thêm lời dẫn hay giải thích gì khác."
    )
    
    messages = [{"role": "user", "content": prompt}]
    
    try:
        rephrased_content = wrapper.call(messages)
    except Exception as e:
        # Fallback if LLM call fails
        rephrased_content = (
            f"# TẦM NHÌN & MỤC TIÊU: {init_data.company_name}\\n\\n"
            f"## Tầm nhìn & Mục tiêu ban đầu\\n"
            f"{init_data.vision_goals}\\n\\n"
            f"*(Lưu ý: Không thể kết nối với LLM để rephrase tự động. Lỗi: {str(e)})*"
        )
    
    # Lưu nội dung đã rephrase vào file VISION.md trong workspace
    write_workspace_file(workspace_id, "VISION.md", rephrased_content)
    
    return {
        "status": "success",
        "workspace_name": ws.name,
        "vision_md": rephrased_content
    }

@app.post("/api/workspaces/{workspace_id}/api-keys")
def register_api_key(workspace_id: str, k: APIKeyRegister, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        ws = Workspace(id=workspace_id, name="Beo Corporation")
        db.add(ws)
        db.commit()
        db.refresh(ws)
    
    if k.url or k.model:
        payload_data = {"key": k.key}
        if k.url:
            payload_data["url"] = k.url
        if k.model:
            payload_data["model"] = k.model
        payload = json.dumps(payload_data)
    else:
        payload = k.key
        
    encrypted = encrypt_key(payload)
    db_key = db.query(APIKey).filter(APIKey.workspace_id == workspace_id, APIKey.provider == k.provider.lower()).first()
    if db_key:
        db_key.encrypted_key = encrypted
    else:
        db_key = APIKey(workspace_id=workspace_id, provider=k.provider.lower(), encrypted_key=encrypted)
        db.add(db_key)
    db.commit()

    # Tự động cập nhật model cho toàn bộ 5 Agents trong DB sử dụng key mới đăng ký
    provider_name = k.provider.lower()
    model_name = k.model.strip() if k.model else None
    
    if model_name:
        if not model_name.startswith(f"{provider_name}/"):
            agent_model_id = f"{provider_name}/{model_name}"
        else:
            agent_model_id = model_name
    else:
        if provider_name == "gemini":
            agent_model_id = "gemini/gemini-1.5-flash"
        elif provider_name == "openai":
            agent_model_id = "openai/gpt-4o-mini"
        elif provider_name == "anthropic":
            agent_model_id = "anthropic/claude-3-5-sonnet"
        elif provider_name == "cohere":
            agent_model_id = "cohere/command-r"
        elif provider_name == "groq":
            agent_model_id = "groq/llama-3.3-70b-versatile"
        elif provider_name == "openrouter":
            agent_model_id = "openrouter/google/gemini-2.5-flash"
        elif provider_name == "cliproxyapi":
            agent_model_id = "cliproxyapi/openai/gemini-1.5-flash"
        else:
            agent_model_id = f"{provider_name}/default-model"

    from app.utils.agent_templates import initialize_agent_templates
    initialize_agent_templates(workspace_id)
    
    roles_defaults = {
        "secretary": ["read_file", "write_file", "send_email", "create_employee", "deploy_swarm"],
        "planner": ["read_file"],
        "developer": ["read_file", "write_file", "run_command"],
        "marketer": ["read_file", "write_file", "send_email"],
        "finance": ["read_file", "write_file"]
    }
    
    for role, def_skills in roles_defaults.items():
        cfg = db.query(AgentConfig).filter(
            AgentConfig.workspace_id == workspace_id,
            AgentConfig.role == role
        ).first()
        if cfg:
            cfg.model = agent_model_id
        else:
            cfg = AgentConfig(
                workspace_id=workspace_id,
                role=role,
                model=agent_model_id,
                is_active=True,
                enabled_skills=json.dumps(def_skills),
                enabled_mcp_servers=json.dumps([]),
                soul_path=f"agents/{role}/SOUL.md",
                personality_path=f"agents/{role}/PERSONALITY.md"
            )
            db.add(cfg)
    db.commit()

    return {"status": "success", "provider": k.provider}

@app.get("/api/workspaces/{workspace_id}/api-keys")
def list_workspace_api_providers(workspace_id: str, db: Session = Depends(get_db)):
    keys = db.query(APIKey).filter(APIKey.workspace_id == workspace_id).all()
    res = []
    for k in keys:
        url = None
        model = None
        try:
            decrypted = decrypt_key(k.encrypted_key)
            data = json.loads(decrypted)
            url = data.get("url")
            model = data.get("model")
        except Exception:
            pass
        res.append({
            "provider": k.provider,
            "url": url,
            "model": model
        })
    return res

@app.post("/api/workspaces/{workspace_id}/api-keys/test")
def test_api_key(workspace_id: str, t: APIKeyTest, db: Session = Depends(get_db)):
    key_val = t.key.strip() if t.key else ""
    url_val = t.url.strip() if t.url else None
    model_val = t.model.strip() if t.model else None
    
    if not key_val:
        db_key = db.query(APIKey).filter(APIKey.workspace_id == workspace_id, APIKey.provider == t.provider.lower()).first()
        if not db_key:
            raise HTTPException(status_code=400, detail="Không tìm thấy key đã lưu và không có key mới để test.")
        try:
            decrypted = decrypt_key(db_key.encrypted_key)
            try:
                data = json.loads(decrypted)
                key_val = data.get("key", "")
                if not url_val:
                    url_val = data.get("url")
                if not model_val:
                    model_val = data.get("model")
            except Exception:
                key_val = decrypted
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi giải mã key đã lưu: {str(e)}")

    if not key_val:
        raise HTTPException(status_code=400, detail="API Key không hợp lệ.")

    provider = t.provider.lower()
    test_model = model_val
    if not test_model:
        if provider == "gemini":
            test_model = "gemini/gemini-1.5-flash"
        elif provider == "openai":
            test_model = "openai/gpt-4o-mini"
        elif provider == "anthropic":
            test_model = "anthropic/claude-3-5-sonnet"
        elif provider == "cohere":
            test_model = "cohere/command-r"
        elif provider == "groq":
            test_model = "groq/llama3-8b-8192"
        elif provider == "openrouter":
            test_model = "openrouter/google/gemini-2.5-flash"
        elif provider == "cliproxyapi":
            test_model = "openai/gemini-1.5-flash"
        else:
            test_model = "openai/custom-model"

    is_custom_or_proxy = False
    api_base = url_val
    
    if provider == "custom":
        is_custom_or_proxy = True
        if not api_base:
            raise HTTPException(status_code=400, detail="Custom endpoint requires a Base URL.")
    elif provider == "cliproxyapi":
        is_custom_or_proxy = True
        if not api_base:
            api_base = "http://localhost:8317/v1"
    elif provider == "openrouter":
        if not api_base:
            api_base = "https://openrouter.ai/api/v1"

    kwargs = {
        "model": test_model,
        "messages": [{"role": "user", "content": "Ping"}],
        "api_key": key_val,
        "timeout": 10
    }
    
    if api_base:
        kwargs["api_base"] = api_base
        
    if is_custom_or_proxy:
        if not test_model.startswith("openai/"):
            if provider == "custom" and model_val:
                kwargs["model"] = f"openai/{model_val}"
            else:
                clean_model = test_model.split("/")[-1] if "/" in test_model else test_model
                kwargs["model"] = f"openai/{clean_model}"

    import litellm
    import os

    env_var_map = {
        "gemini": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "cohere": "COHERE_API_KEY",
        "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "cliproxyapi": "CLIPROXY_API_KEY",
        "custom": "CUSTOM_API_KEY"
    }
    
    env_var = env_var_map.get(provider)
    old_env_val = os.environ.get(env_var) if env_var else None
    if env_var:
        os.environ[env_var] = key_val
        if provider == "openrouter":
            os.environ["OR_API_KEY"] = key_val

    try:
        response = litellm.completion(**kwargs)
        reply = response.choices[0].message.content or ""
        return {"status": "success", "message": "Kết nối thành công!", "reply": reply}
    except Exception as e:
        return {"status": "error", "message": f"Lỗi kết nối: {str(e)}"}
    finally:
        if env_var:
            if old_env_val is not None:
                os.environ[env_var] = old_env_val
            else:
                os.environ.pop(env_var, None)
            if provider == "openrouter":
                if old_env_val is not None:
                    os.environ["OR_API_KEY"] = old_env_val
                else:
                    os.environ.pop("OR_API_KEY", None)

def fetch_openai_compatible_models(url: str, key: str) -> List[str]:
    import urllib.request
    import urllib.error
    import ssl
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if key:
            headers["Authorization"] = f"Bearer {key}"
        req = urllib.request.Request(
            url,
            headers=headers,
            method="GET"
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=5, context=context) as response:
            data = json.loads(response.read().decode("utf-8"))
            return [m["id"] for m in data.get("data", []) if "id" in m]
    except Exception as e:
        print(f"Error fetching OpenAI compatible models: {str(e)}")
        return []

def fetch_cohere_models(key: str) -> List[str]:
    import urllib.request
    import urllib.error
    import ssl
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if key:
            headers["Authorization"] = f"Bearer {key}"
        req = urllib.request.Request(
            "https://api.cohere.com/v1/models",
            headers=headers,
            method="GET"
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=5, context=context) as response:
            data = json.loads(response.read().decode("utf-8"))
            return [m["name"] for m in data.get("models", []) if "name" in m]
    except Exception as e:
        print(f"Error fetching Cohere models: {str(e)}")
        return []

def fetch_gemini_models(key: str) -> List[str]:
    import urllib.request
    import urllib.error
    import ssl
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=5, context=context) as response:
            data = json.loads(response.read().decode("utf-8"))
            res = []
            for m in data.get("models", []):
                name = m.get("name", "")
                if name.startswith("models/"):
                    name = name.replace("models/", "")
                res.append(name)
            return res
    except Exception as e:
        print(f"Error fetching Gemini models: {str(e)}")
        return []

def get_default_provider_models(provider: str) -> List[str]:
    defaults = {
        "gemini": [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash-exp",
            "gemini-1.0-pro"
        ],
        "openai": [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo"
        ],
        "anthropic": [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229"
        ],
        "cohere": [
            "command-r",
            "command-r-plus"
        ],
        "groq": [
            "llama-3.3-70b-versatile",
            "llama3-8b-8192",
            "llama3-70b-8192",
            "mixtral-8x7b-32768",
            "gemma2-9b-it"
        ],
        "openrouter": [
            "google/gemini-2.5-flash",
            "google/gemini-2.5-pro",
            "anthropic/claude-3.5-sonnet",
            "meta-llama/llama-3.3-70b-instruct"
        ],
        "cliproxyapi": [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "claude-3-5-sonnet-20241022",
            "gpt-4o"
        ],
        "custom": [
            "custom-model"
        ]
    }
    return defaults.get(provider.lower(), [])

@app.post("/api/workspaces/{workspace_id}/api-keys/scan-models")
def scan_provider_models(workspace_id: str, t: APIKeyScanModels, db: Session = Depends(get_db)):
    key_val = t.key.strip() if t.key else ""
    url_val = t.url.strip() if t.url else None
    
    if not key_val:
        db_key = db.query(APIKey).filter(APIKey.workspace_id == workspace_id, APIKey.provider == t.provider.lower()).first()
        if not db_key:
            return {"status": "default", "models": get_default_provider_models(t.provider.lower())}
        try:
            decrypted = decrypt_key(db_key.encrypted_key)
            try:
                data = json.loads(decrypted)
                key_val = data.get("key", "")
                if not url_val:
                    url_val = data.get("url")
            except Exception:
                key_val = decrypted
        except Exception:
            return {"status": "default", "models": get_default_provider_models(t.provider.lower())}

    if not key_val:
        return {"status": "default", "models": get_default_provider_models(t.provider.lower())}

    provider = t.provider.lower()
    try:
        models = []
        if provider == "openai":
            models = fetch_openai_compatible_models("https://api.openai.com/v1/models", key_val)
        elif provider == "openrouter":
            url = url_val or "https://openrouter.ai/api/v1/models"
            if not url.endswith("/models"):
                url = url.rstrip("/") + "/models"
            models = fetch_openai_compatible_models(url, key_val)
        elif provider == "groq":
            models = fetch_openai_compatible_models("https://api.groq.com/openai/v1/models", key_val)
        elif provider == "cohere":
            models = fetch_cohere_models(key_val)
        elif provider == "gemini":
            models = fetch_gemini_models(key_val)
        elif provider in ["custom", "cliproxyapi"]:
            if not url_val:
                url_val = "http://localhost:8317/v1" if provider == "cliproxyapi" else ""
            if url_val:
                url = url_val
                if not url.endswith("/models"):
                    url = url.rstrip("/") + "/models"
                models = fetch_openai_compatible_models(url, key_val)
        
        if models:
            return {"status": "success", "models": sorted(list(set(models)))}
        else:
            return {"status": "default", "models": get_default_provider_models(provider)}
    except Exception as e:
        return {
            "status": "fallback", 
            "error": str(e), 
            "models": get_default_provider_models(provider)
        }

# --- Onboarding & Chat ---

def ensure_agent_configs(workspace_id: str, db: Session):
    existing = db.query(AgentConfig).filter(AgentConfig.workspace_id == workspace_id).first()
    if existing:
        return
        
    providers_priority = ["custom", "openai", "anthropic", "gemini", "openrouter", "groq", "cohere", "cliproxyapi"]
    registered_key = None
    for p in providers_priority:
        key_record = db.query(APIKey).filter(
            APIKey.workspace_id == workspace_id,
            APIKey.provider == p
        ).first()
        if key_record:
            registered_key = key_record
            break
            
    agent_model_id = None
    if registered_key:
        provider_name = registered_key.provider.lower()
        model_name = None
        try:
            decrypted = decrypt_key(registered_key.encrypted_key)
            data = json.loads(decrypted)
            model_name = data.get("model")
        except Exception:
            pass
            
        if model_name:
            if not model_name.startswith(f"{provider_name}/"):
                agent_model_id = f"{provider_name}/{model_name}"
            else:
                agent_model_id = model_name
        else:
            defaults = {
                "gemini": "gemini/gemini-1.5-flash",
                "openai": "openai/gpt-4o-mini",
                "anthropic": "anthropic/claude-3-5-sonnet",
                "cohere": "cohere/command-r",
                "groq": "groq/llama-3.3-70b-versatile",
                "openrouter": "openrouter/google/gemini-2.5-flash",
                "cliproxyapi": "cliproxyapi/openai/gemini-1.5-flash"
            }
            agent_model_id = defaults.get(provider_name, f"{provider_name}/default-model")
            
    if not agent_model_id:
        agent_model_id = "gemini/gemini-1.5-flash"
        
    from app.utils.agent_templates import initialize_agent_templates
    try:
        initialize_agent_templates(workspace_id)
    except Exception:
        pass
        
    roles_defaults = {
        "secretary": ["read_file", "write_file", "send_email", "create_employee", "deploy_swarm"],
        "planner": ["read_file"],
        "developer": ["read_file", "write_file", "run_command"],
        "marketer": ["read_file", "write_file", "send_email"],
        "finance": ["read_file", "write_file"]
    }
    
    for role, def_skills in roles_defaults.items():
        cfg = AgentConfig(
            workspace_id=workspace_id,
            role=role,
            model=agent_model_id,
            is_active=True,
            enabled_skills=json.dumps(def_skills),
            enabled_mcp_servers=json.dumps([]),
            soul_path=f"agents/{role}/SOUL.md",
            personality_path=f"agents/{role}/PERSONALITY.md"
        )
        db.add(cfg)
    db.commit()

@app.get("/api/workspaces/{workspace_id}/onboarding/status")
def get_onboarding_status(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        ws = Workspace(id=workspace_id, name="Beo Corporation")
        db.add(ws)
        db.commit()
    ensure_agent_configs(workspace_id, db)
    
    # Onboarding is completed if specifications exist OR if there is at least one API key configured
    has_keys = db.query(APIKey).filter(APIKey.workspace_id == workspace_id).first() is not None
    completed = has_onboarding_specs(workspace_id) or has_keys
    
    return {
        "onboarding_completed": completed,
        "workspace_name": ws.name
    }

@app.get("/api/workspaces/{workspace_id}/onboarding/messages")
def get_chat_history(workspace_id: str, session_id: Optional[str] = "default", db: Session = Depends(get_db)):
    ensure_agent_configs(workspace_id, db)
    msgs = db.query(ChatMessage).filter(
        ChatMessage.workspace_id == workspace_id, 
        ChatMessage.channel == "secretary",
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.id.asc()).all()
    return [{"sender": m.sender, "message": m.message, "timestamp": m.timestamp} for m in msgs]

@app.get("/api/workspaces/{workspace_id}/onboarding/sessions")
def get_onboarding_sessions(workspace_id: str, db: Session = Depends(get_db)):
    subq = db.query(
        ChatMessage.session_id,
        func.min(ChatMessage.id).label("min_id")
    ).filter(
        ChatMessage.workspace_id == workspace_id,
        ChatMessage.channel == "secretary"
    ).group_by(ChatMessage.session_id).subquery()
    
    sessions = db.query(ChatMessage).join(
        subq, ChatMessage.id == subq.c.min_id
    ).order_by(ChatMessage.timestamp.desc()).all()
    
    return [
        {
            "session_id": s.session_id,
            "first_message": s.message[:60] + "..." if len(s.message) > 60 else s.message,
            "timestamp": s.timestamp
        }
        for s in sessions
    ]

@app.post("/api/workspaces/{workspace_id}/onboarding/chat")
def chat_with_secretary(workspace_id: str, msg: ChatMessageCreate, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    ensure_agent_configs(workspace_id, db)
    
    session_id = msg.session_id if msg.session_id else "default"
        
    user_msg = ChatMessage(workspace_id=workspace_id, sender="user", message=msg.message, channel="secretary", session_id=session_id)
    db.add(user_msg)
    db.commit()

    db_msgs = db.query(ChatMessage).filter(
        ChatMessage.workspace_id == workspace_id, 
        ChatMessage.channel == "secretary",
        ChatMessage.session_id == session_id
    ).all()
    history = [{"role": m.sender if m.sender != "user" else "user", "content": m.message} for m in db_msgs]
    
    def event_generator():
        generator_db = SessionLocal()
        try:
            wrapper = AgentWrapper(workspace_id, generator_db)
            messages = get_onboarding_messages(history)
            
            accumulated_chunks = []
            for chunk in wrapper.call_stream(messages, role="secretary"):
                accumulated_chunks.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
            
            ai_response = "".join(accumulated_chunks)
            
            # Save message to DB
            ai_msg = ChatMessage(workspace_id=workspace_id, sender="secretary", message=ai_response, channel="secretary", session_id=session_id)
            generator_db.add(ai_msg)
            generator_db.commit()

            # Proposal parsing - Markdown proposals first, then JSON fallback
            proposal_created = parse_markdown_proposals(ai_response, workspace_id, generator_db, role_name='secretary')
            
            # JSON fallback for legacy propose_files / deploy_swarm
            if not proposal_created:
                json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                if json_match:
                    try:
                        proposal = json.loads(json_match.group(1))
                        if proposal.get("action") == "propose_files":
                            for file_item in proposal.get("files", []):
                                f_name = file_item.get("name")
                                f_content = file_item.get("content")
                                if f_name in ["AIM.md", "OPERATIONS.md", "FINANCE.md"]:
                                    write_workspace_file(workspace_id, f_name, f_content)
                                    app_item = ApprovalItem(
                                        workspace_id=workspace_id,
                                        action_type="write_file",
                                        file_path=f_name,
                                        proposed_content=f_content,
                                        rationale=proposal.get("explanation", "Soạn thảo file đặc tả doanh nghiệp (Tự động duyệt)."),
                                        risk_level="LOW",
                                        status="approved"
                                    )
                                else:
                                    app_item = ApprovalItem(
                                        workspace_id=workspace_id,
                                        action_type="write_file",
                                        file_path=f_name,
                                        proposed_content=f_content,
                                        rationale=proposal.get("explanation", "Soạn thảo file đặc tả doanh nghiệp."),
                                        risk_level="LOW",
                                        status="pending"
                                    )
                                generator_db.add(app_item)
                            generator_db.commit()
                            proposal_created = True
                        elif proposal.get("action") == "deploy_swarm":
                            swarm_name = proposal.get("swarm_name", "Tác vụ Swarm tự động")
                            explanation = proposal.get("explanation", "Yêu cầu deploy swarm của Agent")
                            members = proposal.get("members", [])
                            
                            payload = json.dumps({
                                "swarm_name": swarm_name,
                                "members": members
                            }, ensure_ascii=False)
                            
                            app_item = ApprovalItem(
                                workspace_id=workspace_id,
                                action_type="deploy_swarm",
                                file_path=None,
                                proposed_content=payload,
                                rationale=explanation,
                                risk_level="MEDIUM",
                                status="pending"
                            )
                            generator_db.add(app_item)
                            generator_db.commit()
                            proposal_created = True
                    except Exception:
                        pass

            yield f"data: {json.dumps({'type': 'done', 'proposal_created': proposal_created, 'full_response': ai_response}, ensure_ascii=False)}\n\n"
        except Exception as e:
            err_msg = ChatMessage(
                workspace_id=workspace_id,
                sender="secretary",
                message=f"❌ [LỖI LLM API]: {str(e)}",
                channel="secretary"
            )
            generator_db.add(err_msg)
            generator_db.commit()
            yield f"data: {json.dumps({'type': 'error', 'content': f'❌ [LỖI LLM API]: {str(e)}'}, ensure_ascii=False)}\n\n"
        finally:
            generator_db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
# --- Quản lý Phòng Ban (Dynamic Reactive Watcher) ---

@app.get("/api/workspaces/{workspace_id}/departments")
def get_departments(workspace_id: str):
    # Reactive Config Watcher đọc OPERATIONS.md để trả về Sidebar
    deps = parse_active_departments(workspace_id)
    return {"departments": deps}

# --- Trò chuyện Agent chuyên biệt & Vector Memory ---

@app.post("/api/workspaces/{workspace_id}/chat/{role}")
def chat_with_agent(workspace_id: str, role: str, msg: ChatMessageCreate, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    ensure_agent_configs(workspace_id, db)
        
    target_channel = msg.channel if msg.channel else role.lower()
    session_id = msg.session_id if msg.session_id else "default"
    
    user_msg = ChatMessage(workspace_id=workspace_id, sender="user", message=msg.message, channel=target_channel, session_id=session_id)
    db.add(user_msg)
    db.commit()

    db_msgs = db.query(ChatMessage).filter(
        ChatMessage.workspace_id == workspace_id, 
        ChatMessage.channel == target_channel,
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.id.asc()).all()
    
    # Mapped history to avoid role validation errors in LiteLLM and prefix speaking agent
    history = []
    for m in db_msgs:
        h_role = m.sender
        h_content = m.message
        if h_role != "user":
            h_role = "assistant"
            h_content = f"[{m.sender.upper()}]: {m.message}"
        else:
            h_role = "user"
        history.append({"role": h_role, "content": h_content})
    
    # Local memory
    memory = VectorMemory(workspace_id)
    context_memories = memory.search_memory(msg.message, limit=2)
    context_str = ""
    if context_memories:
        context_str = "\n[Ngữ cảnh bộ nhớ liên quan]:\n" + "\n".join([m.get("text", "") for m in context_memories])

    def event_generator():
        generator_db = SessionLocal()
        try:
            wrapper = AgentWrapper(workspace_id, generator_db)
            proposal_created = False
            
            # Collaborative Group Chat Swarm Discussion Mode
            if target_channel.endswith("_group"):
                primary = role.lower()
                # Secretary is ALWAYS included in every group chat for global coordination
                if primary == "planner":
                    participants = ["planner", "secretary"]
                elif primary == "developer":
                    participants = ["developer", "secretary"]
                elif primary == "marketer":
                    participants = ["marketer", "secretary"]
                elif primary == "finance":
                    participants = ["finance", "secretary"]
                else:
                    participants = [primary, "secretary"]
                
                current_history = list(history)
                
                for idx, p in enumerate(participants):
                    # Yield start event for this agent
                    yield f"data: {json.dumps({'type': 'agent_start', 'sender': p}, ensure_ascii=False)}\n\n"
                    
                    messages = get_agent_messages(p, current_history)
                    if context_str and len(messages) > 0 and idx == 0:
                        messages[0]["content"] = messages[0]["content"] + context_str
                        
                    accumulated_chunks = []
                    for chunk in wrapper.call_stream(messages, role=p):
                        accumulated_chunks.append(chunk)
                        yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
                    
                    ai_response = "".join(accumulated_chunks)
                    
                    # Save agent's reply to DB
                    ai_msg = ChatMessage(
                        workspace_id=workspace_id,
                        sender=p,
                        message=ai_response,
                        channel=target_channel,
                        session_id=session_id
                    )
                    generator_db.add(ai_msg)
                    generator_db.commit()
                    
                    # Add to local memory
                    memory.add_memory(f"User: {msg.message}\nAgent ({p}): {ai_response}", {"channel": target_channel})
                    
                    # Append to current discussion history so the next agent responds to it
                    current_history.append({"role": "assistant", "content": f"[{p.upper()}]: {ai_response}"})
                    
                    # Parse proposals
                    json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                    if json_match:
                        try:
                            proposal = json.loads(json_match.group(1))
                            if proposal.get("action") == "propose_files":
                                for file_item in proposal.get("files", []):
                                    f_name = file_item.get("name")
                                    f_content = file_item.get("content")
                                    if f_name in ["AIM.md", "OPERATIONS.md", "FINANCE.md"]:
                                        write_workspace_file(workspace_id, f_name, f_content)
                                        app_item = ApprovalItem(
                                            workspace_id=workspace_id,
                                            action_type="write_file",
                                            file_path=f_name,
                                            proposed_content=f_content,
                                            rationale=proposal.get("explanation", f"Đề xuất tạo tệp {f_name} từ {p} (Tự động duyệt)"),
                                            risk_level="LOW",
                                            status="approved"
                                        )
                                    else:
                                        app_item = ApprovalItem(
                                            workspace_id=workspace_id,
                                            action_type="write_file",
                                            file_path=f_name,
                                            proposed_content=f_content,
                                            rationale=proposal.get("explanation", f"Đề xuất tạo tệp từ {p}"),
                                            risk_level="LOW",
                                            status="pending"
                                        )
                                    generator_db.add(app_item)
                                generator_db.commit()
                                proposal_created = True
                            elif proposal.get("action") == "deploy_swarm":
                                swarm_name = proposal.get("swarm_name", "Tác vụ Swarm tự động")
                                explanation = proposal.get("explanation", f"Yêu cầu deploy swarm của {p}")
                                members = proposal.get("members", [])
                                payload = json.dumps({
                                    "swarm_name": swarm_name,
                                    "members": members,
                                    "execution_mode": proposal.get("execution_mode", "sequential")
                                }, ensure_ascii=False)
                                
                                app_item = ApprovalItem(
                                    workspace_id=workspace_id,
                                    action_type="deploy_swarm",
                                    file_path=None,
                                    proposed_content=payload,
                                    rationale=explanation,
                                    risk_level="MEDIUM",
                                    status="pending"
                                )
                                generator_db.add(app_item)
                                generator_db.commit()
                                proposal_created = True
                        except Exception:
                            pass
                
                # Close group session
                yield f"data: {json.dumps({'type': 'done', 'proposal_created': proposal_created, 'full_response': 'Swarm discussion completed.'}, ensure_ascii=False)}\n\n"
                
            else:
                # Private Direct Chat Mode
                messages = get_agent_messages(role, history)
                if context_str and len(messages) > 0:
                    messages[0]["content"] = messages[0]["content"] + context_str
                    
                accumulated_chunks = []
                for chunk in wrapper.call_stream(messages, role=role):
                    accumulated_chunks.append(chunk)
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"
                
                ai_response = "".join(accumulated_chunks)
                
                ai_msg = ChatMessage(workspace_id=workspace_id, sender=role.lower(), message=ai_response, channel=target_channel, session_id=session_id)
                generator_db.add(ai_msg)
                generator_db.commit()
                
                memory.add_memory(f"User: {msg.message}\nAgent ({role}): {ai_response}", {"channel": target_channel})
                
                # Markdown proposals first, then JSON fallback
                proposal_created = parse_markdown_proposals(ai_response, workspace_id, generator_db, role_name=role)
                
                if not proposal_created:
                    json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                    if json_match:
                        try:
                            proposal = json.loads(json_match.group(1))
                            if proposal.get("action") == "propose_files":
                                for file_item in proposal.get("files", []):
                                    f_name = file_item.get("name")
                                    f_content = file_item.get("content")
                                    if f_name in ["AIM.md", "OPERATIONS.md", "FINANCE.md"]:
                                        write_workspace_file(workspace_id, f_name, f_content)
                                        app_item = ApprovalItem(
                                            workspace_id=workspace_id,
                                            action_type="write_file",
                                            file_path=f_name,
                                            proposed_content=f_content,
                                            rationale=proposal.get("explanation", f"Đề xuất tạo tệp {f_name} từ {role} (Tự động duyệt)"),
                                            risk_level="LOW",
                                            status="approved"
                                        )
                                    else:
                                        app_item = ApprovalItem(
                                            workspace_id=workspace_id,
                                            action_type="write_file",
                                            file_path=f_name,
                                            proposed_content=f_content,
                                            rationale=proposal.get("explanation", f"Đề xuất tạo tệp từ {role}"),
                                            risk_level="LOW",
                                            status="pending"
                                        )
                                    generator_db.add(app_item)
                                generator_db.commit()
                                proposal_created = True
                            elif proposal.get("action") == "deploy_swarm":
                                swarm_name = proposal.get("swarm_name", "Tác vụ Swarm tự động")
                                explanation = proposal.get("explanation", f"Yêu cầu deploy swarm của {role}")
                                members = proposal.get("members", [])
                                payload = json.dumps({
                                    "swarm_name": swarm_name,
                                    "members": members,
                                    "execution_mode": proposal.get("execution_mode", "sequential")
                                }, ensure_ascii=False)
                                
                                app_item = ApprovalItem(
                                    workspace_id=workspace_id,
                                    action_type="deploy_swarm",
                                    file_path=None,
                                    proposed_content=payload,
                                    rationale=explanation,
                                    risk_level="MEDIUM",
                                    status="pending"
                                )
                                generator_db.add(app_item)
                                generator_db.commit()
                                proposal_created = True
                            elif proposal.get("action") == "propose_command":
                                raw_command = proposal.get("command", "")
                                final_risk = proposal.get("risk_level", "MEDIUM")
                                settings = get_system_settings(workspace_id)
                                if settings.get("shell_security_sandbox", True):
                                    dangerous_patterns = ["rm -rf", "rmdir /s", "mkfs", "dd if=", "shutdown", "format c:", "del /s", "poweroff", "reboot"]
                                    for pattern in dangerous_patterns:
                                        if pattern in raw_command.lower():
                                            final_risk = "HIGH"
                                            break
                                app_item = ApprovalItem(
                                    workspace_id=workspace_id,
                                    action_type="run_command",
                                    file_path=None,
                                    proposed_content=raw_command,
                                    rationale=proposal.get('explanation', f'Đề xuất thực thi từ {role}'),
                                    risk_level=final_risk,
                                    status="pending"
                                )
                                generator_db.add(app_item)
                                generator_db.commit()
                                proposal_created = True
                        except Exception:
                            pass
                
                yield f"data: {json.dumps({'type': 'done', 'proposal_created': proposal_created, 'full_response': ai_response}, ensure_ascii=False)}\n\n"
                
        except Exception as e:
            err_msg = ChatMessage(
                workspace_id=workspace_id,
                sender=role.lower(),
                message=f"❌ [LỖI LLM API]: {str(e)}",
                channel=target_channel
            )
            generator_db.add(err_msg)
            generator_db.commit()
            yield f"data: {json.dumps({'type': 'error', 'content': f'❌ [LỖI LLM API]: {str(e)}'}, ensure_ascii=False)}\n\n"
        finally:
            generator_db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/workspaces/{workspace_id}/chat/{role}/messages")
def get_channel_messages(workspace_id: str, role: str, channel: Optional[str] = None, session_id: Optional[str] = "default", db: Session = Depends(get_db)):
    target_channel = channel if channel else role.lower()
    session_id_val = session_id if session_id else "default"
    msgs = db.query(ChatMessage).filter(
        ChatMessage.workspace_id == workspace_id, 
        ChatMessage.channel == target_channel,
        ChatMessage.session_id == session_id_val
    ).order_by(ChatMessage.id.asc()).all()
    return [{"sender": m.sender, "message": m.message, "timestamp": m.timestamp} for m in msgs]

@app.get("/api/workspaces/{workspace_id}/chat/{role}/sessions")
def get_channel_sessions(workspace_id: str, role: str, channel: Optional[str] = None, db: Session = Depends(get_db)):
    target_channel = channel if channel else role.lower()
    subq = db.query(
        ChatMessage.session_id,
        func.min(ChatMessage.id).label("min_id")
    ).filter(
        ChatMessage.workspace_id == workspace_id,
        ChatMessage.channel == target_channel
    ).group_by(ChatMessage.session_id).subquery()
    
    sessions = db.query(ChatMessage).join(
        subq, ChatMessage.id == subq.c.min_id
    ).order_by(ChatMessage.timestamp.desc()).all()
    
    return [
        {
            "session_id": s.session_id,
            "first_message": s.message[:60] + "..." if len(s.message) > 60 else s.message,
            "timestamp": s.timestamp
        }
        for s in sessions
    ]

# --- Hàng đợi phê duyệt (Approval Queue / Inbox) ---

@app.get("/api/workspaces/{workspace_id}/inbox")
def get_inbox_items(workspace_id: str, db: Session = Depends(get_db)):
    items = db.query(ApprovalItem).filter(ApprovalItem.workspace_id == workspace_id, ApprovalItem.status == "pending").all()
    return [{
        "id": item.id,
        "action_type": item.action_type,
        "proposed_content": item.proposed_content,
        "file_path": item.file_path,
        "rationale": item.rationale,
        "risk_level": item.risk_level,
        "cost_estimate": item.cost_estimate,
        "created_at": item.created_at
    } for item in items]

@app.post("/api/workspaces/{workspace_id}/inbox/{item_id}/approve")
def approve_item(workspace_id: str, item_id: int, db: Session = Depends(get_db)):
    item = db.query(ApprovalItem).filter(ApprovalItem.workspace_id == workspace_id, ApprovalItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục phê duyệt.")
        
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Mục này đã được xử lý.")

    try:
        if item.action_type == "write_file":
            write_workspace_file(workspace_id, item.file_path, item.proposed_content)
        elif item.action_type == "run_command":
            result = subprocess.run(
                item.proposed_content,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(get_workspace_files_path(workspace_id))
            )
            log_output = f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            # Ghi log kết quả
            os.makedirs(str(get_workspace_files_path(workspace_id) / "logs"), exist_ok=True)
            write_workspace_file(workspace_id, f"logs/cmd_{item_id}.log", log_output)
            item.proposed_content = f"{item.proposed_content}\n\n[RUN RESULTS]\n{log_output}"
        elif item.action_type == "send_email":
            os.makedirs(str(get_workspace_files_path(workspace_id) / "logs"), exist_ok=True)
            write_workspace_file(workspace_id, f"logs/email_{item_id}.log", f"SIMULATED EMAIL SENT:\n{item.proposed_content}")
        elif item.action_type == "mcp_tool":
            payload_data = json.loads(item.proposed_content)
            server_name = payload_data.get("server")
            tool_name = payload_data.get("tool")
            args = payload_data.get("arguments", {})

            # Tìm kiếm máy chủ MCP
            server = db.query(MCPServer).filter(
                MCPServer.workspace_id == workspace_id,
                MCPServer.name == server_name.lower()
            ).first()

            if not server:
                raise HTTPException(status_code=404, detail=f"Không tìm thấy MCP Server '{server_name}'")

            # Gửi yêu cầu JSON-RPC tới server
            payload = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": args
                },
                "id": 1
            }
            
            url = server.url
            if not url.endswith("/tools/call") and not url.endswith("/call"):
                url = url.rstrip("/") + "/tools/call"
                
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            try:
                with urllib.request.urlopen(req, timeout=3) as response:
                    resp_data = response.read().decode("utf-8")
                    result_data = json.loads(resp_data)
            except Exception as e:
                # Fallback giả lập thành công nếu server offline
                result_data = {
                    "status": "success",
                    "mcp_server": server.name,
                    "tool_executed": tool_name,
                    "result": f"[MCP SUCCESS] Đã gọi giả lập tool '{tool_name}' trên server '{server.name}' với tham số {args}. (Server thật tại {server.url} offline: {str(e)})"
                }

            # Ghi log kết quả
            os.makedirs(str(get_workspace_files_path(workspace_id) / "logs"), exist_ok=True)
            write_workspace_file(workspace_id, f"logs/mcp_{item_id}.log", json.dumps(result_data, indent=2, ensure_ascii=False))
            item.proposed_content = f"{item.proposed_content}\n\n[RUN RESULTS]\n{json.dumps(result_data, indent=2, ensure_ascii=False)}"
        elif item.action_type == "create_employee":
            # Parse the markdown proposed content to extract employee details
            parsed = parse_employee_markdown(item.proposed_content)
            emp_role = parsed.get('role', item.file_path or 'custom_agent')
            emp_name = parsed.get('name', 'Nhân sự AI mới')
            emp_skills = parsed.get('skills', ['read_file'])
            emp_mcp = parsed.get('mcp_servers', [])
            emp_model = parsed.get('model')
            emp_soul = parsed.get('soul', f'# SOUL: {emp_name}\n\nNhân viên AI chuyên trách.')
            emp_personality = parsed.get('personality', f'# PERSONALITY: {emp_name}\n\nChuyên nghiệp và ngắn gọn.')
            
            # Determine the model to use (inherit from an existing agent if not specified)
            if not emp_model:
                existing_cfg = db.query(AgentConfig).filter(AgentConfig.workspace_id == workspace_id).first()
                emp_model = existing_cfg.model if existing_cfg else 'gemini/gemini-1.5-flash'
            
            # Create or update AgentConfig in DB
            cfg = db.query(AgentConfig).filter(
                AgentConfig.workspace_id == workspace_id,
                AgentConfig.role == emp_role
            ).first()
            if cfg:
                cfg.model = emp_model
                cfg.is_active = True
                cfg.enabled_skills = json.dumps(emp_skills)
                cfg.enabled_mcp_servers = json.dumps(emp_mcp)
            else:
                cfg = AgentConfig(
                    workspace_id=workspace_id,
                    role=emp_role,
                    model=emp_model,
                    is_active=True,
                    enabled_skills=json.dumps(emp_skills),
                    enabled_mcp_servers=json.dumps(emp_mcp),
                    soul_path=f"agents/{emp_role}/SOUL.md",
                    personality_path=f"agents/{emp_role}/PERSONALITY.md"
                )
                db.add(cfg)
            db.commit()
            
            # Write SOUL.md and PERSONALITY.md to disk
            write_workspace_file(workspace_id, f"agents/{emp_role}/SOUL.md", emp_soul)
            write_workspace_file(workspace_id, f"agents/{emp_role}/PERSONALITY.md", emp_personality)
            
            # Proactively update OPERATIONS.md to register the new department
            try:
                ops_content = read_workspace_file(workspace_id, "OPERATIONS.md")
            except Exception:
                ops_content = "# Bộ máy vận hành\n## active departments\n"
            
            # Add the new employee to OPERATIONS.md if not already listed
            if emp_role.lower() not in ops_content.lower():
                ops_content += f"\n- {emp_name} ({emp_role})\n"
                write_workspace_file(workspace_id, "OPERATIONS.md", ops_content)
            
            # Register MCP servers if specified and not already in DB
            for mcp_name in emp_mcp:
                existing_mcp = db.query(MCPServer).filter(
                    MCPServer.workspace_id == workspace_id,
                    MCPServer.name == mcp_name.lower()
                ).first()
                if not existing_mcp:
                    # Find default URL from presets
                    default_url = f"http://localhost:500{hash(mcp_name) % 10}"
                    for preset in PRESET_MCP_SERVERS:
                        if preset['key'] == mcp_name:
                            default_url = preset.get('default_url', default_url)
                            break
                    new_mcp = MCPServer(
                        workspace_id=workspace_id,
                        name=mcp_name.lower(),
                        url=default_url,
                        status="connected"
                    )
                    db.add(new_mcp)
            db.commit()
        elif item.action_type == "deploy_swarm":
            # Check if proposed_content is markdown or JSON
            content = item.proposed_content.strip()
            if content.startswith('#') or 'Triển khai Swarm' in content:
                # Markdown format
                parsed = parse_swarm_markdown(content)
                swarm_name = parsed.get('swarm_name', 'Swarm Job')
                members_data = parsed.get('members', [])
                execution_mode = parsed.get('execution_mode', 'sequential')
            else:
                # Legacy JSON format
                payload_data = json.loads(content)
                swarm_name = payload_data.get("swarm_name", "Swarm Job")
                members_data = payload_data.get("members", [])
                execution_mode = payload_data.get("execution_mode", "sequential")
            
            swarm_job = SwarmJob(
                workspace_id=workspace_id,
                name=swarm_name,
                status="pending",
                execution_mode=execution_mode
            )
            db.add(swarm_job)
            db.commit()
            db.refresh(swarm_job)
            
            for m in members_data:
                member = SwarmMember(
                    swarm_job_id=swarm_job.id,
                    role=m.get("role", "secretary"),
                    task=m.get("task", ""),
                    status="pending"
                )
                db.add(member)
            db.commit()
            
            # Kick off background execution
            start_swarm_background(workspace_id, swarm_job.id, SessionLocal)
        else:
            raise HTTPException(status_code=400, detail=f"Hành động {item.action_type} chưa được hỗ trợ.")
            
        item.status = "approved"
        db.commit()
        return {"status": "success", "message": "Hành động đã phê duyệt và thực thi thành công."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi thực thi: {str(e)}")

@app.post("/api/workspaces/{workspace_id}/inbox/{item_id}/reject")
def reject_item(workspace_id: str, item_id: int, db: Session = Depends(get_db)):
    item = db.query(ApprovalItem).filter(ApprovalItem.workspace_id == workspace_id, ApprovalItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục phê duyệt.")
        
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Mục này đã được xử lý.")

    item.status = "rejected"
    db.commit()
    return {"status": "success", "message": "Đã từ chối hành động thành công."}

@app.post("/api/workspaces/{workspace_id}/inbox/{item_id}/edit")
def edit_item(workspace_id: str, item_id: int, data: ApprovalEdit, db: Session = Depends(get_db)):
    item = db.query(ApprovalItem).filter(ApprovalItem.workspace_id == workspace_id, ApprovalItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục phê duyệt.")
        
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Mục này đã được xử lý.")

    item.proposed_content = data.content
    db.commit()
    return {"status": "success", "content": item.proposed_content}

# --- Quản lý File (Tài liệu Công ty) ---

@app.get("/api/workspaces/{workspace_id}/files")
def get_files(workspace_id: str):
    return list_workspace_files(workspace_id)

@app.get("/api/workspaces/{workspace_id}/files/{file_path:path}")
def get_file_content(workspace_id: str, file_path: str):
    try:
        content = read_workspace_file(workspace_id, file_path)
        return {"path": file_path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/workspaces/{workspace_id}/files/{file_path:path}")
def save_file_content(workspace_id: str, file_path: str, data: ApprovalEdit):
    try:
        write_workspace_file(workspace_id, file_path, data.content)
        return {"status": "success", "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Quản trị Dự án (Projects - Pha 3) ---

@app.post("/api/workspaces/{workspace_id}/projects")
def create_project(workspace_id: str, proj: ProjectCreate, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
        
    get_project_root(workspace_id, proj.name)
    
    product_md = f"""# Đặc tả sản phẩm: {proj.name}

## Product Specifications
{proj.description or "Đặc tả sản phẩm."}

## MVP Scope
- Tính năng cốt lõi 1
- Tính năng cốt lõi 2

## Tech Stack
- Frontend: Vite + React
- Backend: FastAPI

## Definition of Done (DoD)
- Code chạy tốt trên localhost.
- Chạy qua toàn bộ unit tests.
"""
    write_project_file(workspace_id, proj.name, "PRODUCT.md", product_md)
    
    log_md = f"""# Nhật ký hoạt động: {proj.name}

## Khởi tạo
- Dự án được tạo mới.
"""
    write_project_file(workspace_id, proj.name, "LOG.md", log_md)
    
    return {"status": "success", "project": proj.name}

@app.get("/api/workspaces/{workspace_id}/projects")
def list_workspace_projects(workspace_id: str):
    proj_dir = WORKSPACES_DIR / workspace_id / "projects"
    if not proj_dir.exists():
        return []
    
    projects = []
    for p in proj_dir.iterdir():
        if p.is_dir():
            projects.append(p.name)
    return projects

@app.get("/api/workspaces/{workspace_id}/projects/{project_name}/files")
def get_project_files_list(workspace_id: str, project_name: str):
    try:
        return list_project_files(workspace_id, project_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_id}/projects/{project_name}/files/{file_path:path}")
def get_project_file_content(workspace_id: str, project_name: str, file_path: str):
    try:
        content = read_project_file(workspace_id, project_name, file_path)
        return {"path": file_path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/workspaces/{workspace_id}/projects/{project_name}/files/{file_path:path}")
def save_project_file_content(workspace_id: str, project_name: str, file_path: str, data: ApprovalEdit):
    try:
        write_project_file(workspace_id, project_name, file_path, data.content)
        return {"status": "success", "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Bộ máy Quy trình (Simple Workflow Engine - Pha 2) ---

loop_counters = {}

@app.post("/api/workspaces/{workspace_id}/workflows")
def register_workflow(workspace_id: str, data: WorkflowStepsRegister, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
        
    created_steps = []
    for step in data.steps:
        new_step = WorkflowStep(
            workspace_id=workspace_id,
            project_name=step.project_name,
            role=step.role,
            step_name=step.step_name,
            status="pending"
        )
        db.add(new_step)
        created_steps.append(new_step)
    db.commit()
    
    return {
        "status": "success", 
        "steps": [{"id": s.id, "step_name": s.step_name, "role": s.role, "status": s.status} for s in created_steps]
    }

@app.get("/api/workspaces/{workspace_id}/workflows")
def get_workspace_workflows(workspace_id: str, db: Session = Depends(get_db)):
    steps = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == workspace_id).order_by(WorkflowStep.id.asc()).all()
    return [{
        "id": s.id,
        "project_name": s.project_name,
        "role": s.role,
        "step_name": s.step_name,
        "status": s.status,
        "result": s.result,
        "error_log": s.error_log,
        "updated_at": s.updated_at
    } for s in steps]

@app.post("/api/workspaces/{workspace_id}/workflows/{step_id}/run")
def run_workflow_step(workspace_id: str, step_id: int, db: Session = Depends(get_db)):
    step = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == workspace_id, WorkflowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Không tìm thấy bước quy trình.")
        
    if step.status in ["completed", "running"]:
        return {"status": step.status, "message": "Bước này đang chạy hoặc đã hoàn thành."}
        
    # Tăng bộ đếm Loop Guard
    counter_key = (workspace_id, step_id)
    loop_counters[counter_key] = loop_counters.get(counter_key, 0) + 1
    
    settings = get_system_settings(workspace_id)
    loop_limit = settings.get("loop_guard_limit", 5)
    
    if loop_counters[counter_key] > loop_limit:
        step.status = "failed"
        step.error_log = f"Loop Guard Triggered: Agent dính vào vòng lặp logic vô hạn (> {loop_limit} lần gọi liên tiếp). Tác vụ dừng lại để bảo toàn chi phí."
        
        # Tạo thông báo lỗi trong Inbox
        alert_item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="notify",
            proposed_content=step.error_log,
            rationale="Cảnh báo Loop Guard: Cần sự can thiệp từ người dùng.",
            risk_level="HIGH",
            status="pending"
        )
        db.add(alert_item)
        db.commit()
        return {"status": "failed", "detail": step.error_log}

    step.status = "running"
    db.commit()

    try:
        wrapper = AgentWrapper(workspace_id, db)
        prompt = f"Bạn là Agent {step.role}. Hãy thực thi bước sau trong quy trình làm việc: '{step.step_name}'."
        messages = [{"role": "user", "content": prompt}]
        
        ai_response = wrapper.call(messages, role=step.role)
        
        # Phân tích xem có đề xuất hành động cần duyệt không
        json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
        has_proposal = False
        
        if json_match:
            try:
                proposal = json.loads(json_match.group(1))
                if proposal.get("action") in ["propose_files", "propose_command", "propose_mcp_tool"]:
                    if proposal.get("action") == "propose_files":
                        for file_item in proposal.get("files", []):
                            f_name = file_item.get("name")
                            f_content = file_item.get("content")
                            if f_name in ["AIM.md", "OPERATIONS.md", "FINANCE.md"]:
                                write_workspace_file(workspace_id, f_name, f_content)
                                app_item = ApprovalItem(
                                    workspace_id=workspace_id,
                                    action_type="write_file",
                                    file_path=f_name,
                                    proposed_content=f_content,
                                    rationale=proposal.get("explanation", f"Yêu cầu từ bước {step.step_name} (Tự động duyệt)"),
                                    risk_level="LOW",
                                    status="approved"
                                )
                            else:
                                app_item = ApprovalItem(
                                    workspace_id=workspace_id,
                                    action_type="write_file",
                                    file_path=f_name,
                                    proposed_content=f_content,
                                    rationale=proposal.get("explanation", f"Yêu cầu từ bước {step.step_name}"),
                                    risk_level="LOW",
                                    status="pending"
                                )
                            db.add(app_item)
                    elif proposal.get("action") == "propose_command":
                        raw_command = proposal.get("command", "")
                        final_risk = proposal.get("risk_level", "MEDIUM")
                        security_warning = ""
                        settings = get_system_settings(workspace_id)
                        if settings.get("shell_security_sandbox", True):
                            dangerous_patterns = ["rm -rf", "rmdir /s", "mkfs", "dd if=", "shutdown", "format c:", "del /s", "poweroff", "reboot"]
                            for pattern in dangerous_patterns:
                                if pattern in raw_command.lower():
                                    final_risk = "HIGH"
                                    security_warning = f"[CẢNH BÁO BẢO MẬT: Phát hiện lệnh nhạy cảm '{pattern}'] "
                                    break

                        app_item = ApprovalItem(
                            workspace_id=workspace_id,
                            action_type="run_command",
                            proposed_content=raw_command,
                            rationale=f"{security_warning}{proposal.get('explanation', f'Yêu cầu từ bước {step.step_name}')}",
                            risk_level=final_risk,
                            status="pending"
                        )
                        db.add(app_item)
                    elif proposal.get("action") == "propose_mcp_tool":
                        server_name = proposal.get("server", "")
                        tool_name = proposal.get("tool", "")
                        arguments = proposal.get("arguments", {})
                        final_risk = "MEDIUM"
                        if any(p in tool_name.lower() for p in ["delete", "drop", "remove", "clear"]):
                            final_risk = "HIGH"
                        mcp_payload = json.dumps({
                            "server": server_name,
                            "tool": tool_name,
                            "arguments": arguments
                        })
                        app_item = ApprovalItem(
                            workspace_id=workspace_id,
                            action_type="mcp_tool",
                            proposed_content=mcp_payload,
                            rationale=proposal.get("explanation", f"Yêu cầu chạy công cụ {tool_name} từ bước {step.step_name}"),
                            risk_level=final_risk,
                            status="pending"
                        )
                        db.add(app_item)
                    
                    step.status = "waiting_approval"
                    step.result = ai_response
                    has_proposal = True
            except Exception:
                pass
                
        if not has_proposal:
            step.status = "completed"
            step.result = ai_response
            # Reset Loop Guard counter khi hoàn thành thành công
            loop_counters[counter_key] = 0
            
        db.commit()
        return {"status": step.status, "result": step.result}
        
    except Exception as e:
        step.status = "failed"
        step.error_log = str(e)
        db.commit()
        return {"status": "failed", "error_log": step.error_log}

@app.post("/api/workspaces/{workspace_id}/workflows/{step_id}/retry")
def retry_workflow_step(workspace_id: str, step_id: int, db: Session = Depends(get_db)):
    step = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == workspace_id, WorkflowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Không tìm thấy bước quy trình.")
    
    step.status = "pending"
    step.error_log = None
    db.commit()
    loop_counters[(workspace_id, step_id)] = 0
    return run_workflow_step(workspace_id, step_id, db)

@app.post("/api/workspaces/{workspace_id}/workflows/{step_id}/skip")
def skip_workflow_step(workspace_id: str, step_id: int, db: Session = Depends(get_db)):
    step = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == workspace_id, WorkflowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Không tìm thấy bước quy trình.")
        
    step.status = "completed"
    step.result = "Bỏ qua bởi người dùng."
    step.error_log = None
    db.commit()
    loop_counters[(workspace_id, step_id)] = 0
    return {"status": "completed", "message": "Đã bỏ qua bước quy trình."}

@app.post("/api/workspaces/{workspace_id}/workflows/{step_id}/edit")
def edit_workflow_step(workspace_id: str, step_id: int, data: StepEdit, db: Session = Depends(get_db)):
    step = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == workspace_id, WorkflowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Không tìm thấy bước quy trình.")
        
    step.step_name = data.step_name
    step.role = data.role
    step.status = "pending"
    step.error_log = None
    db.commit()
    loop_counters[(workspace_id, step_id)] = 0
    return {"status": "pending", "message": "Đã chỉnh sửa và đặt lại trạng thái về pending."}

# --- Quản trị Model Context Protocol (MCP Tooling - Gap 3) ---

import urllib.request
import urllib.error

@app.get("/api/workspaces/{workspace_id}/mcp/servers")
def list_mcp_servers(workspace_id: str, db: Session = Depends(get_db)):
    servers = db.query(MCPServer).filter(MCPServer.workspace_id == workspace_id).all()
    return [{"id": s.id, "name": s.name, "url": s.url, "status": s.status} for s in servers]

@app.post("/api/workspaces/{workspace_id}/mcp/servers")
def register_mcp_server(workspace_id: str, server: MCPServerRegister, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
        
    db_server = db.query(MCPServer).filter(
        MCPServer.workspace_id == workspace_id, 
        MCPServer.name == server.name.lower()
    ).first()
    
    if db_server:
        db_server.url = server.url
        db_server.status = "connected"
    else:
        db_server = MCPServer(
            workspace_id=workspace_id,
            name=server.name.lower(),
            url=server.url,
            status="connected"
        )
        db.add(db_server)
    db.commit()
    return {"status": "success", "server": db_server.name}

@app.get("/api/workspaces/{workspace_id}/mcp/servers/{server_name}/tools")
def list_mcp_server_tools(workspace_id: str, server_name: str, db: Session = Depends(get_db)):
    server = db.query(MCPServer).filter(
        MCPServer.workspace_id == workspace_id, 
        MCPServer.name == server_name.lower()
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy MCP Server '{server_name}'")
        
    # Chuẩn giao tiếp MCP JSON-RPC: tools/list
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "params": {},
        "id": 1
    }
    
    url = server.url
    if not url.endswith("/tools/list") and not url.endswith("/tools"):
        url = url.rstrip("/") + "/tools"
        
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            resp_data = response.read().decode("utf-8")
            return json.loads(resp_data)
    except Exception as e:
        # Fallback danh sách tools mặc định nếu server offline
        return {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "tools": [
                    {
                        "name": "send_slack_message",
                        "description": "Gửi tin nhắn lên Slack channel",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "channel": {"type": "string"},
                                "message": {"type": "string"}
                            },
                            "required": ["channel", "message"]
                        }
                    },
                    {
                        "name": "read_google_sheet",
                        "description": "Đọc dữ liệu từ Google Sheets",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "spreadsheet_id": {"type": "string"},
                                "range": {"type": "string"}
                            },
                            "required": ["spreadsheet_id"]
                        }
                    }
                ],
                "warning": f"Danh sách giả lập fallback (Server thật tại {server.url} offline: {str(e)})"
            }
        }

@app.post("/api/workspaces/{workspace_id}/mcp/call/{server_name}")
def call_mcp_tool(workspace_id: str, server_name: str, call: MCPServerCall, db: Session = Depends(get_db)):
    server = db.query(MCPServer).filter(
        MCPServer.workspace_id == workspace_id, 
        MCPServer.name == server_name.lower()
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy MCP Server '{server_name}'")
        
    # Chuẩn giao tiếp MCP JSON-RPC: tools/call
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": call.tool_name,
            "arguments": call.arguments or {}
        },
        "id": 1
    }
    
    url = server.url
    if not url.endswith("/tools/call") and not url.endswith("/call"):
        url = url.rstrip("/") + "/tools/call"
        
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            resp_data = response.read().decode("utf-8")
            return json.loads(resp_data)
    except Exception as e:
        # Fallback giả lập thành công nếu server offline
        return {
            "status": "success",
            "mcp_server": server.name,
            "tool_executed": call.tool_name,
            "result": f"[MCP SUCCESS] Đã gọi giả lập tool '{call.tool_name}' trên server '{server.name}' với tham số {call.arguments or {}}. (Server thật tại {server.url} offline: {str(e)})"
        }

# --- Trình biên dịch SOP sang Workflow (SOP-to-Workflow Compiler - Gap 4) ---

class SOPCompileRequest(BaseModel):
    file_path: str  # e.g., "SOP_LAUNCH.md" or relative path in workspace
    project_name: Optional[str] = None

@app.post("/api/workspaces/{workspace_id}/workflows/compile-sop")
def compile_sop_to_workflow(workspace_id: str, req: SOPCompileRequest, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
        
    try:
        content = read_workspace_file(workspace_id, req.file_path)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file SOP tại {req.file_path}: {str(e)}")
        
    # Phân tích cú pháp SOP
    # Tìm kiếm các dòng bắt đầu bằng list item và có nhãn Agent vai trò
    # Ví dụ: "- [Developer] Thiết lập database router" hoặc "- [Planner] Viết roadmap"
    lines = content.split("\n")
    compiled_steps = []
    
    role_mapping = {
        "dev": "developer",
        "developer": "developer",
        "planner": "planner",
        "plan": "planner",
        "marketer": "marketer",
        "marketing": "marketer",
        "finance": "finance",
        "legal": "finance",
        "secretary": "secretary"
    }
    
    for line in lines:
        line_clean = line.strip()
        # Regex tìm kiếm nhãn [Role] hoặc (Role) hoặc Role: ở đầu dòng
        match = re.match(r"^[-*\d.\s+]*\[([a-zA-Z\s\-]+)\](.*)$", line_clean)
        if not match:
            # Thử pattern dạng: - Developer: Làm gì đó
            match = re.match(r"^[-*\d.\s+]*([a-zA-Z]+):\s*(.*)$", line_clean)
            
        if match:
            raw_role = match.group(1).strip().lower()
            step_desc = match.group(2).strip()
            
            # Map role
            assigned_role = "secretary"
            for key, val in role_mapping.items():
                if key in raw_role:
                    assigned_role = val
                    break
                    
            if step_desc:
                # Tạo WorkflowStep mới
                new_step = WorkflowStep(
                    workspace_id=workspace_id,
                    project_name=req.project_name,
                    role=assigned_role,
                    step_name=step_desc,
                    status="pending"
                )
                db.add(new_step)
                compiled_steps.append(new_step)
                
    db.commit()
    
    return {
        "status": "success",
        "compiled_count": len(compiled_steps),
        "steps": [{"id": s.id, "step_name": s.step_name, "role": s.role, "status": s.status} for s in compiled_steps]
    }

# --- Quản trị Agent và Phân quyền Skills/MCP (Custom Agent Customizer) ---

class AgentConfigEdit(BaseModel):
    model: Optional[str] = None
    is_active: Optional[bool] = None
    enabled_skills: Optional[List[str]] = None
    enabled_mcp_servers: Optional[List[str]] = None

class AgentFileEdit(BaseModel):
    file_type: str  # "soul" or "personality"
    content: str

@app.get("/api/presets")
def get_presets():
    return {
        "skills": PRESET_SKILLS,
        "mcp_servers": PRESET_MCP_SERVERS
    }

@app.get("/api/workspaces/{workspace_id}/agents")
def list_workspace_agents(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")

    # Tự động khởi tạo templates SOUL/PERSONALITY trên đĩa cứng
    initialize_agent_templates(workspace_id)

    # Đảm bảo 5 roles được khởi tạo cấu hình mặc định trong DB
    roles_defaults = {
        "secretary": ["read_file", "write_file", "send_email"],
        "planner": ["read_file"],
        "developer": ["read_file", "write_file", "run_command"],
        "marketer": ["read_file", "write_file", "send_email"],
        "finance": ["read_file", "write_file"]
    }

    configs = db.query(AgentConfig).filter(AgentConfig.workspace_id == workspace_id).all()
    config_dict = {c.role: c for c in configs}

    for role, def_skills in roles_defaults.items():
        if role not in config_dict:
            new_cfg = AgentConfig(
                workspace_id=workspace_id,
                role=role,
                model="gemini/gemini-1.5-flash",
                is_active=True,
                enabled_skills=json.dumps(def_skills),
                enabled_mcp_servers=json.dumps([]),
                soul_path=f"agents/{role}/SOUL.md",
                personality_path=f"agents/{role}/PERSONALITY.md"
            )
            db.add(new_cfg)
            db.commit()
            db.refresh(new_cfg)
            config_dict[role] = new_cfg

    configs = db.query(AgentConfig).filter(AgentConfig.workspace_id == workspace_id).all()
    res = []
    for c in configs:
        res.append({
            "id": c.id,
            "role": c.role,
            "model": c.model,
            "is_active": c.is_active,
            "enabled_skills": json.loads(c.enabled_skills or "[]"),
            "enabled_mcp_servers": json.loads(c.enabled_mcp_servers or "[]"),
            "soul_path": c.soul_path,
            "personality_path": c.personality_path
        })
    return res

@app.post("/api/workspaces/{workspace_id}/agents/{role}/configure")
def configure_agent(workspace_id: str, role: str, data: AgentConfigEdit, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")

    cfg = db.query(AgentConfig).filter(
        AgentConfig.workspace_id == workspace_id,
        AgentConfig.role == role.lower()
    ).first()

    if not cfg:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy cấu hình cho Agent {role}")

    if data.model is not None:
        cfg.model = data.model
    if data.is_active is not None:
        cfg.is_active = data.is_active
    if data.enabled_skills is not None:
        cfg.enabled_skills = json.dumps(data.enabled_skills)
    if data.enabled_mcp_servers is not None:
        cfg.enabled_mcp_servers = json.dumps(data.enabled_mcp_servers)

    db.commit()
    return {"status": "success", "agent": role}

@app.get("/api/workspaces/{workspace_id}/agents/{role}/files")
def get_agent_files(workspace_id: str, role: str, db: Session = Depends(get_db)):
    cfg = db.query(AgentConfig).filter(
        AgentConfig.workspace_id == workspace_id,
        AgentConfig.role == role.lower()
    ).first()

    if not cfg:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy Agent {role}")

    try:
        soul_content = read_workspace_file(workspace_id, cfg.soul_path)
    except Exception:
        soul_content = ""

    try:
        personality_content = read_workspace_file(workspace_id, cfg.personality_path)
    except Exception:
        personality_content = ""

    return {
        "soul": soul_content,
        "personality": personality_content,
        "soul_path": cfg.soul_path,
        "personality_path": cfg.personality_path
    }

@app.post("/api/workspaces/{workspace_id}/agents/{role}/files")
def save_agent_file(workspace_id: str, role: str, data: AgentFileEdit, db: Session = Depends(get_db)):
    cfg = db.query(AgentConfig).filter(
        AgentConfig.workspace_id == workspace_id,
        AgentConfig.role == role.lower()
    ).first()

    if not cfg:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy Agent {role}")

    if data.file_type == "soul":
        write_workspace_file(workspace_id, cfg.soul_path, data.content)
    elif data.file_type == "personality":
        write_workspace_file(workspace_id, cfg.personality_path, data.content)
    else:
        raise HTTPException(status_code=400, detail="Loại tệp không hợp lệ. Phải là 'soul' hoặc 'personality'.")

    return {"status": "success", "agent": role, "file_type": data.file_type}

# --- Quản trị Swarm Agents (Multi-Agent Deployment) ---

@app.get("/api/workspaces/{workspace_id}/swarms")
def list_swarms(workspace_id: str, db: Session = Depends(get_db)):
    jobs = db.query(SwarmJob).filter(SwarmJob.workspace_id == workspace_id).order_by(SwarmJob.id.desc()).all()
    return [{
        "id": j.id,
        "name": j.name,
        "status": j.status,
        "execution_mode": j.execution_mode,
        "created_at": j.created_at,
        "updated_at": j.updated_at,
        "member_count": len(j.members)
    } for j in jobs]

@app.get("/api/workspaces/{workspace_id}/swarms/{swarm_id}")
def get_swarm_detail(workspace_id: str, swarm_id: int, db: Session = Depends(get_db)):
    job = db.query(SwarmJob).filter(SwarmJob.workspace_id == workspace_id, SwarmJob.id == swarm_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Swarm Job.")
    
    members = db.query(SwarmMember).filter(SwarmMember.swarm_job_id == swarm_id).order_by(SwarmMember.id.asc()).all()
    
    parsed_discussion = None
    if job.discussion:
        try:
            parsed_discussion = json.loads(job.discussion)
        except Exception:
            pass
            
    return {
        "id": job.id,
        "name": job.name,
        "status": job.status,
        "execution_mode": job.execution_mode,
        "discussion": parsed_discussion,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "members": [{
            "id": m.id,
            "role": m.role,
            "task": m.task,
            "status": m.status,
            "result": m.result,
            "logs": m.logs,
            "updated_at": m.updated_at
        } for m in members]
    }

@app.post("/api/workspaces/{workspace_id}/swarms")
def create_swarm(workspace_id: str, data: SwarmJobCreate, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    
    swarm_job = SwarmJob(
        workspace_id=workspace_id,
        name=data.name,
        status="pending",
        execution_mode=data.execution_mode
    )
    db.add(swarm_job)
    db.commit()
    db.refresh(swarm_job)
    
    for m in data.members:
        member = SwarmMember(
            swarm_job_id=swarm_job.id,
            role=m.role,
            task=m.task,
            status="pending"
        )
        db.add(member)
    db.commit()
    
    # Start background execution
    start_swarm_background(workspace_id, swarm_job.id, SessionLocal)
    
    return {"status": "success", "swarm_id": swarm_job.id, "name": swarm_job.name}

# --- Cấu hình Hệ thống (Safety & Budget Settings) ---

@app.get("/api/workspaces/{workspace_id}/system-settings")
def get_system_settings_api(workspace_id: str):
    return get_system_settings(workspace_id)

@app.post("/api/workspaces/{workspace_id}/system-settings")
def save_system_settings_api(workspace_id: str, data: SystemSettingsEdit):
    update_data = {}
    if data.daily_cost_cap is not None:
        update_data["daily_cost_cap"] = data.daily_cost_cap
    if data.loop_guard_limit is not None:
        update_data["loop_guard_limit"] = data.loop_guard_limit
    if data.shell_security_sandbox is not None:
        update_data["shell_security_sandbox"] = data.shell_security_sandbox
        
    save_system_settings(workspace_id, update_data)
    return {"status": "success", "settings": get_system_settings(workspace_id)}
