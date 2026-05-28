import os
from pathlib import Path
from dotenv import load_dotenv

# Load các biến môi trường từ .env nếu có
load_dotenv()

# Thư mục gốc của dự án Beo
BEO_ROOT = Path(__file__).resolve().parent.parent.parent

# Thư mục chứa các Workspace
WORKSPACES_DIR_ENV = os.environ.get("BEO_WORKSPACES_DIR")
WORKSPACES_DIR = Path(WORKSPACES_DIR_ENV).resolve() if WORKSPACES_DIR_ENV else (BEO_ROOT / "workspaces")

# Tạo thư mục workspaces nếu chưa tồn tại
WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)

# Đường dẫn CSDL SQLite mặc định
DATABASE_PATH_ENV = os.environ.get("BEO_DATABASE_PATH")
DATABASE_PATH = Path(DATABASE_PATH_ENV).resolve() if DATABASE_PATH_ENV else (BEO_ROOT / "beo_data.db")

# Cấu hình LLM mặc định
DEFAULT_PROVIDER = os.environ.get("BEO_DEFAULT_PROVIDER", "gemini")
DEFAULT_MODEL = os.environ.get("BEO_DEFAULT_MODEL", "gemini/gemini-1.5-flash")
DEFAULT_TEMPERATURE = float(os.environ.get("BEO_DEFAULT_TEMPERATURE", 0.2))

# Cấu hình an toàn
MAX_CONSECUTIVE_LOOPS = 5  # Loop guard
