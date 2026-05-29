import os
from typing import List, Dict, Any, Optional
import litellm
from sqlalchemy.orm import Session
from app.database import APIKey
from app.security import decrypt_key
from app.config import DEFAULT_MODEL, DEFAULT_TEMPERATURE

# Tắt hiển thị prompt và log chi tiết không cần thiết của litellm
litellm.telemetry = False
litellm.drop_params = True


def parse_attachments_to_multimodal_content(workspace_id: str, content_text: str, attachments_json: str) -> Any:
    import json
    import base64
    from pathlib import Path
    from app.config import WORKSPACES_DIR
    
    content = [{"type": "text", "text": content_text}]
    try:
        if not attachments_json:
            return content_text
            
        file_paths = json.loads(attachments_json)
        if not file_paths or not isinstance(file_paths, list):
            return content_text
            
        for path_str in file_paths:
            if path_str.startswith("/attachments/"):
                rel_parts = path_str.replace("/attachments/", "", 1)
                disk_path = WORKSPACES_DIR / rel_parts
                if disk_path.exists() and disk_path.is_file():
                    mime_type = "image/jpeg"
                    if disk_path.suffix.lower() == ".png":
                        mime_type = "image/png"
                    elif disk_path.suffix.lower() == ".gif":
                        mime_type = "image/gif"
                    elif disk_path.suffix.lower() in [".webp"]:
                        mime_type = "image/webp"
                        
                    with open(disk_path, "rb") as image_file:
                        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                        
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{encoded_string}"
                        }
                    })
        if len(content) > 1:
            return content
    except Exception as e:
        print("Error parsing attachments for vision prompt:", e)
        
    return content_text


AGENT_NATIVE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Đề xuất tạo hoặc ghi file phẳng trong thư mục Workspace. Gửi vào Approval Queue của User.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Đường dẫn file (ví dụ: AIM.md, src/main.py, etc.)"
                    },
                    "content": {
                        "type": "string",
                        "description": "Nội dung đầy đủ để ghi vào file."
                    },
                    "rationale": {
                        "type": "string",
                        "description": "Giải thích lý do ghi file này."
                    }
                },
                "required": ["file_path", "content", "rationale"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Đề xuất thực thi lệnh shell trên máy local của người dùng. Luôn gửi vào Approval Queue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Lệnh shell cần chạy (ví dụ: pytest, npm run build, etc.)"
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Giải thích lý do cần chạy lệnh này."
                    },
                    "risk_level": {
                        "type": "string",
                        "enum": ["LOW", "MEDIUM", "HIGH"],
                        "description": "Đánh giá mức độ rủi ro của lệnh."
                    }
                },
                "required": ["command", "explanation", "risk_level"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Đề xuất gửi email báo cáo hoặc email quảng bá. Luôn gửi vào Approval Queue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient": {
                        "type": "string",
                        "description": "Địa chỉ email người nhận."
                    },
                    "subject": {
                        "type": "string",
                        "description": "Tiêu đề email."
                    },
                    "body": {
                        "type": "string",
                        "description": "Nội dung email."
                    }
                },
                "required": ["recipient", "subject", "body"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "deploy_swarm",
            "description": "Đề xuất kích hoạt một nhóm Swarm Agents để giải quyết tác vụ phức tạp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "swarm_name": {
                        "type": "string",
                        "description": "Tên mô tả ngắn của Swarm."
                    },
                    "execution_mode": {
                        "type": "string",
                        "enum": ["sequential", "parallel", "collaborative"],
                        "description": "Chế độ chạy: sequential (tuần tự), parallel (song song), collaborative (thảo luận)."
                    },
                    "members": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {
                                    "type": "string",
                                    "description": "Vai trò của agent con (ví dụ: coder, tester, copywriter, bookkeeper, pm_coordinator...)"
                                },
                                "task": {
                                    "type": "string",
                                    "description": "Nhiệm vụ cụ thể giao cho agent này."
                                }
                            },
                            "required": ["role", "task"]
                        },
                        "description": "Danh sách các agent thành viên tham gia Swarm."
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Giải thích lý do deploy Swarm và chọn execution_mode."
                    }
                },
                "required": ["swarm_name", "execution_mode", "members", "explanation"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_meeting",
            "description": "Đề xuất mở một cuộc họp khẩn cấp hoặc cuộc họp thảo luận giữa các ban ngành khi gặp bế tắc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_name": {
                        "type": "string",
                        "description": "Tên chủ đề cuộc họp."
                    },
                    "meeting_type": {
                        "type": "string",
                        "enum": ["emergency", "regular"],
                        "description": "Mức độ khẩn cấp."
                    },
                    "agenda": {
                        "type": "string",
                        "description": "Chương trình/Nội dung bế tắc cần tháo gỡ."
                    },
                    "members": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "BẮT BUỘC: Danh sách chi tiết các vai trò (role) được triệu tập họp (ví dụ: cto, cmo, cfo...). Không được để trống. Chỉ được mời các Agent đang hoạt động."
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Lý do triệu tập cuộc họp."
                    }
                },
                "required": ["meeting_name", "meeting_type", "agenda", "members", "explanation"]
            }
        }
    }
]


def update_agent_heartbeat(workspace_id: str, role: str, db: Session):
    try:
        from app.database import WorkflowStep, SwarmMember, SwarmJob
        from datetime import datetime
        from sqlalchemy import func
        if not role:
            return
            
        # 1. Cập nhật WorkflowStep đang chạy của role này
        step = db.query(WorkflowStep).filter(
            WorkflowStep.workspace_id == workspace_id,
            func.lower(WorkflowStep.role) == role.lower(),
            WorkflowStep.status == "running"
        ).first()
        if step:
            step.last_heartbeat = datetime.utcnow()
            step.heartbeat_status = "healthy"
            step.nudge_count = 0
            db.commit()
            
        # 2. Cập nhật SwarmMember đang chạy
        members = db.query(SwarmMember).join(SwarmJob).filter(
            SwarmJob.workspace_id == workspace_id,
            func.lower(SwarmMember.role).contains(role.lower()),
            SwarmMember.status == "running"
        ).all()
        for m in members:
            m.last_heartbeat = datetime.utcnow()
            m.heartbeat_status = "healthy"
            m.nudge_count = 0
            db.commit()
    except Exception as e:
        print("Lỗi update heartbeat:", e)

class AgentWrapper:
    def __init__(self, workspace_id: str, db: Session):
        self.workspace_id = workspace_id
        self.db = db
        self._load_api_keys()

    def _load_api_keys(self):
        """Tải và giải mã toàn bộ API Keys lưu trong database cho Workspace này"""
        import json
        self.api_keys: Dict[str, str] = {}
        self.api_bases: Dict[str, str] = {}
        self.api_models: Dict[str, str] = {}
        keys = self.db.query(APIKey).filter(APIKey.workspace_id == self.workspace_id).all()
        for k in keys:
            try:
                decrypted = decrypt_key(k.encrypted_key)
                try:
                    data = json.loads(decrypted)
                    self.api_keys[k.provider.lower()] = data.get("key", "")
                    if data.get("url"):
                        self.api_bases[k.provider.lower()] = data.get("url")
                    if data.get("model"):
                        self.api_models[k.provider.lower()] = data.get("model")
                except Exception:
                    self.api_keys[k.provider.lower()] = decrypted
            except Exception:
                # Bỏ qua nếu lỗi giải mã để tránh treo khởi động
                pass

    def _inject_env_keys(self):
        """Gắn tạm thời API keys vào os.environ để litellm sử dụng"""
        for provider, api_key in self.api_keys.items():
            if provider == "gemini":
                os.environ["GEMINI_API_KEY"] = api_key
            elif provider == "openai":
                os.environ["OPENAI_API_KEY"] = api_key
            elif provider == "anthropic":
                os.environ["ANTHROPIC_API_KEY"] = api_key
            elif provider == "cohere":
                os.environ["COHERE_API_KEY"] = api_key
            elif provider == "groq":
                os.environ["GROQ_API_KEY"] = api_key
            elif provider == "openrouter":
                os.environ["OPENROUTER_API_KEY"] = api_key
                os.environ["OR_API_KEY"] = api_key
            elif provider == "mimo":
                os.environ["MIMO_API_KEY"] = api_key
            elif provider in ["cliproxyapi", "cliproxy"]:
                os.environ["CLIPROXY_API_KEY"] = api_key
            elif provider == "custom":
                # Custom endpoints use api_base from self.api_bases
                os.environ["CUSTOM_API_KEY"] = api_key

    def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        response_format: Optional[Any] = None,
        role: Optional[str] = None
    ) -> str:
        """Giao tiếp với LLM thông qua litellm, tự động kiểm soát chi phí & ghi nhận log"""
        from app.database import APICostLog
        from app.utils.file_manager import get_daily_budget_limit, read_workspace_file
        from sqlalchemy import func
        from datetime import datetime, date
        import json

        # --- DYNAMIC AGENT CONFIGURATION & PROMPT INJECTION ---
        agent_model = model
        soul_content = ""
        personality_content = ""
        moral_content = ""
        skills_str = ""
        mcp_servers_str = ""

        if role:
            from app.database import AgentConfig
            cfg = self.db.query(AgentConfig).filter(
                AgentConfig.workspace_id == self.workspace_id,
                AgentConfig.role == role.lower()
            ).first()

            if cfg:
                if not cfg.is_active:
                    raise RuntimeError(f"Agent {role} đã bị vô hiệu hóa trong cấu hình.")
                
                # Cấu hình model động
                if not model:
                    agent_model = cfg.model

                # Đọc SOUL & PERSONALITY từ tệp tin cục bộ
                try:
                    soul_content = read_workspace_file(self.workspace_id, cfg.soul_path)
                except Exception:
                    pass
                try:
                    personality_content = read_workspace_file(self.workspace_id, cfg.personality_path)
                except Exception:
                    pass
                try:
                    moral_content = read_workspace_file(self.workspace_id, cfg.moral_path or f"agents/{role.lower()}/MORAL.md")
                except Exception:
                    pass

                # Kỹ năng hoạt động
                enabled_skills = json.loads(cfg.enabled_skills or "[]")
                skills_str = ", ".join(enabled_skills)

                # MCP Servers hoạt động
                enabled_mcp = json.loads(cfg.enabled_mcp_servers or "[]")
                mcp_servers_str = ", ".join(enabled_mcp)

        target_model = agent_model or DEFAULT_MODEL
        
        # Resolve custom model name if provider is custom
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        if (provider_name == "custom" or target_model == "custom") and self.api_models.get("custom"):
            custom_model = self.api_models.get("custom")
            if not custom_model.startswith("custom/"):
                target_model = f"custom/{custom_model}"
            else:
                target_model = custom_model

        target_temp = temperature if temperature is not None else DEFAULT_TEMPERATURE

        # Trigger simulation for testing heartbeat timeouts
        if role and any(keyword in (messages[-1]["content"] if messages else "").lower() 
                        for keyword in ["test_freeze", "test_hang", "giả lập treo"]):
            import time
            time.sleep(60) # Block the thread to trigger heartbeat checker watchdog
            
        # Update agent heartbeat at the start of call
        if role:
            update_agent_heartbeat(self.workspace_id, role, self.db)

        # --- BUDGET CHECK (Gap 1) ---
        try:
            today_start = datetime.combine(date.today(), datetime.min.time())
            total_spent = self.db.query(func.sum(APICostLog.cost_usd)).filter(
                APICostLog.workspace_id == self.workspace_id,
                APICostLog.created_at >= today_start
            ).scalar() or 0.0

            budget_limit = get_daily_budget_limit(self.workspace_id)
            if total_spent >= budget_limit:
                raise RuntimeError(
                    f"Giới hạn ngân sách API hàng ngày đã vượt quá hạn mức thiết lập (${budget_limit:.2f} USD). "
                    f"Hiện tại đã tiêu thụ: ${total_spent:.4f} USD. Cuộc gọi LLM bị ngăn chặn để bảo vệ tài chính của bạn."
                )
        except Exception as budget_err:
            if "Giới hạn ngân sách API" in str(budget_err):
                raise budget_err

        self._inject_env_keys()
        
        # Tạo bản sao tin nhắn để inject ngữ cảnh cấu hình động
        injected_messages = []
        for m in messages:
            m_copy = dict(m)
            if "attachments" in m_copy and m_copy["attachments"]:
                m_copy["content"] = parse_attachments_to_multimodal_content(self.workspace_id, m_copy.get("content", ""), m_copy.pop("attachments"))
            injected_messages.append(m_copy)
        if injected_messages and injected_messages[0]["role"] == "system":
            sys_msg = injected_messages[0]["content"]
            extra = []
            
            # Query active/disabled agents
            active_agents = []
            disabled_agents = []
            try:
                from app.database import AgentConfig
                all_agents = self.db.query(AgentConfig).filter(AgentConfig.workspace_id == self.workspace_id).all()
                for a in all_agents:
                    if a.is_active:
                        active_agents.append(a.role)
                    else:
                        disabled_agents.append(a.role)
            except Exception:
                pass

            if active_agents or disabled_agents:
                status_info = "### [TÌNH TRẠNG HOẠT ĐỘNG CỦA CÁC AGENT TRONG DOANH NGHIỆP]\n"
                status_info += f"- ĐANG HOẠT ĐỘNG (ACTIVE): {', '.join(active_agents)}\n"
                if disabled_agents:
                    status_info += f"- ĐÃ BỊ VÔ HIỆU HÓA (DISABLED): {', '.join(disabled_agents)}\n"
                    status_info += "LƯU Ý QUAN TRỌNG: Bạn chỉ được mời hoặc triệu tập (create_meeting, deploy_swarm) các Agent ĐANG HOẠT ĐỘNG. Không mời hoặc giao nhiệm vụ cho các Agent đã bị vô hiệu hóa. Nếu cần thiết, hãy yêu cầu người dùng kích hoạt họ trong Settings trước."
                extra.append(status_info)

            if soul_content:
                extra.append(f"### [SOUL & CORE VALUES]\n{soul_content}")
            if personality_content:
                extra.append(f"### [PERSONALITY & STYLE]\n{personality_content}")
            if moral_content:
                extra.append(f"### [MORAL & ETHICAL RESPONSIBILITIES]\n{moral_content}")
            if skills_str:
                extra.append(f"### [ALLOWED SKILLS / CAPABILITIES]\nYou are strictly limited to using these skills: {skills_str}.\nIf you need to perform an action not in this list, you MUST ask the user to configure your skills in settings.")
            if mcp_servers_str:
                extra.append(f"### [ACTIVE MCP INTEGRATIONS]\nYou are connected to these MCP servers: {mcp_servers_str}.\nYou may propose calling tools from these servers using standard proposal syntax.")
            
            # Global Activity Overview for Secretary
            if role and role.lower() == "secretary":
                try:
                    from app.database import ChatMessage
                    other_msgs = self.db.query(ChatMessage).filter(
                        ChatMessage.workspace_id == self.workspace_id,
                        ChatMessage.channel != "secretary"
                    ).order_by(ChatMessage.id.desc()).limit(20).all()
                    
                    if other_msgs:
                        overview = "\n\n### [BẢN TIN HOẠT ĐỘNG CỦA CÁC BAN NGÀNH (GLOBAL OVERVIEW)]\n"
                        overview += "Dưới đây là các cuộc trò chuyện gần đây nhất của các phòng ban khác trong công ty để bạn theo dõi và điều phối:\n"
                        for m in reversed(other_msgs):
                            overview += f"- [{m.timestamp.strftime('%H:%M:%S')}] [{m.channel.upper()}] {m.sender.upper()}: {m.message[:180]}\n"
                        extra.append(overview)
                except Exception as e:
                    print("Error getting global timeline for secretary:", e)
            
            if extra:
                injected_messages[0]["content"] = sys_msg + "\n\n" + "\n\n".join(extra)

        # Cấu hình tham số gọi
        kwargs: Dict[str, Any] = {
            "model": target_model,
            "messages": injected_messages,
            "temperature": target_temp,
        }
        
        # Inject native tools if not Ollama
        is_ollama = "ollama" in target_model.lower()
        if not is_ollama:
            kwargs["tools"] = AGENT_NATIVE_TOOLS
            kwargs["tool_choice"] = "auto"

        # Cấu hình Custom API Base / CLIProxyAPI / OpenRouter nếu nhà cung cấp tương ứng có đăng ký URL
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        
        is_custom_or_proxy = False
        if provider_name in ["custom", "cliproxyapi", "cliproxy", "mimo"]:
            kwargs["api_base"] = self.api_bases.get(provider_name) or ("https://api.xiaomimimo.com/v1" if provider_name == "mimo" else None)
            kwargs["api_key"] = self.api_keys.get(provider_name)
            is_custom_or_proxy = True
        elif provider_name in self.api_bases:
            kwargs["api_base"] = self.api_bases[provider_name]
            kwargs["api_key"] = self.api_keys[provider_name]
        elif "openrouter" in self.api_keys and provider_name == "openrouter":
            kwargs["api_base"] = self.api_bases.get("openrouter") or "https://openrouter.ai/api/v1"
            kwargs["api_key"] = self.api_keys.get("openrouter")
        elif "custom" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("custom")
            kwargs["api_key"] = self.api_keys.get("custom")
            is_custom_or_proxy = True
        elif "cliproxyapi" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("cliproxyapi") or "http://localhost:8317/v1"
            kwargs["api_key"] = self.api_keys.get("cliproxyapi")
            is_custom_or_proxy = True
        elif "cliproxy" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("cliproxy") or "http://localhost:8317/v1"
            kwargs["api_key"] = self.api_keys.get("cliproxy")
            is_custom_or_proxy = True

        if is_custom_or_proxy:
            # Ép litellm sử dụng cổng OpenAI bằng cách thêm prefix openai/
            if not target_model.startswith("openai/"):
                # Chỉ cắt bỏ phần provider prefix đầu tiên (như custom/ hoặc cliproxyapi/), giữ nguyên phần còn lại của tên model
                # Ví dụ: custom/anthropic/claude-3-opus -> anthropic/claude-3-opus
                if "/" in target_model:
                    clean_model = target_model[target_model.find("/")+1:]
                else:
                    clean_model = target_model
                kwargs["model"] = f"openai/{clean_model}"

        if response_format:
            kwargs["response_format"] = response_format

        try:
            response = litellm.completion(**kwargs)
            message_obj = response.choices[0].message
            if hasattr(message_obj, "tool_calls") and message_obj.tool_calls:
                tool_results = []
                for tool_call in message_obj.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args_str = tool_call.function.arguments
                    try:
                        tool_args = json.loads(tool_args_str)
                    except Exception:
                        tool_args = {}
                    
                    result = self._handle_native_tool_call(tool_name, tool_args, role)
                    tool_results.append(result)
                content = "\n\n".join(tool_results)
            else:
                content = message_obj.content or ""
            
            # --- COST CALCULATION & RECORDING (Gap 1) ---
            try:
                usage = response.get("usage", {})
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                
                # Tính giá ước tính (USD / 1M tokens)
                input_price_per_1m = 0.075 # flash default
                output_price_per_1m = 0.30
                if "gpt-4" in target_model:
                    input_price_per_1m = 5.00
                    output_price_per_1m = 15.00
                elif "claude-3-5" in target_model:
                    input_price_per_1m = 3.00
                    output_price_per_1m = 15.00
                elif "ollama" in target_model:
                    input_price_per_1m = 0.00
                    output_price_per_1m = 0.00

                calculated_cost = (
                    (prompt_tokens * (input_price_per_1m / 1000000.0)) + 
                    (completion_tokens * (output_price_per_1m / 1000000.0))
                )

                cost_log = APICostLog(
                    workspace_id=self.workspace_id,
                    model=target_model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost_usd=calculated_cost
                )
                self.db.add(cost_log)
                self.db.commit()
            except Exception:
                pass # Chống crash gọi chính khi log lỗi

            return content
        except Exception as e:
            # Nếu gặp lỗi với model đám mây, thử fallback sang Local Ollama nếu được bật
            if "ollama" in target_model:
                raise e
            
            try:
                kwargs["model"] = "ollama/llama3"
                response = litellm.completion(**kwargs)
                return response.choices[0].message.content or ""
            except Exception:
                raise RuntimeError(f"Lỗi gọi LLM API ({target_model}): {str(e)}")

    def call_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        response_format: Optional[Any] = None,
        role: Optional[str] = None
    ):
        """Giao tiếp với LLM dạng streaming thông qua litellm, tự động kiểm soát chi phí & ghi nhận log"""
        from app.database import APICostLog
        from app.utils.file_manager import get_daily_budget_limit, read_workspace_file
        from sqlalchemy import func
        from datetime import datetime, date
        import json

        # --- DYNAMIC AGENT CONFIGURATION & PROMPT INJECTION ---
        agent_model = model
        soul_content = ""
        personality_content = ""
        moral_content = ""
        skills_str = ""
        mcp_servers_str = ""

        if role:
            from app.database import AgentConfig
            cfg = self.db.query(AgentConfig).filter(
                AgentConfig.workspace_id == self.workspace_id,
                AgentConfig.role == role.lower()
            ).first()

            if cfg:
                if not cfg.is_active:
                    raise RuntimeError(f"Agent {role} đã bị vô hiệu hóa trong cấu hình.")
                
                # Cấu hình model động
                if not model:
                    agent_model = cfg.model

                # Đọc SOUL & PERSONALITY từ tệp tin cục bộ
                try:
                    soul_content = read_workspace_file(self.workspace_id, cfg.soul_path)
                except Exception:
                    pass
                try:
                    personality_content = read_workspace_file(self.workspace_id, cfg.personality_path)
                except Exception:
                    pass
                try:
                    moral_content = read_workspace_file(self.workspace_id, cfg.moral_path or f"agents/{role.lower()}/MORAL.md")
                except Exception:
                    pass

                # Kỹ năng hoạt động
                enabled_skills = json.loads(cfg.enabled_skills or "[]")
                skills_str = ", ".join(enabled_skills)

                # MCP Servers hoạt động
                enabled_mcp = json.loads(cfg.enabled_mcp_servers or "[]")
                mcp_servers_str = ", ".join(enabled_mcp)

        target_model = agent_model or DEFAULT_MODEL
        
        # Resolve custom model name if provider is custom
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        if (provider_name == "custom" or target_model == "custom") and self.api_models.get("custom"):
            custom_model = self.api_models.get("custom")
            if not custom_model.startswith("custom/"):
                target_model = f"custom/{custom_model}"
            else:
                target_model = custom_model

        target_temp = temperature if temperature is not None else DEFAULT_TEMPERATURE

        # Trigger simulation for testing heartbeat timeouts
        if role and any(keyword in (messages[-1]["content"] if messages else "").lower() 
                        for keyword in ["test_freeze", "test_hang", "giả lập treo"]):
            import time
            time.sleep(60) # Block the thread to trigger heartbeat checker watchdog
            
        # Update agent heartbeat at the start of call_stream
        if role:
            update_agent_heartbeat(self.workspace_id, role, self.db)

        # --- BUDGET CHECK (Gap 1) ---
        try:
            today_start = datetime.combine(date.today(), datetime.min.time())
            total_spent = self.db.query(func.sum(APICostLog.cost_usd)).filter(
                APICostLog.workspace_id == self.workspace_id,
                APICostLog.created_at >= today_start
            ).scalar() or 0.0

            budget_limit = get_daily_budget_limit(self.workspace_id)
            if total_spent >= budget_limit:
                raise RuntimeError(
                    f"Giới hạn ngân sách API hàng ngày đã vượt quá hạn mức thiết lập (${budget_limit:.2f} USD). "
                    f"Hiện tại đã tiêu thụ: ${total_spent:.4f} USD. Cuộc gọi LLM bị ngăn chặn để bảo vệ tài chính của bạn."
                )
        except Exception as budget_err:
            if "Giới hạn ngân sách API" in str(budget_err):
                raise budget_err

        self._inject_env_keys()
        
        # Tạo bản sao tin nhắn để inject ngữ cảnh cấu hình động
        injected_messages = []
        for m in messages:
            m_copy = dict(m)
            if "attachments" in m_copy and m_copy["attachments"]:
                m_copy["content"] = parse_attachments_to_multimodal_content(self.workspace_id, m_copy.get("content", ""), m_copy.pop("attachments"))
            injected_messages.append(m_copy)
        if injected_messages and injected_messages[0]["role"] == "system":
            sys_msg = injected_messages[0]["content"]
            extra = []
            
            # Query active/disabled agents
            active_agents = []
            disabled_agents = []
            try:
                from app.database import AgentConfig
                all_agents = self.db.query(AgentConfig).filter(AgentConfig.workspace_id == self.workspace_id).all()
                for a in all_agents:
                    if a.is_active:
                        active_agents.append(a.role)
                    else:
                        disabled_agents.append(a.role)
            except Exception:
                pass

            if active_agents or disabled_agents:
                status_info = "### [TÌNH TRẠNG HOẠT ĐỘNG CỦA CÁC AGENT TRONG DOANH NGHIỆP]\n"
                status_info += f"- ĐANG HOẠT ĐỘNG (ACTIVE): {', '.join(active_agents)}\n"
                if disabled_agents:
                    status_info += f"- ĐÃ BỊ VÔ HIỆU HÓA (DISABLED): {', '.join(disabled_agents)}\n"
                    status_info += "LƯU Ý QUAN TRỌNG: Bạn chỉ được mời hoặc triệu tập (create_meeting, deploy_swarm) các Agent ĐANG HOẠT ĐỘNG. Không mời hoặc giao nhiệm vụ cho các Agent đã bị vô hiệu hóa. Nếu cần thiết, hãy yêu cầu người dùng kích hoạt họ trong Settings trước."
                extra.append(status_info)

            if soul_content:
                extra.append(f"### [SOUL & CORE VALUES]\n{soul_content}")
            if personality_content:
                extra.append(f"### [PERSONALITY & STYLE]\n{personality_content}")
            if moral_content:
                extra.append(f"### [MORAL & ETHICAL RESPONSIBILITIES]\n{moral_content}")
            if skills_str:
                extra.append(f"### [ALLOWED SKILLS / CAPABILITIES]\nYou are strictly limited to using these skills: {skills_str}.\nIf you need to perform an action not in this list, you MUST ask the user to configure your skills in settings.")
            if mcp_servers_str:
                extra.append(f"### [ACTIVE MCP INTEGRATIONS]\nYou are connected to these MCP servers: {mcp_servers_str}.\nYou may propose calling tools from these servers using standard proposal syntax.")
            
            # Global Activity Overview for Secretary
            if role and role.lower() == "secretary":
                try:
                    from app.database import ChatMessage
                    other_msgs = self.db.query(ChatMessage).filter(
                        ChatMessage.workspace_id == self.workspace_id,
                        ChatMessage.channel != "secretary"
                    ).order_by(ChatMessage.id.desc()).limit(20).all()
                    
                    if other_msgs:
                        overview = "\n\n### [BẢN TIN HOẠT ĐỘNG CỦA CÁC BAN NGÀNH (GLOBAL OVERVIEW)]\n"
                        overview += "Dưới đây là các cuộc trò chuyện gần đây nhất của các phòng ban khác trong công ty để bạn theo dõi và điều phối:\n"
                        for m in reversed(other_msgs):
                            overview += f"- [{m.timestamp.strftime('%H:%M:%S')}] [{m.channel.upper()}] {m.sender.upper()}: {m.message[:180]}\n"
                        extra.append(overview)
                except Exception as e:
                    print("Error getting global timeline for secretary:", e)
            
            if extra:
                injected_messages[0]["content"] = sys_msg + "\n\n" + "\n\n".join(extra)

        # Cấu hình tham số gọi
        kwargs: Dict[str, Any] = {
            "model": target_model,
            "messages": injected_messages,
            "temperature": target_temp,
            "stream": True,
        }
        
        # Inject native tools if not Ollama
        is_ollama = "ollama" in target_model.lower()
        if not is_ollama:
            kwargs["tools"] = AGENT_NATIVE_TOOLS
            kwargs["tool_choice"] = "auto"

        # Cấu hình Custom API Base / CLIProxyAPI / OpenRouter nếu nhà cung cấp tương ứng có đăng ký URL
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        
        is_custom_or_proxy = False
        if provider_name in ["custom", "cliproxyapi", "cliproxy", "mimo"]:
            kwargs["api_base"] = self.api_bases.get(provider_name) or ("https://api.xiaomimimo.com/v1" if provider_name == "mimo" else None)
            kwargs["api_key"] = self.api_keys.get(provider_name)
            is_custom_or_proxy = True
        elif provider_name in self.api_bases:
            kwargs["api_base"] = self.api_bases[provider_name]
            kwargs["api_key"] = self.api_keys[provider_name]
        elif "openrouter" in self.api_keys and provider_name == "openrouter":
            kwargs["api_base"] = self.api_bases.get("openrouter") or "https://openrouter.ai/api/v1"
            kwargs["api_key"] = self.api_keys.get("openrouter")
        elif "custom" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("custom")
            kwargs["api_key"] = self.api_keys.get("custom")
            is_custom_or_proxy = True
        elif "cliproxyapi" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("cliproxyapi") or "http://localhost:8317/v1"
            kwargs["api_key"] = self.api_keys.get("cliproxyapi")
            is_custom_or_proxy = True
        elif "cliproxy" in self.api_keys:
            kwargs["api_base"] = self.api_bases.get("cliproxy") or "http://localhost:8317/v1"
            kwargs["api_key"] = self.api_keys.get("cliproxy")
            is_custom_or_proxy = True

        if is_custom_or_proxy:
            # Ép litellm sử dụng cổng OpenAI bằng cách thêm prefix openai/
            if not target_model.startswith("openai/"):
                if "/" in target_model:
                    clean_model = target_model[target_model.find("/")+1:]
                else:
                    clean_model = target_model
                kwargs["model"] = f"openai/{clean_model}"

        if response_format:
            kwargs["response_format"] = response_format

        accumulated_content = []
        tool_calls_stream = {}
        try:
            response = litellm.completion(**kwargs)
            chunk_count = 0
            for chunk in response:
                delta = chunk.choices[0].delta
                delta_content = delta.content or ""
                
                # Periodically update heartbeat while streaming chunks
                chunk_count += 1
                if role and chunk_count % 10 == 0:
                    update_agent_heartbeat(self.workspace_id, role, self.db)
                
                # Check for streaming tool calls
                if hasattr(delta, "tool_calls") and delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_stream:
                            tool_calls_stream[idx] = {"id": "", "name": "", "arguments": []}
                        if tc.id:
                            tool_calls_stream[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_stream[idx]["name"] += tc.function.name
                            if tc.function.arguments:
                                tool_calls_stream[idx]["arguments"].append(tc.function.arguments)
                                
                if delta_content:
                    accumulated_content.append(delta_content)
                    yield delta_content
            
            if tool_calls_stream:
                tool_results = []
                for idx, tc in sorted(tool_calls_stream.items()):
                    tool_name = tc["name"]
                    tool_args_str = "".join(tc["arguments"])
                    try:
                        tool_args = json.loads(tool_args_str)
                    except Exception:
                        tool_args = {}
                    
                    result = self._handle_native_tool_call(tool_name, tool_args, role)
                    tool_results.append(result)
                
                combined_result = "\n\n".join(tool_results)
                yield combined_result
            
            # --- COST CALCULATION & RECORDING ---
            try:
                full_text = "".join(accumulated_content)
                # Ước tính token sử dụng
                prompt_text = "".join([m.get("content", "") for m in injected_messages])
                prompt_tokens = len(prompt_text) // 4
                completion_tokens = len(full_text) // 4
                
                input_price_per_1m = 0.075 # flash default
                output_price_per_1m = 0.30
                if "gpt-4" in target_model:
                    input_price_per_1m = 5.00
                    output_price_per_1m = 15.00
                elif "claude-3-5" in target_model:
                    input_price_per_1m = 3.00
                    output_price_per_1m = 15.00
                elif "ollama" in target_model:
                    input_price_per_1m = 0.00
                    output_price_per_1m = 0.00

                calculated_cost = (
                    (prompt_tokens * (input_price_per_1m / 1000000.0)) + 
                    (completion_tokens * (output_price_per_1m / 1000000.0))
                )

                cost_log = APICostLog(
                    workspace_id=self.workspace_id,
                    model=target_model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost_usd=calculated_cost
                )
                self.db.add(cost_log)
                self.db.commit()
            except Exception:
                pass
        except Exception as e:
            if "ollama" in target_model:
                raise e
            
            try:
                # Fallback to local Ollama llama3
                kwargs["model"] = "ollama/llama3"
                kwargs["stream"] = True
                response = litellm.completion(**kwargs)
                for chunk in response:
                    delta_content = chunk.choices[0].delta.content or ""
                    if delta_content:
                        yield delta_content
            except Exception:
                raise RuntimeError(f"Lỗi gọi LLM API ({target_model}): {str(e)}")

    def _handle_native_tool_call(self, tool_name: str, tool_args: Dict[str, Any], role_name: Optional[str]) -> str:
        from app.database import ApprovalItem
        from app.main import process_and_save_approval_item
        import json
        
        workspace_id = self.workspace_id
        db = self.db
        
        action_type = ""
        proposed_content = ""
        file_path = None
        rationale = ""
        risk_level = "LOW"
        
        try:
            if tool_name == "write_file":
                action_type = "write_file"
                file_path = tool_args.get("file_path")
                proposed_content = tool_args.get("content", "")
                rationale = tool_args.get("rationale", "")
                risk_level = "LOW"
            elif tool_name == "run_command":
                action_type = "run_command"
                proposed_content = tool_args.get("command", "")
                rationale = tool_args.get("explanation", "")
                risk_level = tool_args.get("risk_level", "MEDIUM")
            elif tool_name == "send_email":
                action_type = "send_email"
                recipient = tool_args.get("recipient", "")
                subject = tool_args.get("subject", "")
                body = tool_args.get("body", "")
                proposed_content = f"To: {recipient}\nSubject: {subject}\n\n{body}"
                rationale = f"Yêu cầu gửi email báo cáo tới {recipient}"
                risk_level = "LOW"
            elif tool_name == "deploy_swarm":
                action_type = "deploy_swarm"
                swarm_name = tool_args.get("swarm_name", "")
                execution_mode = tool_args.get("execution_mode", "sequential")
                members = tool_args.get("members", [])
                explanation = tool_args.get("explanation", "")

                # Xác thực danh sách thành viên không được trống
                member_roles = []
                if isinstance(members, list):
                    for m in members:
                        if isinstance(m, dict) and "role" in m:
                            member_roles.append(m["role"])
                
                if not member_roles:
                    return "Thất bại khi triển khai Swarm: Danh sách thành viên (members) không được để trống và phải chứa vai trò hợp lệ."
                
                from app.database import AgentConfig
                nonexistent_members = []
                inactive_members = []
                for m_role in member_roles:
                    cfg = db.query(AgentConfig).filter(
                        AgentConfig.workspace_id == workspace_id,
                        AgentConfig.role == m_role.lower()
                    ).first()
                    if not cfg:
                        nonexistent_members.append(m_role)
                    elif not cfg.is_active:
                        inactive_members.append(m_role)
                
                if nonexistent_members or inactive_members:
                    err_msgs = []
                    if nonexistent_members:
                        err_msgs.append(f"vai trò không tồn tại ({', '.join(nonexistent_members)})")
                    if inactive_members:
                        err_msgs.append(f"Agent đang bị vô hiệu hóa ({', '.join(inactive_members)})")
                    return f"Thất bại khi triển khai Swarm: Phát hiện " + " và ".join(err_msgs) + ". Hãy điều chỉnh lại danh sách thành viên hoặc yêu cầu người dùng kích hoạt/tạo mới họ trước trong mục Settings."

                proposed_content = json.dumps({
                    "swarm_name": swarm_name,
                    "members": members,
                    "execution_mode": execution_mode
                }, ensure_ascii=False)
                rationale = explanation
                risk_level = "MEDIUM"
            elif tool_name == "create_meeting":
                action_type = "deploy_swarm"
                meeting_name = tool_args.get("meeting_name", "")
                meeting_type = tool_args.get("meeting_type", "regular")
                agenda = tool_args.get("agenda", "")
                members_list = tool_args.get("members", [])
                explanation = tool_args.get("explanation", "")

                # Xác thực danh sách thành viên không được trống
                if not members_list:
                    return "Thất bại khi mở cuộc họp: Phải chỉ định rõ ràng danh sách các thành viên cần tham gia trong trường 'members'."
                
                from app.database import AgentConfig
                nonexistent_members = []
                inactive_members = []
                for m_role in members_list:
                    cfg = db.query(AgentConfig).filter(
                        AgentConfig.workspace_id == workspace_id,
                        AgentConfig.role == m_role.lower()
                    ).first()
                    if not cfg:
                        nonexistent_members.append(m_role)
                    elif not cfg.is_active:
                        inactive_members.append(m_role)
                
                if nonexistent_members or inactive_members:
                    err_msgs = []
                    if nonexistent_members:
                        err_msgs.append(f"vai trò không tồn tại ({', '.join(nonexistent_members)})")
                    if inactive_members:
                        err_msgs.append(f"Agent đang bị vô hiệu hóa ({', '.join(inactive_members)})")
                    return f"Thất bại khi mở cuộc họp: Phát hiện " + " và ".join(err_msgs) + ". Hãy điều chỉnh lại danh sách thành viên hoặc yêu cầu người dùng kích hoạt/tạo mới họ trước trong mục Settings."
                
                swarm_members = [{"role": m_role, "task": f"Thảo luận cuộc họp ({meeting_type}): {agenda}"} for m_role in members_list]
                proposed_content = json.dumps({
                    "swarm_name": meeting_name,
                    "members": swarm_members,
                    "execution_mode": "collaborative"
                }, ensure_ascii=False)
                rationale = explanation
                risk_level = "MEDIUM"
            else:
                return f"[System Error] Công cụ '{tool_name}' không được hỗ trợ."

            # Tạo ApprovalItem và chạy qua chính sách duyệt
            app_item = ApprovalItem(
                workspace_id=workspace_id,
                action_type=action_type,
                file_path=file_path,
                proposed_content=proposed_content,
                rationale=rationale,
                risk_level=risk_level
            )
            process_and_save_approval_item(workspace_id, app_item, db, proposer_role=role_name)
            
            # Gửi phản hồi lại cho Agent về trạng thái xử lý
            if app_item.status == "approved":
                return f"[System Execution Status] Yêu cầu '{tool_name}' đã được tự động duyệt và thực thi thành công."
            else:
                return f"[System Execution Status] Yêu cầu '{tool_name}' đã được gửi vào hàng đợi duyệt (Approval Queue ID: {app_item.id}). Agent cần đợi User duyệt trước khi tiếp tục."
                
        except Exception as e:
            return f"[System Error] Lỗi khi xử lý Tool Call '{tool_name}': {str(e)}"

