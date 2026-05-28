import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import WORKSPACES_DIR

# Thử import lancedb, nếu không có sẽ tự động fallback sang cơ chế lưu/truy vấn tệp phẳng đơn giản
LANCE_DB_AVAILABLE = False
try:
    import lancedb
    LANCE_DB_AVAILABLE = True
except ImportError:
    pass

class VectorMemory:
    def __init__(self, workspace_id: str):
        self.workspace_id = workspace_id
        self.db_dir = WORKSPACES_DIR / workspace_id / ".memory_db"
        self.db_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        if LANCE_DB_AVAILABLE:
            try:
                self.db = lancedb.connect(str(self.db_dir))
                # Khởi tạo bảng nếu chưa tồn tại
                if "memories" not in self.db.table_names():
                    # LanceDB tự động tạo schema từ bản ghi đầu tiên, hoặc ta tạo schema trống
                    # Để đơn giản, ta lưu trữ dạng dict và LanceDB tự suy luận schema
                    pass
            except Exception:
                # Fallback nếu LanceDB lỗi lúc kết nối
                self.db = None
        else:
            self.db = None

    def add_memory(self, text: str, metadata: Optional[Dict[str, Any]] = None):
        """Lưu trữ một đoạn thông tin vào bộ nhớ"""
        if not text.strip():
            return
        
        meta = metadata or {}
        record = {
            "text": text,
            "metadata": str(meta),
            "timestamp": os.getenv("BEO_CURRENT_TIME", "")
        }

        if LANCE_DB_AVAILABLE and self.db is not None:
            try:
                if "memories" not in self.db.table_names():
                    self.db.create_table("memories", data=[record])
                else:
                    tbl = self.db.open_table("memories")
                    tbl.add([record])
                return
            except Exception:
                # Nếu ghi lancedb lỗi, chuyển qua ghi tệp phẳng fallback bên dưới
                pass

        # Fallback: lưu vào file JSON/Text phẳng cục bộ
        fallback_file = self.db_dir / "flat_memories.txt"
        with open(fallback_file, "a", encoding="utf-8") as f:
            f.write(f"--- MEMORY ---\n")
            f.write(f"Meta: {meta}\n")
            f.write(f"Content: {text}\n")

    def search_memory(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Tìm kiếm các đoạn ký ức/ngữ cảnh tương đương gần nhất"""
        if not query.strip():
            return []

        # 1. Thử tìm kiếm bằng LanceDB
        if LANCE_DB_AVAILABLE and self.db is not None:
            try:
                if "memories" in self.db.table_names():
                    tbl = self.db.open_table("memories")
                    # Giai đoạn v1, chúng ta thực hiện Full-Text Search (FTS) hoặc tìm kiếm theo chuỗi
                    # vì ta chạy local và có thể không có API Key cho Cloud Embedding
                    df = tbl.to_pandas()
                    if not df.empty:
                        # Fallback FTS đơn giản bằng trùng khớp từ khóa (keyword search)
                        keywords = query.lower().split()
                        df["score"] = df["text"].apply(
                            lambda x: sum(1 for kw in keywords if kw in str(x).lower())
                        )
                        results = df.sort_values(by="score", ascending=False).head(limit)
                        return results.to_dict(orient="records")
            except Exception:
                pass

        # 2. Fallback tìm kiếm tệp phẳng
        fallback_file = self.db_dir / "flat_memories.txt"
        if not fallback_file.exists():
            return []

        try:
            with open(fallback_file, "r", encoding="utf-8") as f:
                content = f.read()
            
            blocks = content.split("--- MEMORY ---")
            matched_blocks = []
            keywords = query.lower().split()

            for block in blocks:
                if not block.strip():
                    continue
                score = sum(1 for kw in keywords if kw in block.lower())
                if score > 0:
                    matched_blocks.append((score, block.strip()))

            # Sắp xếp và trả về
            matched_blocks.sort(key=lambda x: x[0], reverse=True)
            return [{"text": block, "score": score} for score, block in matched_blocks[:limit]]
        except Exception:
            return []
