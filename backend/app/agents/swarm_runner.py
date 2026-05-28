import threading
import json
import re
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
from app.database import SwarmJob, SwarmMember, ChatMessage
from app.agents.base import AgentWrapper
from app.utils.file_manager import write_workspace_file, read_workspace_file

def start_swarm_background(workspace_id: str, swarm_job_id: int, db_factory):
    """Khởi động swarm trong thread chạy ngầm để không block API chính"""
    thread = threading.Thread(
        target=run_swarm,
        args=(workspace_id, swarm_job_id, db_factory),
        daemon=True
    )
    thread.start()

def run_swarm(workspace_id: str, swarm_job_id: int, db_factory):
    """
    Thực thi swarm đa nhiệm:
    - sequential: Chạy tuần tự, bước trước làm đầu vào cho bước sau.
    - parallel: Chạy đồng thời các Agent (đa luồng), gộp kết quả.
    - collaborative: Thảo luận xoay vòng (round-robin) giữa các Agent để thống nhất ý kiến.
    """
    db: Session = db_factory()
    try:
        swarm_job = db.query(SwarmJob).filter(SwarmJob.id == swarm_job_id).first()
        if not swarm_job:
            return
        
        swarm_job.status = "running"
        db.commit()

        members = db.query(SwarmMember).filter(SwarmMember.swarm_job_id == swarm_job_id).order_by(SwarmMember.id.asc()).all()
        
        mode = swarm_job.execution_mode or "sequential"
        
        if mode == "parallel":
            # --- 1. CHẾ ĐỘ CHẠY SONG SONG (PARALLEL MODE) ---
            # Để tránh deadlock SQLite, chúng ta thực hiện các cuộc gọi LLM song song,
            # sau đó lưu kết quả tuần tự ở luồng chính.
            
            def execute_parallel_member(m_id, role, task):
                thread_db = db_factory()
                try:
                    wrapper = AgentWrapper(workspace_id, thread_db)
                    prompt = (
                        f"Bạn đang chạy độc lập trong nhóm tác vụ song song (Parallel Swarm).\n"
                        f"Tên Swarm: {swarm_job.name}\n"
                        f"Vai trò: {role}\n"
                        f"Nhiệm vụ: {task}\n\n"
                        f"Hãy thực hiện nhiệm vụ và trả về kết quả. "
                        f"Nếu nhiệm vụ yêu cầu tạo tài liệu, slides (.slide.md) hoặc bảng tính (.csv), "
                        f"hãy trả về cấu trúc JSON đề xuất bọc trong thẻ ```json ... ```:\n"
                        f"```json\n"
                        f"{{\n"
                        f"  \"action\": \"propose_files\",\n"
                        f"  \"files\": [\n"
                        f"    {{\n"
                        f"      \"name\": \"ten_file.extension\",\n"
                        f"      \"content\": \"nội dung file...\"\n"
                        f"    }}\n"
                        f"  ],\n"
                        f"  \"explanation\": \"Lý do tạo\"\n"
                        f"}}\n"
                        f"```\n"
                    )
                    messages = [
                        {"role": "system", "content": f"Bạn là AI chuyên gia [{role}] chạy song song trong Beo Corp."},
                        {"role": "user", "content": prompt}
                    ]
                    
                    effective_role = "secretary"
                    known_roles = ["secretary", "planner", "developer", "marketer", "finance"]
                    for kr in known_roles:
                        if kr in role.lower():
                            effective_role = kr
                            break
                            
                    res_content = wrapper.call(messages, role=effective_role)
                    return m_id, res_content, None
                except Exception as err:
                    return m_id, None, str(err)
                finally:
                    thread_db.close()

            # Chạy đa luồng gọi LLM
            futures = []
            with ThreadPoolExecutor(max_workers=min(len(members), 5)) as executor:
                for member in members:
                    member.status = "running"
                    db.commit()
                    futures.append(
                        executor.submit(execute_parallel_member, member.id, member.role, member.task)
                    )
            
            # Ghi nhận kết quả tuần tự trên luồng chính
            for fut in futures:
                m_id, res, err = fut.result()
                db_member = db.query(SwarmMember).filter(SwarmMember.id == m_id).first()
                if db_member:
                    if err:
                        db_member.status = "failed"
                        db_member.result = f"Error: {err}"
                        db_member.logs = f"=== BẮT ĐẦU CHẠY SONG SONG ===\nNhiệm vụ: {db_member.task}\n[ERROR] {err}"
                    else:
                        db_member.status = "completed"
                        db_member.result = res
                        
                        agent_logs = [f"=== BẮT ĐẦU CHẠY SONG SONG ===", f"Nhiệm vụ: {db_member.task}"]
                        # Parse files
                        json_match = re.search(r"```json\s*(.*?)\s*```", res, re.DOTALL)
                        if json_match:
                            try:
                                proposal = json.loads(json_match.group(1))
                                if proposal.get("action") == "propose_files":
                                    for file_item in proposal.get("files", []):
                                        f_name = file_item.get("name")
                                        f_content = file_item.get("content")
                                        write_workspace_file(workspace_id, f_name, f_content)
                                        agent_logs.append(f"[Auto-Approve] Đã tự động ghi file: {f_name}")
                            except Exception as parse_err:
                                agent_logs.append(f"[CẢNH BÁO] Không parse được JSON đề xuất: {str(parse_err)}")
                                
                        agent_logs.append("=== HOÀN THÀNH CHẠY SONG SONG ===")
                        db_member.logs = "\n".join(agent_logs)
                        
                        # Gửi chat log
                        chat_msg = ChatMessage(
                            workspace_id=workspace_id,
                            sender=db_member.role,
                            message=f"🤖 [SONG SONG - {swarm_job.name}] Đã hoàn thành nhiệm vụ: {db_member.task}\n\nKết quả: {res[:300]}...",
                            channel="secretary"
                        )
                        db.add(chat_msg)
                    db.commit()

        elif mode == "collaborative":
            # --- 2. CHẾ ĐỘ THẢO LUẬN NHÓM CỘNG TÁC (COLLABORATIVE MODE) ---
            # Các Agent thảo luận xoay vòng (Round-Robin) qua 2 vòng
            discussion_transcript = []
            
            # Lấy danh sách các agent tham gia
            swarm_task_summary = "\n".join([f"- {m.role}: {m.task}" for m in members])
            
            # Lịch sử chat nội bộ của Swarm
            discussion_history = [
                {"role": "system", "content": (
                    f"Bạn đang tham gia phiên thảo luận cộng tác (Collaborative Swarm).\n"
                    f"Tên Swarm: {swarm_job.name}\n"
                    f"Mục tiêu chung: Giải quyết các nhiệm vụ sau:\n{swarm_task_summary}\n\n"
                    f"Hãy thảo luận chuyên nghiệp, phản biện và đưa ra đề xuất tối ưu. "
                    f"Từng thành viên sẽ phát biểu theo lượt."
                )}
            ]
            
            # Xoay vòng phát biểu (2 rounds)
            for round_idx in range(2):
                for idx, member in enumerate(members):
                    member.status = "running"
                    db.commit()
                    
                    wrapper = AgentWrapper(workspace_id, db)
                    
                    # Cấu hình Prompt riêng cho lượt phát biểu
                    prompt = (
                        f"Đây là lượt phát biểu của bạn (Vòng {round_idx + 1}).\n"
                        f"Vai trò của bạn: {member.role}\n"
                        f"Nhiệm vụ cụ thể: {member.task}\n\n"
                        f"Dưới đây là nội dung thảo luận của các thành viên trước đó:\n"
                        f"--- BẮT ĐẦU THẢO LUẬN ---\n"
                    )
                    for speaker, msg in discussion_transcript:
                        prompt += f"[{speaker.upper()}]: {msg}\n"
                    prompt += "--- KẾT THÚC THẢO LUẬN ---\n\n"
                    prompt += (
                        "Hãy phản hồi lại cuộc thảo luận trên từ góc nhìn chuyên môn của bạn. "
                        "Nếu ở vòng cuối (Vòng 2), hãy tổng kết và đề xuất tạo/ghi các tệp deliverables (slide, CSV, markdown) thông qua cấu trúc JSON đề xuất:\n"
                        "```json\n"
                        "{\n"
                        "  \"action\": \"propose_files\",\n"
                        "  \"files\": [\n"
                        "    {\n"
                        "      \"name\": \"ten_file.extension\",\n"
                        "      \"content\": \"nội dung...\"\n"
                        "    }\n"
                        "  ],\n"
                        "  \"explanation\": \"Lý do\"\n"
                        "}\n"
                        "```\n"
                    )
                    
                    messages = list(discussion_history)
                    messages.append({"role": "user", "content": prompt})
                    
                    effective_role = "secretary"
                    known_roles = ["secretary", "planner", "developer", "marketer", "finance"]
                    for kr in known_roles:
                        if kr in member.role.lower():
                            effective_role = kr
                            break
                            
                    try:
                        ai_response = wrapper.call(messages, role=effective_role)
                        
                        # Lưu lượt thảo luận vào transcript
                        discussion_transcript.append((member.role, ai_response))
                        
                        # Ghi nhận log
                        agent_logs = [
                            f"=== VÒNG {round_idx + 1} - LƯỢT CỦA {member.role} ===",
                            f"Nhiệm vụ: {member.task}",
                            f"Phát biểu: {ai_response[:300]}..."
                        ]
                        
                        # Parse files
                        json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                        if json_match:
                            try:
                                proposal = json.loads(json_match.group(1))
                                if proposal.get("action") == "propose_files":
                                    for file_item in proposal.get("files", []):
                                        f_name = file_item.get("name")
                                        f_content = file_item.get("content")
                                        write_workspace_file(workspace_id, f_name, f_content)
                                        agent_logs.append(f"[Auto-Approve] Đã tự động ghi file: {f_name}")
                            except Exception as parse_err:
                                agent_logs.append(f"[CẢNH BÁO] Không parse được JSON đề xuất: {str(parse_err)}")
                                
                        member.logs = "\n".join(agent_logs)
                        member.result = ai_response
                        member.status = "completed"
                        db.commit()
                        
                        # Gửi tin nhắn chat vào group chat của ban ngành tương ứng
                        primary_role = "marketing"
                        role_lower = member.role.lower()
                        job_name_lower = swarm_job.name.lower()
                        if "planner" in role_lower or "planning" in role_lower or "planning" in job_name_lower:
                            primary_role = "planning"
                        elif "developer" in role_lower or "engineering" in role_lower or "engineering" in job_name_lower:
                            primary_role = "engineering"
                        elif "marketer" in role_lower or "marketing" in role_lower or "marketing" in job_name_lower:
                            primary_role = "marketing"
                        elif "finance" in role_lower or "legal" in role_lower or "finance" in job_name_lower:
                            primary_role = "finance"
                        group_channel = f"{primary_role}_group"
                        
                        chat_msg = ChatMessage(
                            workspace_id=workspace_id,
                            sender=member.role,
                            message=f"🤖 [SWARM THẢO LUẬN] (Vòng {round_idx+1})\n\n{ai_response}",
                            channel=group_channel
                        )
                        db.add(chat_msg)
                        db.commit()
                        
                    except Exception as err:
                        member.status = "failed"
                        member.result = str(err)
                        db.commit()
                        raise err
            
            # Lưu transcript thảo luận dạng JSON vào SwarmJob
            swarm_job.discussion = json.dumps(
                [{"sender": speaker, "message": text} for speaker, text in discussion_transcript],
                ensure_ascii=False
            )
            db.commit()

        else:
            # --- 3. CHẾ ĐỘ CHẠY TUẦN TỰ (SEQUENTIAL MODE - MẶC ĐỊNH) ---
            cumulative_context = f"Dự án Swarm: {swarm_job.name}\n"
            
            for index, member in enumerate(members):
                member.status = "running"
                db.commit()
                
                agent_logs = [f"=== Khởi động Agent [{member.role}] ==="]
                agent_logs.append(f"Nhiệm vụ: {member.task}")
                member.logs = "\n".join(agent_logs)
                db.commit()
                
                prompt = (
                    f"Bạn đang là một mắt xích trong nhóm làm việc tự động (Swarm Agents).\n"
                    f"Tên Swarm: {swarm_job.name}\n"
                    f"Vai trò của bạn: {member.role}\n"
                    f"Nhiệm vụ cụ thể của bạn: {member.task}\n\n"
                    f"Dưới đây là lịch sử và kết quả làm việc của các thành viên trước đó trong Swarm:\n"
                    f"--- BẮT ĐẦU NGỮ CẢNH ---\n"
                    f"{cumulative_context}\n"
                    f"--- KẾT THÚC NGỮ CẢNH ---\n\n"
                    f"Hãy phân tích ngữ cảnh trên và thực hiện nhiệm vụ của bạn. "
                    f"Nếu nhiệm vụ yêu cầu tạo tài liệu, slides (.slide.md) hoặc bảng tính (.csv), "
                    f"hãy tạo ra file tương ứng thông qua cấu trúc JSON đề xuất dạng:\n"
                    f"```json\n"
                    f"{{\n"
                    f"  \"action\": \"propose_files\",\n"
                    f"  \"files\": [\n"
                    f"    {{\n"
                    f"      \"name\": \"ten_file.extension\",\n"
                    f"      \"content\": \"nội dung file...\"\n"
                    f"    }}\n"
                    f"  ],\n"
                    f"  \"explanation\": \"Lý do tạo các file này\"\n"
                    f"}}\n"
                    f"```\n"
                )
                
                try:
                    wrapper = AgentWrapper(workspace_id, db)
                    messages = [
                        {"role": "system", "content": f"Bạn là AI chuyên gia đóng vai trò [{member.role}] trong swarm tự động của Beo Corp."},
                        {"role": "user", "content": prompt}
                    ]
                    
                    effective_role = "secretary"
                    known_roles = ["secretary", "planner", "developer", "marketer", "finance"]
                    for kr in known_roles:
                        if kr in member.role.lower():
                            effective_role = kr
                            break
                    
                    ai_response = wrapper.call(messages, role=effective_role)
                    
                    # Phân tích đề xuất ghi file tự động
                    json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                    files_written = []
                    
                    if json_match:
                        try:
                            proposal = json.loads(json_match.group(1))
                            if proposal.get("action") == "propose_files":
                                for file_item in proposal.get("files", []):
                                    f_name = file_item.get("name")
                                    f_content = file_item.get("content")
                                    write_workspace_file(workspace_id, f_name, f_content)
                                    files_written.append(f_name)
                                    agent_logs.append(f"[Auto-Approve] Đã tự động ghi file: {f_name}")
                        except Exception as e:
                            agent_logs.append(f"[CẢNH BÁO] Phát hiện đề xuất JSON nhưng không parse được hoặc ghi file lỗi: {str(e)}")
                    
                    member.result = ai_response
                    member.status = "completed"
                    
                    cumulative_context += (
                        f"\n[Bước {index+1}] Agent: {member.role}\n"
                        f"Nhiệm vụ: {member.task}\n"
                        f"Kết quả đầu ra: {ai_response}\n"
                        f"Các file đã tạo: {', '.join(files_written) if files_written else 'Không có'}\n"
                        f"=========================================\n"
                    )
                    
                    agent_logs.append(f"=== Hoàn thành nhiệm vụ Agent [{member.role}] ===")
                    member.logs = "\n".join(agent_logs)
                    
                    chat_msg = ChatMessage(
                        workspace_id=workspace_id,
                        sender=member.role,
                        message=f"🤖 [SWARM - {swarm_job.name}] Đã hoàn thành nhiệm vụ: {member.task}\n\nKết quả: {ai_response[:300]}...",
                        channel="secretary"
                    )
                    db.add(chat_msg)
                    db.commit()
                    
                except Exception as agent_err:
                    member.status = "failed"
                    agent_logs.append(f"[ERROR] Bước chạy thất bại: {str(agent_err)}")
                    member.logs = "\n".join(agent_logs)
                    member.result = f"Error: {str(agent_err)}"
                    db.commit()
                    raise agent_err
                    
        swarm_job.status = "completed"
        db.commit()
        
    except Exception as swarm_err:
        try:
            swarm_job = db.query(SwarmJob).filter(SwarmJob.id == swarm_job_id).first()
            if swarm_job:
                swarm_job.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
