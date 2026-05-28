import os
from typing import List, Dict, Any, Optional
import litellm
from sqlalchemy.orm import Session
from app.database import APIKey
from app.security import decrypt_key
from app.config import DEFAULT_MODEL, DEFAULT_TEMPERATURE

# Tắt hiển thị prompt và log chi tiết không cần thiết của litellm
litellm.telemetry = False

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
        injected_messages = [dict(m) for m in messages]
        if injected_messages and injected_messages[0]["role"] == "system":
            sys_msg = injected_messages[0]["content"]
            extra = []
            if soul_content:
                extra.append(f"### [SOUL & CORE VALUES]\n{soul_content}")
            if personality_content:
                extra.append(f"### [PERSONALITY & STYLE]\n{personality_content}")
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

        # Cấu hình Custom API Base / CLIProxyAPI / OpenRouter nếu nhà cung cấp tương ứng có đăng ký URL
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        
        is_custom_or_proxy = False
        if provider_name in ["custom", "cliproxyapi", "cliproxy"]:
            kwargs["api_base"] = self.api_bases.get(provider_name)
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
            content = response.choices[0].message.content or ""
            
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
        injected_messages = [dict(m) for m in messages]
        if injected_messages and injected_messages[0]["role"] == "system":
            sys_msg = injected_messages[0]["content"]
            extra = []
            if soul_content:
                extra.append(f"### [SOUL & CORE VALUES]\n{soul_content}")
            if personality_content:
                extra.append(f"### [PERSONALITY & STYLE]\n{personality_content}")
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

        # Cấu hình Custom API Base / CLIProxyAPI / OpenRouter nếu nhà cung cấp tương ứng có đăng ký URL
        provider_name = target_model.split("/")[0].lower() if "/" in target_model else ""
        
        is_custom_or_proxy = False
        if provider_name in ["custom", "cliproxyapi", "cliproxy"]:
            kwargs["api_base"] = self.api_bases.get(provider_name)
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
        try:
            response = litellm.completion(**kwargs)
            for chunk in response:
                delta_content = chunk.choices[0].delta.content or ""
                if delta_content:
                    accumulated_content.append(delta_content)
                    yield delta_content
            
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

