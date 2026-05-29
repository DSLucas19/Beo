from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from app.config import DATABASE_PATH

# Tạo engine SQLite
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(50), primary_key=True, index=True) # e.g. "my_first_company"
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Quan hệ
    api_keys = relationship("APIKey", back_populates="workspace", cascade="all, delete-orphan")
    approval_items = relationship("ApprovalItem", back_populates="workspace", cascade="all, delete-orphan")
    workflow_steps = relationship("WorkflowStep", back_populates="workspace", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="workspace", cascade="all, delete-orphan")
    api_cost_logs = relationship("APICostLog", back_populates="workspace", cascade="all, delete-orphan")
    mcp_servers = relationship("MCPServer", back_populates="workspace", cascade="all, delete-orphan")
    agent_configs = relationship("AgentConfig", back_populates="workspace", cascade="all, delete-orphan")
    swarm_jobs = relationship("SwarmJob", back_populates="workspace", cascade="all, delete-orphan")

class SwarmJob(Base):
    __tablename__ = "swarm_jobs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(String(20), default="pending") # "pending", "running", "completed", "failed"
    execution_mode = Column(String(30), default="sequential") # "sequential", "parallel", "collaborative"
    discussion = Column(Text, nullable=True) # Chuỗi JSON lưu trữ nội dung chat giữa các Agent (collaborative)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="swarm_jobs")
    members = relationship("SwarmMember", back_populates="swarm_job", cascade="all, delete-orphan")

class SwarmMember(Base):
    __tablename__ = "swarm_members"

    id = Column(Integer, primary_key=True, index=True)
    swarm_job_id = Column(Integer, ForeignKey("swarm_jobs.id"), nullable=False)
    role = Column(String(50), nullable=False)
    task = Column(Text, nullable=False)
    status = Column(String(20), default="pending") # "pending", "running", "completed", "failed"
    result = Column(Text, nullable=True)
    logs = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Cột Heartbeat & Nudge
    last_heartbeat = Column(DateTime, nullable=True)
    heartbeat_status = Column(String(50), nullable=True)
    nudge_count = Column(Integer, default=0)

    swarm_job = relationship("SwarmJob", back_populates="members")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    provider = Column(String(50), nullable=False) # e.g. "gemini", "openai", "anthropic"
    encrypted_key = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="api_keys")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    sender = Column(String(50), nullable=False) # "user", "secretary", "planner", etc.
    message = Column(Text, nullable=False)
    channel = Column(String(50), default="secretary")
    session_id = Column(String(100), default="default") # Cột session_id mới
    attachments = Column(Text, nullable=True) # JSON list of image/attachment paths
    timestamp = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="messages")

class ApprovalItem(Base):
    __tablename__ = "approval_queue"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    action_type = Column(String(50), nullable=False) # "write_file", "run_command", "send_email"
    proposed_content = Column(Text, nullable=False) # Nội dung chèn hoặc lệnh command
    file_path = Column(String(255), nullable=True) # Đường dẫn ghi file nếu có
    rationale = Column(Text, nullable=False) # Lý do làm hành động này
    risk_level = Column(String(20), default="LOW") # "LOW", "MEDIUM", "HIGH"
    cost_estimate = Column(String(50), default="0.00$")
    status = Column(String(20), default="pending") # "pending", "approved", "rejected"
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="approval_items")

class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    project_name = Column(String(100), nullable=True) # Tên dự án nếu thuộc dự án con
    role = Column(String(50), nullable=False) # AI Agent phụ trách
    step_name = Column(String(150), nullable=False)
    status = Column(String(20), default="pending") # "pending", "waiting_approval", "approved", "running", "completed", "failed", "rejected"
    result = Column(Text, nullable=True)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Cột Heartbeat & Nudge
    last_heartbeat = Column(DateTime, nullable=True)
    heartbeat_status = Column(String(50), nullable=True)
    nudge_count = Column(Integer, default=0)

    workspace = relationship("Workspace", back_populates="workflow_steps")

class APICostLog(Base):
    __tablename__ = "api_cost_logs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="api_cost_logs")

class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(100), nullable=False)
    url = Column(String(255), nullable=False)
    status = Column(String(20), default="connected")
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="mcp_servers")

class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(String(50), ForeignKey("workspaces.id"), nullable=False)
    role = Column(String(50), nullable=False) # e.g. "secretary", "planner", "developer", "marketer", "finance"
    name = Column(String(100), nullable=True) # Display name for custom employees
    parent_role = Column(String(50), nullable=True) # The parent C-Suite role managing this employee
    team_id = Column(String(100), nullable=True) # Custom team identifier
    is_leader = Column(Boolean, default=False) # True if this employee is the team leader
    role_type = Column(String(50), default="c_suite") # "c_suite" or "employee"
    model = Column(String(100), default="gemini/gemini-1.5-flash")
    is_active = Column(Boolean, default=True)
    enabled_skills = Column(Text, default="[]") # JSON list of skill strings e.g. ["read_file", "write_file", "run_command", "send_email"]
    enabled_mcp_servers = Column(Text, default="[]") # JSON list of mcp server names e.g. ["slack", "github"]
    soul_path = Column(String(255), nullable=True)
    personality_path = Column(String(255), nullable=True)
    moral_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="agent_configs")

def init_db():
    """Khởi tạo toàn bộ bảng dữ liệu và thực hiện di trú tự động"""
    Base.metadata.create_all(bind=engine)
    # Tự động di trú (migration) thêm cột session_id và attachments nếu chưa có
    try:
        with engine.connect() as conn:
            # Kiểm tra xem cột session_id đã tồn tại trong bảng chat_messages chưa
            result = conn.execute(text("PRAGMA table_info(chat_messages)")).fetchall()
            columns = [row[1] for row in result]
            if "session_id" not in columns:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR(100) DEFAULT 'default'"))
                conn.commit()
            if "attachments" not in columns:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN attachments TEXT NULL"))
                conn.commit()

            # Di trú bảng agent_configs cho custom employees và teams
            result_cfg = conn.execute(text("PRAGMA table_info(agent_configs)")).fetchall()
            cols_cfg = [row[1] for row in result_cfg]
            if "name" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN name VARCHAR(100) NULL"))
            if "parent_role" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN parent_role VARCHAR(50) NULL"))
            if "team_id" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN team_id VARCHAR(100) NULL"))
            if "is_leader" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN is_leader BOOLEAN DEFAULT 0"))
            if "role_type" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN role_type VARCHAR(50) DEFAULT 'c_suite'"))
            if "moral_path" not in cols_cfg:
                conn.execute(text("ALTER TABLE agent_configs ADD COLUMN moral_path VARCHAR(255) NULL"))
            
            # Di trú thêm cột Heartbeat cho workflow_steps
            result_ws = conn.execute(text("PRAGMA table_info(workflow_steps)")).fetchall()
            cols_ws = [row[1] for row in result_ws]
            if "last_heartbeat" not in cols_ws:
                conn.execute(text("ALTER TABLE workflow_steps ADD COLUMN last_heartbeat DATETIME NULL"))
            if "heartbeat_status" not in cols_ws:
                conn.execute(text("ALTER TABLE workflow_steps ADD COLUMN heartbeat_status VARCHAR(50) NULL"))
            if "nudge_count" not in cols_ws:
                conn.execute(text("ALTER TABLE workflow_steps ADD COLUMN nudge_count INTEGER DEFAULT 0"))

            # Di trú thêm cột Heartbeat cho swarm_members
            result_sm = conn.execute(text("PRAGMA table_info(swarm_members)")).fetchall()
            cols_sm = [row[1] for row in result_sm]
            if "last_heartbeat" not in cols_sm:
                conn.execute(text("ALTER TABLE swarm_members ADD COLUMN last_heartbeat DATETIME NULL"))
            if "heartbeat_status" not in cols_sm:
                conn.execute(text("ALTER TABLE swarm_members ADD COLUMN heartbeat_status VARCHAR(50) NULL"))
            if "nudge_count" not in cols_sm:
                conn.execute(text("ALTER TABLE swarm_members ADD COLUMN nudge_count INTEGER DEFAULT 0"))

            conn.commit()
    except Exception as e:
        print(f"Lỗi di trú cơ sở dữ liệu: {e}")

def get_db():
    """Dependency cung cấp session DB cho các API FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
