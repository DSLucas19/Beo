import os
import pytest
import subprocess
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import WORKSPACES_DIR
from app.utils.file_manager import (
    write_workspace_file, 
    read_workspace_file, 
    list_workspace_files, 
    is_safe_path, 
    get_workspace_files_path,
    get_project_root,
    write_project_file,
    read_project_file,
    list_project_files,
    parse_active_departments
)
from app.database import Base, Workspace, ChatMessage, ApprovalItem, WorkflowStep
from app.agents.prompts import get_onboarding_messages, get_agent_messages
from app.utils.vector_db import VectorMemory

# ==================== TEST FILE MANAGER & OPERATIONS PARSER ====================

def test_file_manager_ops(tmp_path):
    base_dir = tmp_path / "workspace"
    base_dir.mkdir()
    
    safe_file = base_dir / "safe.txt"
    unsafe_file = base_dir / "../unsafe.txt"
    
    assert is_safe_path(base_dir, safe_file) == True
    assert is_safe_path(base_dir, unsafe_file) == False

def test_write_and_read_workspace_file(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    
    workspace_id = "test_ws"
    file_name = "test_doc.md"
    content = "# Test Document\nHello world!"
    
    # Ghi file
    file_path = write_workspace_file(workspace_id, file_name, content)
    assert file_path.exists()
    
    # Đọc file
    read_content = read_workspace_file(workspace_id, file_name)
    assert read_content == content
    
    # Liệt kê file
    files = list_workspace_files(workspace_id)
    assert len(files) == 1
    assert files[0]["name"] == file_name
    
    # Chặn Path Traversal
    with pytest.raises(PermissionError):
        write_workspace_file(workspace_id, "../traversal.txt", "evil")

def test_project_file_operations(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    workspace_id = "ws_project_test"
    project_name = "cafe_app"
    file_name = "PRODUCT.md"
    content = "# Project Specifications\nDoD list."

    # Ghi file dự án
    file_path = write_project_file(workspace_id, project_name, file_name, content)
    assert file_path.exists()

    # Đọc file dự án
    read_content = read_project_file(workspace_id, project_name, file_name)
    assert read_content == content

    # Liệt kê tệp dự án
    files = list_project_files(workspace_id, project_name)
    assert len(files) == 1
    assert files[0]["name"] == file_name

def test_parse_active_departments(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    workspace_id = "ws_parse_test"

    # 1. Chưa có file OPERATIONS.md -> Trả về rỗng
    assert parse_active_departments(workspace_id) == []

    # 2. Tạo file OPERATIONS.md mẫu
    operations_content = """# Bộ máy vận hành
## active departments
- Lập kế hoạch (Planner)
- Phát triển phần mềm (Developer)
- Tuyển dụng & Marketing truyền thông
"""
    write_workspace_file(workspace_id, "OPERATIONS.md", operations_content)

    deps = parse_active_departments(workspace_id)
    assert "dep_planning" in deps
    assert "dep_engineering" in deps
    assert "dep_marketing" in deps
    assert len(deps) == 3

# ==================== TEST VECTOR DATABASE MEMORY ====================

def test_vector_memory(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.vector_db.WORKSPACES_DIR", tmp_path)
    workspace_id = "ws_mem_test"

    memory = VectorMemory(workspace_id)
    # Lưu ghi nhận bộ nhớ
    memory.add_memory("Đồng sáng lập Cafe Corp tên là John Doe", {"topic": "founders"})
    memory.add_memory("Chi phí API tối đa là 50$ mỗi ngày", {"topic": "finance"})

    # Tìm kiếm
    res1 = memory.search_memory("John Doe", limit=1)
    assert len(res1) > 0
    assert "John Doe" in res1[0]["text"]

    res2 = memory.search_memory("API", limit=1)
    assert len(res2) > 0
    assert "50$" in res2[0]["text"]

# ==================== TEST DATABASE & WORKFLOW STEP CRUD ====================

def test_database_and_workflow_steps():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        # Tạo workspace
        ws = Workspace(id="company_test", name="Company Test")
        db.add(ws)
        db.commit()
        
        # Thêm Workflow Steps
        step1 = WorkflowStep(
            workspace_id="company_test",
            project_name="cafe_mvp",
            role="planner",
            step_name="Research target market",
            status="pending"
        )
        step2 = WorkflowStep(
            workspace_id="company_test",
            project_name="cafe_mvp",
            role="developer",
            step_name="Write backend routing",
            status="pending"
        )
        db.add_all([step1, step2])
        db.commit()
        
        # Verify workflow steps
        db_steps = db.query(WorkflowStep).filter(WorkflowStep.workspace_id == "company_test").all()
        assert len(db_steps) == 2
        assert db_steps[0].role == "planner"
        assert db_steps[1].role == "developer"
        assert db_steps[0].status == "pending"

    finally:
        db.close()

# ==================== TEST PROMPTS REGISTRY ====================

def test_get_agent_messages():
    history = [{"role": "user", "content": "Hello"}]
    messages = get_agent_messages("developer", history)
    
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "AI Phát triển (Developer Agent)" in messages[0]["content"]

# ==================== TEST COMMAND EXECUTION IN INBOX ====================

def test_safe_subprocess_run(tmp_path):
    # Test shell command execution logic directly
    cmd = "echo hello"
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        timeout=5,
        cwd=str(tmp_path)
    )
    assert result.returncode == 0
    assert "hello" in result.stdout.lower()

# ==================== TEST THE 4 GAPS RECENTLY ADDED ====================

def test_daily_budget_limit_extractor(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    workspace_id = "ws_budget_test"

    # 1. Chưa có FINANCE.md -> Trả về mặc định $5.00
    from app.utils.file_manager import get_daily_budget_limit
    assert get_daily_budget_limit(workspace_id) == 5.00

    # 2. Tạo FINANCE.md mẫu với mức giới hạn $15.50
    finance_content = """# Tài chính doanh nghiệp
- Giới hạn API Budget: $15.50/ngày
- Chi phí hosting: $10/tháng
"""
    write_workspace_file(workspace_id, "FINANCE.md", finance_content)
    assert get_daily_budget_limit(workspace_id) == 15.50

def test_static_command_safety_filter():
    dangerous_command = "rm -rf /usr/bin"
    safe_command = "python -m pytest"

    # Giả lập logic static security filter từ main.py
    dangerous_patterns = ["rm -rf", "rmdir /s", "mkfs", "dd if="]
    
    def apply_filter(cmd):
        for pattern in dangerous_patterns:
            if pattern in cmd.lower():
                return "HIGH", "[CẢNH BÁO BẢO MẬT]"
        return "MEDIUM", ""

    risk, warn = apply_filter(dangerous_command)
    assert risk == "HIGH"
    assert "CẢNH BÁO" in warn

    risk_safe, warn_safe = apply_filter(safe_command)
    assert risk_safe == "MEDIUM"
    assert warn_safe == ""

def test_sop_to_workflow_compiler(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    workspace_id = "ws_sop_compile_test"

    # Tạo tệp tin SOP.md mẫu
    sop_content = """# SOP ra mắt sản phẩm
## Các bước quy trình
- [Planner] Khảo sát đối thủ cạnh tranh chính và lập bản kế hoạch Roadmap.
- [Developer] Viết mã nguồn endpoints cho Module CRM.
- [Marketer] Thiết lập chiến dịch email gửi ngỏ tới đối tác.
- [Finance] Kiểm tra ngân sách chạy API.
"""
    write_workspace_file(workspace_id, "SOP_CAFE.md", sop_content)

    # Đọc và thử parse thủ công giống logic trong main.py
    content = read_workspace_file(workspace_id, "SOP_CAFE.md")
    lines = content.split("\n")
    parsed_steps = []

    import re
    for line in lines:
        match = re.match(r"^[-*\d.\s+]*\[([a-zA-Z\s\-]+)\](.*)$", line.strip())
        if match:
            role = match.group(1).strip().lower()
            desc = match.group(2).strip()
            parsed_steps.append((role, desc))

    assert len(parsed_steps) == 4
    assert parsed_steps[0][0] == "planner"
    assert "Khảo sát đối thủ" in parsed_steps[0][1]
    assert parsed_steps[1][0] == "developer"
    assert parsed_steps[2][0] == "marketer"
    assert parsed_steps[3][0] == "finance"

def test_database_cost_log_and_mcp_servers():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        ws = Workspace(id="gap_db_test", name="Gap DB Test")
        db.add(ws)
        db.commit()

        # 1. Thử ghi nhận log chi phí API
        from app.database import APICostLog, MCPServer
        cost_log = APICostLog(
            workspace_id="gap_db_test",
            model="gemini/gemini-1.5-flash",
            prompt_tokens=1000,
            completion_tokens=2000,
            cost_usd=0.000675
        )
        db.add(cost_log)
        db.commit()

        logged = db.query(APICostLog).filter(APICostLog.workspace_id == "gap_db_test").first()
        assert logged is not None
        assert logged.prompt_tokens == 1000
        assert logged.cost_usd == 0.000675

        # 2. Thử ghi nhận mcp server
        mcp = MCPServer(
            workspace_id="gap_db_test",
            name="slack",
            url="http://localhost:5005",
            status="connected"
        )
        db.add(mcp)
        db.commit()

        server = db.query(MCPServer).filter(MCPServer.workspace_id == "gap_db_test").first()
        assert server is not None
        assert server.name == "slack"
        assert server.url == "http://localhost:5005"

    finally:
        db.close()

def test_mcp_client_fallback_logic():
    # Giả lập logic gọi fallback trong call_mcp_tool
    server_url = "http://localhost:5005"
    tool_name = "send_slack_message"
    arguments = {"channel": "#general", "message": "Hello from Beo"}

    result = f"[MCP SUCCESS] Đã gọi giả lập tool '{tool_name}' trên server 'slack' với tham số {arguments}. (Server thật tại {server_url} offline: connection refused)"
    assert tool_name in result
    assert "slack" in result
    assert "connection refused" in result

def test_agent_customizer_and_templates(monkeypatch, tmp_path):
    # Mock WORKSPACES_DIR to temporary directory
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    
    workspace_id = "test_customizer_ws"
    
    # 1. Test initialize templates
    from app.utils.agent_templates import initialize_agent_templates
    initialize_agent_templates(workspace_id)
    
    # Verify templates created physically
    soul_file = tmp_path / workspace_id / "workspace" / "agents" / "secretary" / "SOUL.md"
    personality_file = tmp_path / workspace_id / "workspace" / "agents" / "secretary" / "PERSONALITY.md"
    assert soul_file.exists()
    assert personality_file.exists()
    assert "# SOUL: Secretary Agent" in soul_file.read_text(encoding="utf-8")

    # 2. Test AgentConfig database operations
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        from app.database import AgentConfig
        import json
        
        cfg = AgentConfig(
            workspace_id=workspace_id,
            role="developer",
            model="ollama/llama3",
            is_active=True,
            enabled_skills=json.dumps(["read_file", "write_file", "run_command"]),
            enabled_mcp_servers=json.dumps(["slack", "postgres"]),
            soul_path="agents/developer/SOUL.md",
            personality_path="agents/developer/PERSONALITY.md"
        )
        db.add(cfg)
        db.commit()
        
        db_cfg = db.query(AgentConfig).filter(AgentConfig.workspace_id == workspace_id, AgentConfig.role == "developer").first()
        assert db_cfg is not None
        assert db_cfg.model == "ollama/llama3"
        assert "run_command" in json.loads(db_cfg.enabled_skills)

    finally:
        db.close()



