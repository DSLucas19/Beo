import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, Workspace, get_db
from app.agents.base import AgentWrapper
from app.utils.file_manager import read_workspace_file, WORKSPACES_DIR
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///pytest_temp/test_beo.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db(monkeypatch, tmp_path):
    # Mock WORKSPACES_DIR to a temporary folder
    monkeypatch.setattr("app.utils.file_manager.WORKSPACES_DIR", tmp_path)
    monkeypatch.setattr("app.config.WORKSPACES_DIR", tmp_path)
    
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    yield
    # Drop all tables after test
    Base.metadata.drop_all(bind=engine)

def test_workspace_initialization_flow(monkeypatch):
    # Mock LLM call to avoid network dependencies
    def mock_call(self, messages, *args, **kwargs):
        return "# TẦM NHÌN & MỤC TIÊU: Acme Corp\n\nThis is an AI rephrased vision and goal statement."
    monkeypatch.setattr(AgentWrapper, "call", mock_call)

    # 1. Create a workspace
    create_resp = client.post("/api/workspaces", json={"id": "acme_test", "name": "Initial Name"})
    assert create_resp.status_code == 200
    assert create_resp.json()["workspace"]["id"] == "acme_test"

    # 2. Check initial status
    status_resp = client.get("/api/workspaces/acme_test/onboarding/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["workspace_name"] == "Initial Name"
    assert status_resp.json()["onboarding_completed"] is False

    # 3. Call the initialize endpoint to rename and create VISION.md
    init_payload = {
        "company_name": "Acme Corp",
        "vision_goals": "We want to build a cool widget company."
    }
    init_resp = client.post("/api/workspaces/acme_test/initialize", json=init_payload)
    assert init_resp.status_code == 200
    assert init_resp.json()["status"] == "success"
    assert init_resp.json()["workspace_name"] == "Acme Corp"
    assert "Acme Corp" in init_resp.json()["vision_md"]

    # 4. Verify workspace name in DB is updated
    status_resp = client.get("/api/workspaces/acme_test/onboarding/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["workspace_name"] == "Acme Corp"

    # 5. Verify VISION.md file contents
    file_content = read_workspace_file("acme_test", "VISION.md")
    assert "Acme Corp" in file_content
    assert "AI rephrased vision" in file_content
