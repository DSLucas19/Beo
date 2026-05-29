import pytest
import json
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, Workspace, SwarmJob, SwarmMember, ChatMessage
from app.agents.swarm_runner import run_swarm
from app.utils.file_manager import read_workspace_file, list_workspace_files

def test_swarm_runner_execution(monkeypatch, tmp_path):
    # Mock workspaces directory for file manager
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    # Setup database
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_swarm_ws"
    
    try:
        # Create workspace
        ws = Workspace(id=workspace_id, name="Test Workspace")
        db.add(ws)
        db.commit()
        
        # Create swarm job
        job = SwarmJob(
            workspace_id=workspace_id,
            name="Test Swarm Job",
            status="pending"
        )
        db.add(job)
        db.commit()
        
        # Create members
        member1 = SwarmMember(
            swarm_job_id=job.id,
            role="Market Researcher",
            task="Research competitor strategies",
            status="pending"
        )
        member2 = SwarmMember(
            swarm_job_id=job.id,
            role="Slide Writer",
            task="Create slides outlining findings",
            status="pending"
        )
        db.add_all([member1, member2])
        db.commit()
        
        job_id = job.id
        member1_id = member1.id
        member2_id = member2.id
        
        # Responses to mock
        mock_response_1 = "Competitors are doing great. Here is a CSV structure."
        mock_response_2 = """Here is the presentation:
```json
{
  "action": "propose_files",
  "files": [
    {
      "name": "presentation.slide.md",
      "content": "# Slide 1\\nContent 1\\n---\\n# Slide 2\\nContent 2"
    },
    {
      "name": "data.csv",
      "content": "A,B,C\\n1,2,3\\n4,5,6"
    }
  ],
  "explanation": "Created slides and spreadsheets."
}
```
"""
        
        call_count = 0
        def mock_call(messages, role=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_response_1
            else:
                return mock_response_2
        
        # Patch AgentWrapper.call and AgentWrapper._load_api_keys and get_system_settings to avoid DB lookup and manual approval hangs
        with patch("app.agents.swarm_runner.AgentWrapper") as MockAgentWrapper, \
             patch("app.main.get_system_settings") as mock_settings:
            mock_instance = MagicMock()
            mock_instance.call.side_effect = mock_call
            MockAgentWrapper.return_value = mock_instance
            mock_settings.return_value = {"approval_policy": "auto"}
            
            # Execute run_swarm
            # We pass a lambda that returns the session to simulate db_factory
            run_swarm(workspace_id, job_id, lambda: db)
            
        # Verify job and members are updated in DB
        # Re-fetch from DB
        db.expire_all()
        db_job = db.query(SwarmJob).filter(SwarmJob.id == job_id).first()
        db_member1 = db.query(SwarmMember).filter(SwarmMember.id == member1_id).first()
        db_member2 = db.query(SwarmMember).filter(SwarmMember.id == member2_id).first()
        
        assert db_job.status == "completed"
        assert db_member1.status == "completed"
        assert db_member2.status == "completed"
        assert db_member1.result == mock_response_1
        assert db_member2.result == mock_response_2
        assert "Đã tự động ghi file" in db_member2.logs
        
        # Verify files were physically written
        written_files = list_workspace_files(workspace_id)
        file_names = [f["name"] for f in written_files]
        assert "presentation.slide.md" in file_names
        assert "data.csv" in file_names
        
        # Verify contents
        slide_content = read_workspace_file(workspace_id, "presentation.slide.md")
        assert "# Slide 1" in slide_content
        assert "Content 1" in slide_content
        
        csv_content = read_workspace_file(workspace_id, "data.csv")
        assert "A,B,C" in csv_content
        
        # Verify ChatMessages logs
        messages = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).all()
        assert len(messages) == 3
        assert messages[0].sender == "Market Researcher"
        assert messages[1].sender == "Slide Writer"
        assert messages[2].sender == "secretary"
        
        # Verify that Swarm Retrospective report was written (populated with the 3rd mock call result)
        report_content = read_workspace_file(workspace_id, f"reports/meeting_{job_id}.md")
        assert report_content == mock_response_2
        
    finally:
        db.close()


def test_swarm_parallel_execution(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    db_path = tmp_path / "test_parallel_db.db"
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_parallel_ws"
    
    try:
        ws = Workspace(id=workspace_id, name="Test Parallel Workspace")
        db.add(ws)
        db.commit()
        
        job = SwarmJob(
            workspace_id=workspace_id,
            name="Parallel Swarm Job",
            status="pending",
            execution_mode="parallel"
        )
        db.add(job)
        db.commit()
        
        member1 = SwarmMember(
            swarm_job_id=job.id,
            role="Dev Agent",
            task="Write core logic",
            status="pending"
        )
        member2 = SwarmMember(
            swarm_job_id=job.id,
            role="Marketing Agent",
            task="Write marketing content",
            status="pending"
        )
        db.add_all([member1, member2])
        db.commit()
        
        job_id = job.id
        m1_id = member1.id
        m2_id = member2.id
        
        mock_response = "Done concurrently."
        
        with patch("app.agents.swarm_runner.AgentWrapper") as MockAgentWrapper:
            mock_instance = MagicMock()
            mock_instance.call.return_value = mock_response
            MockAgentWrapper.return_value = mock_instance
            
            run_swarm(workspace_id, job_id, TestingSessionLocal)
            
        db.expire_all()
        db_job = db.query(SwarmJob).filter(SwarmJob.id == job_id).first()
        db_m1 = db.query(SwarmMember).filter(SwarmMember.id == m1_id).first()
        db_m2 = db.query(SwarmMember).filter(SwarmMember.id == m2_id).first()
        
        assert db_job.status == "completed"
        assert db_m1.status == "completed"
        assert db_m2.status == "completed"
        assert db_m1.result == mock_response
        assert db_m2.result == mock_response
        
    finally:
        db.close()


def test_swarm_collaborative_execution(monkeypatch, tmp_path):
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)

    db_path = tmp_path / "test_collab_db.db"
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    workspace_id = "test_collab_ws"
    
    try:
        ws = Workspace(id=workspace_id, name="Test Collaborative Workspace")
        db.add(ws)
        db.commit()
        
        job = SwarmJob(
            workspace_id=workspace_id,
            name="Collaborative Swarm Job",
            status="pending",
            execution_mode="collaborative"
        )
        db.add(job)
        db.commit()
        
        member1 = SwarmMember(
            swarm_job_id=job.id,
            role="Planner Agent",
            task="Discuss Cafe Strategy",
            status="pending"
        )
        member2 = SwarmMember(
            swarm_job_id=job.id,
            role="Marketer Agent",
            task="Discuss Launch Campaign",
            status="pending"
        )
        db.add_all([member1, member2])
        db.commit()
        
        job_id = job.id
        m1_id = member1.id
        m2_id = member2.id
        
        call_count = 0
        def mock_call(messages, role=None):
            nonlocal call_count
            call_count += 1
            return f"Discussion comment {call_count}."
            
        with patch("app.agents.swarm_runner.AgentWrapper") as MockAgentWrapper:
            mock_instance = MagicMock()
            mock_instance.call.side_effect = mock_call
            MockAgentWrapper.return_value = mock_instance
            
            run_swarm(workspace_id, job_id, TestingSessionLocal)
            
        db.expire_all()
        db_job = db.query(SwarmJob).filter(SwarmJob.id == job_id).first()
        db_m1 = db.query(SwarmMember).filter(SwarmMember.id == m1_id).first()
        db_m2 = db.query(SwarmMember).filter(SwarmMember.id == m2_id).first()
        
        assert db_job.status == "completed"
        assert db_m1.status == "completed"
        assert db_m2.status == "completed"
        
        # Verify discussion field has JSON transcript (2 rounds, so 2 * 2 = 4 total speaker comments)
        assert db_job.discussion is not None
        transcript = json.loads(db_job.discussion)
        assert len(transcript) == 4
        assert transcript[0]["sender"] == "Planner Agent"
        assert transcript[1]["sender"] == "Marketer Agent"
        assert transcript[2]["sender"] == "Planner Agent"
        assert transcript[3]["sender"] == "Marketer Agent"
        
        # Verify ChatMessages were created for the group channel
        # Planner and Marketer contain "planner" and "marketer", so they map to "planning_group" and "marketing_group" respectively
        # The 5th message is the automatic meeting retrospective report.
        msgs = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).order_by(ChatMessage.id.asc()).all()
        assert len(msgs) == 5
        assert msgs[0].channel == "planning_group"
        assert msgs[1].channel == "marketing_group"
        assert msgs[4].channel == "planning_group"
        
        # Verify that Swarm Retrospective report was written (populated with the 5th mock call result)
        report_content = read_workspace_file(workspace_id, f"reports/meeting_{job_id}.md")
        assert report_content == "Discussion comment 5."
        
    finally:
        db.close()
