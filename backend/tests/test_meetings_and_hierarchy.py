import pytest
import json
import threading
import time
import uuid
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, Workspace, SwarmJob, SwarmMember, ChatMessage, ApprovalItem, AgentConfig
from app.agents.swarm_runner import run_swarm
from app.main import process_and_save_approval_item, ask_agent_for_approval

def test_swarm_meeting_creation_and_suspension(monkeypatch, tmp_path):
    # Mock workspaces directory
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    # Setup DB using uniquely named file-based SQLite to avoid Windows file locks
    db_filename = f"test_meetings_db_{uuid.uuid4().hex}.db"
    db_path = tmp_path / db_filename
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_meeting_ws"
    
    try:
        # Create workspace
        ws = Workspace(id=workspace_id, name="Test Workspace")
        db.add(ws)
        db.commit()
        
        # Create swarm job
        job = SwarmJob(
            workspace_id=workspace_id,
            name="Test Swarm Blocker Job",
            status="pending",
            execution_mode="sequential"
        )
        db.add(job)
        db.commit()
        
        # Create member
        member = SwarmMember(
            swarm_job_id=job.id,
            role="coder",
            task="Write database backend logic",
            status="pending"
        )
        db.add(member)
        db.commit()
        
        job_id = job.id
        member_id = member.id
        
        # Mock LLM response proposing an emergency meeting
        mock_response = """I hit a major blocker: database locks are deadlocked.
```json
{
  "action": "create_meeting",
  "meeting_name": "Emergency Blocker: DB Deadlock",
  "meeting_type": "emergency",
  "members": ["cto", "coo"],
  "agenda": "Resolve SQLite database locks in production",
  "explanation": "Cannot proceed without CTO and COO reviewing lock architecture."
}
```
"""
        
        # We start run_swarm in a background thread and then approve the created item.
        def run_in_background():
            with patch("app.agents.swarm_runner.AgentWrapper") as MockAgentWrapper, \
                 patch("app.agents.swarm_runner.get_system_settings") as mock_settings:
                mock_instance = MagicMock()
                mock_instance.call.return_value = mock_response
                MockAgentWrapper.return_value = mock_instance
                mock_settings.return_value = {"approval_policy": "user"}  # User policy will hang until approved
                
                run_swarm(workspace_id, job_id, TestingSessionLocal)

        t = threading.Thread(target=run_in_background)
        t.start()
        
        # Wait for the thread to complete
        t.join(timeout=10)
        
        # Fetch the created ApprovalItem
        db.expire_all()
        app_item = db.query(ApprovalItem).filter(
            ApprovalItem.workspace_id == workspace_id,
            ApprovalItem.action_type == "deploy_swarm"
        ).first()
        
        assert app_item is not None
        # Meeting name is stored in proposed_content (JSON payload), explanation in rationale
        assert "Emergency Blocker" in (app_item.proposed_content or "")
        assert "Cannot proceed" in (app_item.rationale or "")
        assert app_item.status == "approved"  # Auto-approved!
        
        # Verify job and member failed due to the blocker
        db.expire_all()
        db_job = db.query(SwarmJob).filter(SwarmJob.id == job_id).first()
        db_member = db.query(SwarmMember).filter(SwarmMember.id == member_id).first()
        
        assert db_job.status == "failed"
        assert db_member.status == "failed"
        assert "Gặp bế tắc và yêu cầu họp khẩn cấp" in (db_member.result or "")
        
    finally:
        db.close()
        engine.dispose()

def test_hierarchical_approval_escalation(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    # Setup DB using uniquely named file-based SQLite
    db_filename = f"test_hierarchy_db_{uuid.uuid4().hex}.db"
    db_path = tmp_path / db_filename
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_hierarchy_ws"
    
    try:
        ws = Workspace(id=workspace_id, name="Test Hierarchy Workspace")
        db.add(ws)
        db.commit()
        
        # Setup agent hierarchy
        cfg_qa = AgentConfig(
            workspace_id=workspace_id,
            role="qa_engineer",
            name="QA Engineer 1",
            parent_role="cto",
            team_id="dev_team",
            is_leader=False,
            role_type="employee"
        )
        cfg_leader = AgentConfig(
            workspace_id=workspace_id,
            role="dev_leader",
            name="Development Leader",
            parent_role="cto",
            team_id="dev_team",
            is_leader=True,
            role_type="employee"
        )
        cfg_cto = AgentConfig(
            workspace_id=workspace_id,
            role="cto",
            name="Chief Technology Officer",
            parent_role="ceo",
            role_type="c_suite"
        )
        cfg_secretary = AgentConfig(
            workspace_id=workspace_id,
            role="secretary",
            name="Secretary Agent",
            role_type="c_suite"
        )
        db.add_all([cfg_qa, cfg_leader, cfg_cto, cfg_secretary])
        db.commit()
        
        # Create approval item proposed by qa_engineer
        item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="write_file",
            file_path="test.py",
            proposed_content="print('hello')",
            rationale="Test propose",
            risk_level="LOW",
            status="pending"
        )
        
        # We want to patch get_system_settings and AgentWrapper at its source (app.agents.base)
        with patch("app.main.get_system_settings") as mock_settings, \
             patch("app.agents.base.AgentWrapper") as MockAgentWrapper, \
             patch("app.main.execute_approved_action") as mock_exec:
            
            mock_settings.return_value = {"approval_policy": "hierarchical"}
            
            # Setup mock instances to simulate escalation by leader and approval by CTO
            mock_wrapper = MagicMock()
            
            # Dev leader escalates, CTO approves
            def mock_call(messages, role=None):
                if role == "dev_leader":
                    return '```json\n{"decision": "ESCALATE", "reason": "Not sure about database schema alignment"}\n```'
                elif role == "cto":
                    return '```json\n{"decision": "APPROVE", "reason": "Code looks clean and safe"}\n```'
                return '```json\n{"decision": "ESCALATE", "reason": "Default"}\n```'
                
            mock_wrapper.call.side_effect = mock_call
            MockAgentWrapper.return_value = mock_wrapper
            
            # Run hierarchical approval
            process_and_save_approval_item(workspace_id, item, db, proposer_role="qa_engineer")
            
            # Verify results
            assert item.status == "approved"
            # The rationale format is: "[ESCALATION_HISTORY] [APPROVER Approved: reason] original_rationale"
            assert "CTO Approved" in item.rationale
            assert "Code looks clean and safe" in item.rationale
            assert mock_exec.called
            
    finally:
        db.close()
        engine.dispose()

def test_create_meeting_with_disabled_members(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    db_filename = f"test_disabled_db_{uuid.uuid4().hex}.db"
    db_path = tmp_path / db_filename
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_disabled_ws"
    
    try:
        # Create workspace
        ws = Workspace(id=workspace_id, name="Test Disabled Workspace")
        db.add(ws)
        
        # Setup agent configs (one active secretary, one inactive coo)
        cfg_sec = AgentConfig(
            workspace_id=workspace_id,
            role="secretary",
            name="Secretary Agent",
            is_active=True
        )
        cfg_coo = AgentConfig(
            workspace_id=workspace_id,
            role="coo",
            name="COO Agent",
            is_active=False
        )
        db.add_all([cfg_sec, cfg_coo])
        db.commit()
        
        from app.agents.base import AgentWrapper
        wrapper = AgentWrapper(workspace_id, db)
        
        # Call create_meeting with inactive coo
        res = wrapper._handle_native_tool_call(
            "create_meeting",
            {
                "meeting_name": "Test Kickoff",
                "meeting_type": "regular",
                "agenda": "Kickoff",
                "members": ["coo"],
                "explanation": "Let's brainstorm"
            },
            role_name="secretary"
        )
        
        assert "Thất bại khi mở cuộc họp: Phát hiện Agent đang bị vô hiệu hóa (coo)" in res
        
        # Call create_meeting with empty members
        res_empty = wrapper._handle_native_tool_call(
            "create_meeting",
            {
                "meeting_name": "Test Kickoff",
                "meeting_type": "regular",
                "agenda": "Kickoff",
                "members": [],
                "explanation": "Let's brainstorm"
            },
            role_name="secretary"
        )
        
        assert "Phải chỉ định rõ ràng danh sách" in res_empty
        
        # Verify no ApprovalItem was created in DB
        db.expire_all()
        items = db.query(ApprovalItem).filter(ApprovalItem.workspace_id == workspace_id).all()
        assert len(items) == 0

    finally:
        db.close()
        engine.dispose()

