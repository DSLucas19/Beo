import os
from pathlib import Path
from typing import List, Dict, Any
from app.config import WORKSPACES_DIR

def get_workspace_root(workspace_id: str) -> Path:
    """Trả về thư mục gốc của một Workspace cụ thể"""
    ws_dir = WORKSPACES_DIR / workspace_id
    ws_dir.mkdir(parents=True, exist_ok=True)
    return ws_dir

def get_workspace_files_path(workspace_id: str) -> Path:
    """Trả về thư mục dùng chung của Workspace (Tài liệu Công ty)"""
    workspace_path = get_workspace_root(workspace_id) / "workspace"
    workspace_path.mkdir(parents=True, exist_ok=True)
    return workspace_path

def get_project_files_path(workspace_id: str, project_name: str) -> Path:
    """Trả về thư mục riêng của một Dự án"""
    project_path = get_workspace_root(workspace_id) / "projects" / project_name
    project_path.mkdir(parents=True, exist_ok=True)
    # Tạo thư mục con attachments
    (project_path / "attachments").mkdir(parents=True, exist_ok=True)
    return project_path

def is_safe_path(base_dir: Path, target_path: Path) -> bool:
    """Kiểm tra đường dẫn an toàn để tránh Path Traversal"""
    try:
        resolved_base = base_dir.resolve()
        resolved_target = target_path.resolve()
        return resolved_base in resolved_target.parents or resolved_base == resolved_target
    except Exception:
        return False

def write_workspace_file(workspace_id: str, relative_file_path: str, content: str) -> Path:
    """Ghi dữ liệu vào file phẳng trong thư mục Workspace dùng chung"""
    base_dir = get_workspace_files_path(workspace_id)
    target_file = (base_dir / relative_file_path).resolve()
    
    if not is_safe_path(base_dir, target_file):
        raise PermissionError("Truy cập tệp tin ngoài vùng làm việc bị từ chối.")
        
    target_file.parent.mkdir(parents=True, exist_ok=True)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    return target_file

def read_workspace_file(workspace_id: str, relative_file_path: str) -> str:
    """Đọc dữ liệu từ file phẳng trong thư mục Workspace dùng chung"""
    base_dir = get_workspace_files_path(workspace_id)
    target_file = (base_dir / relative_file_path).resolve()
    
    if not is_safe_path(base_dir, target_file):
        raise PermissionError("Truy cập tệp tin ngoài vùng làm việc bị từ chối.")
        
    if not target_file.exists():
        raise FileNotFoundError(f"Không tìm thấy tệp {relative_file_path}")
        
    with open(target_file, "r", encoding="utf-8") as f:
        return f.read()

def list_workspace_files(workspace_id: str) -> List[Dict[str, Any]]:
    """Liệt kê các tệp tin trong thư mục dùng chung của Workspace"""
    base_dir = get_workspace_files_path(workspace_id)
    files = []
    
    # Quét đĩa cứng cục bộ trực tiếp (Disk-as-Source-of-Truth)
    for root, _, filenames in os.walk(base_dir):
        for filename in filenames:
            file_path = Path(root) / filename
            rel_path = file_path.relative_to(base_dir)
            files.append({
                "name": filename,
                "path": str(rel_path).replace("\\", "/"),
                "size": file_path.stat().st_size,
                "updated_at": file_path.stat().st_mtime
            })
    return files

def has_onboarding_specs(workspace_id: str) -> bool:
    """Kiểm tra xem Workspace đã có đủ 3 file đặc tả nền tảng chưa"""
    base_dir = get_workspace_files_path(workspace_id)
    required_files = ["AIM.md", "OPERATIONS.md", "FINANCE.md"]
    return all((base_dir / f).exists() for f in required_files)

def get_project_root(workspace_id: str, project_name: str) -> Path:
    """Trả về thư mục gốc của một Dự án"""
    project_path = get_workspace_root(workspace_id) / "projects" / project_name
    project_path.mkdir(parents=True, exist_ok=True)
    return project_path

def write_project_file(workspace_id: str, project_name: str, relative_file_path: str, content: str) -> Path:
    """Ghi dữ liệu vào file phẳng trong thư mục riêng của Dự án"""
    base_dir = get_project_root(workspace_id, project_name)
    target_file = (base_dir / relative_file_path).resolve()
    
    if not is_safe_path(base_dir, target_file):
        raise PermissionError("Truy cập tệp tin ngoài vùng làm việc bị từ chối.")
        
    target_file.parent.mkdir(parents=True, exist_ok=True)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    return target_file

def read_project_file(workspace_id: str, project_name: str, relative_file_path: str) -> str:
    """Đọc dữ liệu từ file phẳng trong thư mục riêng của Dự án"""
    base_dir = get_project_root(workspace_id, project_name)
    target_file = (base_dir / relative_file_path).resolve()
    
    if not is_safe_path(base_dir, target_file):
        raise PermissionError("Truy cập tệp tin ngoài vùng làm việc bị từ chối.")
        
    if not target_file.exists():
        raise FileNotFoundError(f"Không tìm thấy tệp {relative_file_path} trong dự án {project_name}")
        
    with open(target_file, "r", encoding="utf-8") as f:
        return f.read()

def list_project_files(workspace_id: str, project_name: str) -> List[Dict[str, Any]]:
    """Liệt kê các tệp tin trong thư mục của Dự án"""
    base_dir = get_project_root(workspace_id, project_name)
    files = []
    
    for root, _, filenames in os.walk(base_dir):
        for filename in filenames:
            file_path = Path(root) / filename
            rel_path = file_path.relative_to(base_dir)
            files.append({
                "name": filename,
                "path": str(rel_path).replace("\\", "/"),
                "size": file_path.stat().st_size,
                "updated_at": file_path.stat().st_mtime
            })
    return files

import re

def parse_active_departments(workspace_id: str) -> List[str]:
    """
    Reactive Config Watcher: Đọc OPERATIONS.md của Workspace để trích xuất danh sách các phòng ban đang hoạt động.
    """
    try:
        content = read_workspace_file(workspace_id, "OPERATIONS.md")
    except Exception:
        # Nếu chưa onboarding/chưa có file, trả về danh sách rỗng (khóa sidebar)
        return []
        
    departments = []
    mapping = {
        "planning": "dep_planning",
        "planner": "dep_planning",
        "lập kế hoạch": "dep_planning",
        
        "engineering": "dep_engineering",
        "developer": "dep_engineering",
        "kỹ thuật": "dep_engineering",
        "phát triển": "dep_engineering",
        
        "marketing": "dep_marketing",
        "truyền thông": "dep_marketing",
        "quảng cáo": "dep_marketing",
        
        "finance": "dep_finance",
        "tài chính": "dep_finance",
        "pháp lý": "dep_finance"
    }
    
    lines = content.split("\n")
    for line in lines:
        line_clean = line.strip().lower()
        if line_clean.startswith("-") or line_clean.startswith("*") or re.match(r"^\d+\.", line_clean):
            clean_name = re.sub(r"^[-*\d.\s]+", "", line_clean).strip()
            for key, val in mapping.items():
                if key in clean_name and val not in departments:
                    departments.append(val)
                    
    return departments

def get_daily_budget_limit(workspace_id: str) -> float:
    """
    Trích xuất giới hạn ngân sách hàng ngày (USD) từ tệp FINANCE.md bằng regex hoặc settings.json.
    """
    import json
    try:
        ws_root = get_workspace_root(workspace_id)
        settings_file = ws_root / "settings.json"
        if settings_file.exists():
            with open(settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "daily_cost_cap" in data:
                    return float(data["daily_cost_cap"])
    except Exception:
        pass

    try:
        content = read_workspace_file(workspace_id, "FINANCE.md")
        # Tìm kiếm các mẫu dạng $X.XX/day, $X/ngày hoặc Budget: $X
        match = re.search(r'(?:limit|budget|giới hạn|ngân sách).*?\$(\d+(?:\.\d+)?)', content, re.IGNORECASE)
        if match:
            return float(match.group(1))
    except Exception:
        pass
    return 5.00  # Ngân sách mặc định là $5.00 USD/ngày nếu không tìm thấy hoặc chưa onboarding

def get_system_settings(workspace_id: str) -> dict:
    """Đọc cấu hình hệ thống từ settings.json của Workspace"""
    import json
    ws_root = get_workspace_root(workspace_id)
    settings_file = ws_root / "settings.json"
    
    defaults = {
        "daily_cost_cap": 5.00,
        "loop_guard_limit": 5,
        "shell_security_sandbox": True
    }
    
    if settings_file.exists():
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Merge defaults
                for k, v in defaults.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            pass
            
    # Hạn mức cost_cap đồng bộ với FINANCE.md nếu có
    finance_cap = get_daily_budget_limit(workspace_id)
    defaults["daily_cost_cap"] = finance_cap
    return defaults

def save_system_settings(workspace_id: str, settings: dict):
    """Ghi cấu hình hệ thống vào settings.json và cập nhật FINANCE.md"""
    import json
    ws_root = get_workspace_root(workspace_id)
    settings_file = ws_root / "settings.json"
    
    current = get_system_settings(workspace_id)
    current.update(settings)
    
    with open(settings_file, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2, ensure_ascii=False)
        
    # Cập nhật FINANCE.md để đồng bộ daily_cost_cap
    if "daily_cost_cap" in settings:
        try:
            finance_file = get_workspace_files_path(workspace_id) / "FINANCE.md"
            if finance_file.exists():
                with open(finance_file, "r", encoding="utf-8") as f:
                    content = f.read()
                
                new_val = f"${settings['daily_cost_cap']:.2f}"
                # Tìm dòng chứa Giới hạn chi tiêu API tối đa mỗi ngày hoặc Soft cap để thay thế
                # Mẫu 1: Giới hạn chi tiêu API tối đa mỗi ngày: **$5.00**
                pattern = r'(\*\*?)\$\d+(?:\.\d+)?(\*\*?\s*\(Soft cap\))'
                content_new = re.compile(pattern).sub(rf'\1{new_val}\2', content)
                
                # Nếu không khớp mẫu trên, thử regex chung hơn
                if content_new == content:
                    pattern_generic = r'((?:limit|budget|giới hạn|ngân sách).*?\$)\d+(?:\.\d+)?'
                    content_new = re.compile(pattern_generic, re.IGNORECASE).sub(rf'\1{settings["daily_cost_cap"]:.2f}', content)
                
                with open(finance_file, "w", encoding="utf-8") as f:
                    f.write(content_new)
        except Exception as e:
            print("Failed to sync daily cost cap to FINANCE.md:", e)
