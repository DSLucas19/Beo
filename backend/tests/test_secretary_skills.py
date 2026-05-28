import json
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, Workspace, AgentConfig, ApprovalItem, MCPServer
from app.utils.file_manager import write_workspace_file, read_workspace_file
from app.main import (
    parse_employee_markdown,
    parse_swarm_markdown,
    parse_markdown_proposals
)

def test_parse_employee_markdown():
    markdown_content = """# Tuyển dụng Nhân sự: Chuyên viên Hỗ trợ (customer_support)
**Lý do tuyển dụng**: Hỗ trợ giải đáp thắc mắc khách hàng 24/7.
**Kỹ năng**: read_file, send_email, reply_chat
**Cổng kết nối MCP**: slack, google-calendar
**Mô hình**: gemini/gemini-2.5-flash
## SOUL
Chăm chỉ, nhã nhặn và hỗ trợ khách hàng hết mình.
## PERSONALITY
Lịch sự, ngắn gọn và luôn chào hỏi thân thiện.
"""
    parsed = parse_employee_markdown(markdown_content)
    
    assert parsed['name'] == "Chuyên viên Hỗ trợ"
    assert parsed['role'] == "customer_support"
    assert parsed['explanation'] == "Hỗ trợ giải đáp thắc mắc khách hàng 24/7."
    assert "read_file" in parsed['skills']
    assert "reply_chat" in parsed['skills']
    assert "slack" in parsed['mcp_servers']
    assert parsed['model'] == "gemini/gemini-2.5-flash"
    assert "Chăm chỉ, nhã nhặn" in parsed['soul']
    assert "Lịch sự, ngắn gọn" in parsed['personality']

def test_parse_swarm_markdown():
    markdown_content = """# Triển khai Swarm: Phân tích Kế hoạch (parallel)
**Lý do triển khai**: Phân tích dự án cà phê.
## developer
Nhiệm vụ: Viết code API prototype.
## marketer
Nhiệm vụ: Lên chiến dịch quảng bá thử nghiệm.
"""
    parsed = parse_swarm_markdown(markdown_content)
    
    assert parsed['swarm_name'] == "Phân tích Kế hoạch"
    assert parsed['execution_mode'] == "parallel"
    assert parsed['explanation'] == "Phân tích dự án cà phê."
    assert len(parsed['members']) == 2
    assert parsed['members'][0]['role'] == "developer"
    assert parsed['members'][0]['task'] == "Viết code API prototype."
    assert parsed['members'][1]['role'] == "marketer"
    assert parsed['members'][1]['task'] == "Lên chiến dịch quảng bá thử nghiệm."

def test_parse_markdown_proposals_db():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        workspace_id = "test_proposal_ws"
        ws = Workspace(id=workspace_id, name="Test Company")
        db.add(ws)
        db.commit()
        
        response_text = """Chào bạn, tôi đề xuất tuyển dụng nhân sự sau:
```markdown
# Tuyển dụng Nhân sự: Chuyên viên Devops (devops)
**Lý do tuyển dụng**: Setup CI/CD tự động.
**Kỹ năng**: read_file, run_command
**Cổng kết nối MCP**: Không
**Mô hình**: gemini/gemini-1.5-flash
## SOUL
Chuyên nghiệp, chính xác.
## PERSONALITY
Kỹ thuật cao.
```
"""
        created = parse_markdown_proposals(response_text, workspace_id, db)
        assert created is True
        
        pending_items = db.query(ApprovalItem).filter(
            ApprovalItem.workspace_id == workspace_id,
            ApprovalItem.action_type == "create_employee"
        ).all()
        
        assert len(pending_items) == 1
        item = pending_items[0]
        assert item.file_path == "devops"
        assert item.risk_level == "MEDIUM"
        assert "devops" in item.proposed_content
        
    finally:
        db.close()

def test_approve_create_employee_logic(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        workspace_id = "test_approve_ws"
        ws = Workspace(id=workspace_id, name="Test Company")
        db.add(ws)
        
        # Add default agent config to inherit model if not found
        default_agent = AgentConfig(
            workspace_id=workspace_id,
            role="secretary",
            model="gemini/gemini-1.5-flash",
            is_active=True,
            enabled_skills="[]",
            enabled_mcp_servers="[]",
            soul_path="agents/secretary/SOUL.md",
            personality_path="agents/secretary/PERSONALITY.md"
        )
        db.add(default_agent)
        db.commit()
        
        md_proposal = """# Tuyển dụng Nhân sự: Chuyên gia Pháp lý (legal_advisor)
**Lý do tuyển dụng**: Soạn thảo hợp đồng.
**Kỹ năng**: read_file, write_file
**Cổng kết nối MCP**: slack
**Mô hình**: gemini/gemini-1.5-flash
## SOUL
Cẩn thận, chính trực.
## PERSONALITY
Nghiêm túc, chính xác.
"""
        
        item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="create_employee",
            file_path="legal_advisor",
            proposed_content=md_proposal,
            rationale="Soạn thảo hợp đồng",
            risk_level="MEDIUM",
            status="pending"
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        
        # Simulate execution of approve logic
        from app.main import parse_employee_markdown
        parsed = parse_employee_markdown(item.proposed_content)
        emp_role = parsed.get('role', item.file_path or 'custom_agent')
        emp_name = parsed.get('name')
        emp_skills = parsed.get('skills')
        emp_mcp = parsed.get('mcp_servers')
        emp_model = parsed.get('model')
        emp_soul = parsed.get('soul')
        emp_personality = parsed.get('personality')
        
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
        
        # Simulate writing SOUL and PERSONALITY files
        write_workspace_file(workspace_id, f"agents/{emp_role}/SOUL.md", emp_soul)
        write_workspace_file(workspace_id, f"agents/{emp_role}/PERSONALITY.md", emp_personality)
        
        # Proactively update OPERATIONS.md
        ops_content = "# Bộ máy vận hành\n## active departments\n"
        ops_content += f"\n- {emp_name} ({emp_role})\n"
        write_workspace_file(workspace_id, "OPERATIONS.md", ops_content)
        
        db.commit()
        
        # Verify db entries
        new_cfg = db.query(AgentConfig).filter(
            AgentConfig.workspace_id == workspace_id,
            AgentConfig.role == "legal_advisor"
        ).first()
        
        assert new_cfg is not None
        assert new_cfg.model == "gemini/gemini-1.5-flash"
        assert "read_file" in json.loads(new_cfg.enabled_skills)
        assert "slack" in json.loads(new_cfg.enabled_mcp_servers)
        
        # Verify written files
        soul_text = read_workspace_file(workspace_id, "agents/legal_advisor/SOUL.md")
        assert "Cẩn thận, chính trực" in soul_text
        
        ops_text = read_workspace_file(workspace_id, "OPERATIONS.md")
        assert "Chuyên gia Pháp lý" in ops_text
        
    finally:
        db.close()
