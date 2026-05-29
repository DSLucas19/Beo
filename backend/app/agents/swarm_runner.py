import threading
import json
import re
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
from app.database import SwarmJob, SwarmMember, ChatMessage, ApprovalItem
from app.agents.base import AgentWrapper
from app.utils.file_manager import write_workspace_file, read_workspace_file, get_system_settings

def ask_secretary_swarm(workspace_id: str, item, db) -> tuple:
    """Gọi Thư ký AI để đánh giá hành động đề xuất của Swarm."""
    try:
        from app.agents.base import AgentWrapper
        wrapper = AgentWrapper(workspace_id, db)
        prompt = (
            f"Bạn là Thư ký AI (Secretary Agent) - điều phối viên cao cấp của Beo OS.\n"
            f"Hãy đánh giá đề xuất ghi file tự động này từ Swarm Agent:\n\n"
            f"- Tệp ghi: {item.file_path or 'Không có'}\n"
            f"- Nội dung đề xuất: {item.proposed_content[:1500]}...\n"
            f"- Lý do Swarm đưa ra: {item.rationale}\n\n"
            f"Trả về quyết định của bạn:\n"
            f"```json\n"
            f"{{\n"
            f"  \"decision\": \"APPROVE | ESCALATE\",\n"
            f"  \"reason\": \"Giải thích ngắn gọn bằng tiếng Việt...\"\n"
            f"}}\n"
            f"```"
        )
        messages = [
            {"role": "system", "content": "Bạn là Thư ký AI điều phối tối cao của Beo OS."},
            {"role": "user", "content": prompt}
        ]
        res = wrapper.call(messages, role="secretary")
        json_match = re.search(r"```json\s*(.*?)\s*```", res, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(1))
            decision = data.get("decision", "ESCALATE").strip().upper()
            reason = data.get("reason", "Thư ký đề nghị Founder xem xét.")
            return decision, reason
        return "ESCALATE", "Không parse được kết quả."
    except Exception as e:
        return "ESCALATE", str(e)

def process_swarm_proposal(workspace_id: str, proposal: dict, member, db: Session, agent_logs: list) -> bool:
    """Xử lý các đề xuất JSON từ Swarm Agent (propose_files, create_meeting, deploy_swarm)"""
    from app.main import process_and_save_approval_item, execute_approved_action
    
    action = proposal.get("action")
    if action == "propose_files":
        for file_item in proposal.get("files", []):
            f_name = file_item.get("name")
            f_content = file_item.get("content")
            
            app_item = ApprovalItem(
                workspace_id=workspace_id,
                action_type="write_file",
                file_path=f_name,
                proposed_content=f_content,
                rationale=proposal.get("explanation", f"Swarm đề xuất ghi file: {f_name}"),
                risk_level="LOW",
                status="pending"
            )
            
            process_and_save_approval_item(workspace_id, app_item, db, proposer_role=member.role)
            
            if app_item.status == "approved":
                agent_logs.append(f"[Approved] Đã tự động ghi file: {f_name}")
            else:
                member.status = "waiting_approval"
                db.commit()
                
                while True:
                    db.commit()
                    db.refresh(app_item)
                    if app_item.status == "approved":
                        approved = True
                        break
                    elif app_item.status == "rejected":
                        break
                    time.sleep(2)
                    
                if approved:
                    write_workspace_file(workspace_id, f_name, f_content)
                    agent_logs.append(f"[User Approved] Đã ghi tệp: {f_name}")
                    member.status = "running"
                    db.commit()
                else:
                    raise RuntimeError(f"Người dùng từ chối ghi file {f_name}.")
        return True

    elif action in ["create_meeting", "deploy_swarm"]:
        if action == "create_meeting":
            meeting_name = proposal.get("meeting_name", "Cuộc họp khẩn cấp")
            meeting_type = proposal.get("meeting_type", "emergency")
            agenda = proposal.get("agenda", "Thảo luận hướng giải quyết bế tắc")
            members_list = proposal.get("members", [])
            
            swarm_members = [{"role": m_role, "task": f"Thảo luận cuộc họp ({meeting_type}): {agenda}"} for m_role in members_list]
            explanation = proposal.get("explanation", f"Yêu cầu họp {meeting_type}: {agenda}")
            payload = json.dumps({
                "swarm_name": meeting_name,
                "members": swarm_members,
                "execution_mode": "collaborative"
            }, ensure_ascii=False)
        else:
            # deploy_swarm
            swarm_name = proposal.get("swarm_name", "Tác vụ Swarm tự động")
            explanation = proposal.get("explanation", f"Yêu cầu triển khai Swarm của {member.role}")
            members_list = proposal.get("members", [])
            payload = json.dumps({
                "swarm_name": swarm_name,
                "members": members_list,
                "execution_mode": proposal.get("execution_mode", "sequential")
            }, ensure_ascii=False)
            
        app_item = ApprovalItem(
            workspace_id=workspace_id,
            action_type="deploy_swarm",
            file_path=None,
            proposed_content=payload,
            rationale=explanation,
            risk_level="MEDIUM",
            status="pending"
        )
        
        process_and_save_approval_item(workspace_id, app_item, db, proposer_role=member.role)
        
        if app_item.status == "approved":
            agent_logs.append(f"[Approved] Đã tự động triển khai cuộc họp/swarm: {app_item.rationale}")
        else:
            member.status = "waiting_approval"
            db.commit()
            
            import time
            approved = False
            while True:
                db.commit()
                db.refresh(app_item)
                if app_item.status == "approved":
                    approved = True
                    break
                elif app_item.status == "rejected":
                    break
                time.sleep(2)
                
            if approved:
                agent_logs.append(f"[User Approved] Đã triển khai cuộc họp/swarm: {app_item.rationale}")
                member.status = "running"
                db.commit()
            else:
                raise RuntimeError(f"Người dùng từ chối triển khai cuộc họp/swarm.")
        return True
        
    return False

def start_swarm_background(workspace_id: str, swarm_job_id: int, db_factory):
    """Khởi động swarm trong thread chạy ngầm để không block API chính"""
    thread = threading.Thread(
        target=run_swarm,
        args=(workspace_id, swarm_job_id, db_factory),
        daemon=True
    )
    thread.start()

def run_quality_gate(workspace_id: str, swarm_job, members, db) -> tuple:
    """
    Hệ thống Cổng Chất lượng (Quality Gate) của Beo OS.
    Secretary Agent kiểm tra chất lượng kết quả đầu ra của Swarm.
    Trả về: (status, feedback, target_role)
    - status: "APPROVE" hoặc "REDO"
    - feedback: Nhận xét chi tiết
    - target_role: Tên vai trò cần làm lại (nếu REDO)
    """
    try:
        from app.agents.base import AgentWrapper
        wrapper = AgentWrapper(workspace_id, db)
        
        # Tổng hợp kết quả
        deliverables = []
        for m in members:
            deliverables.append(f"[{m.role.upper()}]:\nNhiệm vụ: {m.task}\nKết quả: {m.result or 'Không có'}\n")
            
        summary_deliverables = "\n---\n".join(deliverables)
        
        prompt = (
            f"Bạn là Thư ký điều phối AI (Secretary Agent) của Beo OS, đóng vai trò Cổng chất lượng (Quality Gate).\n"
            f"Hãy đánh giá kết quả làm việc của nhóm Swarm '{swarm_job.name}' dưới đây:\n\n"
            f"=== MỤC TIÊU/NHIỆM VỤ CỦA SWARM ===\n"
            f"{swarm_job.name}\n\n"
            f"=== KẾT QUẢ ĐẦU RA CỦA CÁC THÀNH VIÊN ===\n"
            f"{summary_deliverables}\n\n"
            f"Hãy đánh giá xem kết quả làm việc đã đạt yêu cầu chưa. Nếu đã tốt, hãy trả về quyết định APPROVE.\n"
            f"Nếu có vai trò nào làm chưa tốt, thiếu thông tin, hoặc chưa đúng mục tiêu, hãy trả về quyết định REDO, chỉ rõ vai trò cần sửa (target_role) và lý do/hướng dẫn sửa đổi (feedback).\n\n"
            f"Trả về kết quả dưới dạng JSON bọc trong thẻ ```json ... ``` như sau:\n"
            f"```json\n"
            f"{{\n"
            f"  \"decision\": \"APPROVE | REDO\",\n"
            f"  \"target_role\": \"Tên vai trò cần làm lại (hoặc rỗng nếu APPROVE)\",\n"
            f"  \"feedback\": \"Ý kiến nhận xét đánh giá chi tiết bằng tiếng Việt...\"\n"
            f"}}\n"
            f"```"
        )
        messages = [
            {"role": "system", "content": "Bạn là Thư ký AI kiểm duyệt chất lượng Swarm của Beo OS."},
            {"role": "user", "content": prompt}
        ]
        res = wrapper.call(messages, role="secretary")
        json_match = re.search(r"```json\s*(.*?)\s*```", res, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(1))
            decision = data.get("decision", "APPROVE").strip().upper()
            target_role = data.get("target_role", "").strip()
            feedback = data.get("feedback", "Đồng ý phê duyệt kết quả.")
            return decision, feedback, target_role
        return "APPROVE", "Không parse được kết quả Quality Gate, tự động duyệt.", ""
    except Exception as e:
        print("Lỗi chạy Quality Gate:", e)
        return "APPROVE", f"Lỗi Quality Gate: {str(e)}, tự động duyệt.", ""

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
                    known_roles = ["secretary", "coo", "cto", "cmo", "cfo", "cpo", "ceo", "cco", "cdo", "chro", "cso"]
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
                        # Parse files/meetings
                        json_match = re.search(r"```json\s*(.*?)\s*```", res, re.DOTALL)
                        if json_match:
                            try:
                                proposal = json.loads(json_match.group(1))
                                process_swarm_proposal(workspace_id, proposal, db_member, db, agent_logs)
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
                    known_roles = ["secretary", "coo", "cto", "cmo", "cfo", "cpo", "ceo", "cco", "cdo", "chro", "cso"]
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
                        
                        # Parse files/meetings
                        json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                        if json_match:
                            try:
                                proposal = json.loads(json_match.group(1))
                                process_swarm_proposal(workspace_id, proposal, member, db, agent_logs)
                            except Exception as parse_err:
                                agent_logs.append(f"[CẢNH BÁO] Không parse được JSON đề xuất hoặc bị từ chối: {str(parse_err)}")
                                
                        member.logs = "\n".join(agent_logs)
                        member.result = ai_response
                        member.status = "completed"
                        db.commit()
                        
                        # Gửi tin nhắn chat vào group chat của ban ngành tương ứng
                        primary_role = "marketing"
                        role_lower = member.role.lower()
                        job_name_lower = swarm_job.name.lower()
                        
                        if any(k in role_lower or k in job_name_lower for k in ["coo", "planner", "planning", "pm", "hr", "sop_architect"]):
                            primary_role = "planning"
                        elif any(k in role_lower or k in job_name_lower for k in ["cto", "developer", "engineering", "coder", "tester", "debugger", "ui_designer", "architect"]):
                            primary_role = "engineering"
                        elif any(k in role_lower or k in job_name_lower for k in ["cmo", "marketer", "marketing", "copywriter", "seo_auditor", "ads_planner", "social_media"]):
                            primary_role = "marketing"
                        elif any(k in role_lower or k in job_name_lower for k in ["cfo", "finance", "bookkeeper", "financial_modeler", "risk_analyst", "tax_consultant", "legal"]):
                            primary_role = "finance"
                        elif any(k in role_lower or k in job_name_lower for k in ["cpo", "product", "ux_researcher", "spec_planner", "feedback_analyst"]):
                            primary_role = "product"
                        else:
                            primary_role = "planning"
                            
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
            
            loopback_limit = 2
            loopback_attempts = {} # maps member.id -> count
            
            while True:
                index = 0
                while index < len(members):
                    member = members[index]
                    if member.status == "completed":
                        index += 1
                        continue
                        
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
                        known_roles = ["secretary", "coo", "cto", "cmo", "cfo", "cpo", "ceo", "cco", "cdo", "chro", "cso"]
                        for kr in known_roles:
                            if kr in member.role.lower():
                                effective_role = kr
                                break
                        
                        ai_response = wrapper.call(messages, role=effective_role)
                        
                        # Phân tích đề xuất ghi file tự động / cuộc họp
                        json_match = re.search(r"```json\s*(.*?)\s*```", ai_response, re.DOTALL)
                        files_written = []
                        
                        if json_match:
                            proposal = None
                            try:
                                proposal = json.loads(json_match.group(1))
                                process_swarm_proposal(workspace_id, proposal, member, db, agent_logs)
                                if proposal.get("action") == "propose_files":
                                    for file_item in proposal.get("files", []):
                                        files_written.append(file_item.get("name"))
                                elif proposal.get("action") == "create_meeting":
                                    raise RuntimeError("Gặp bế tắc và yêu cầu họp khẩn cấp. Swarm dừng chạy các bước tiếp theo.")
                            except Exception as e:
                                if proposal and proposal.get("action") == "create_meeting":
                                    raise e
                                agent_logs.append(f"[CẢNH BÁO] Phát hiện đề xuất JSON nhưng không parse được hoặc lỗi: {str(e)}")
                        
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
                        
                        index += 1
                        
                    except Exception as agent_err:
                        member.status = "failed"
                        agent_logs.append(f"[ERROR] Bước chạy thất bại: {str(agent_err)}")
                        member.logs = "\n".join(agent_logs)
                        member.result = f"Error: {str(agent_err)}"
                        db.commit()
                        raise agent_err
                
                # --- CỔNG KIỂM SOÁT CHẤT LƯỢNG (QUALITY GATE) ---
                decision, feedback, target_role = run_quality_gate(workspace_id, swarm_job, members, db)
                if decision == "REDO" and target_role:
                    target_member = None
                    target_idx = -1
                    for idx, m in enumerate(members):
                        if target_role.lower() in m.role.lower():
                            target_member = m
                            target_idx = idx
                            break
                    
                    if target_member:
                        attempts = loopback_attempts.get(target_member.id, 0)
                        if attempts < loopback_limit:
                            loopback_attempts[target_member.id] = attempts + 1
                            
                            # Gửi thông báo Quality Gate yêu cầu làm lại
                            qg_msg = ChatMessage(
                                workspace_id=workspace_id,
                                sender="secretary",
                                message=f"⚠️ **[QUALITY GATE REJECTED - YÊU CẦU LÀM LẠI]**\n\nPhát hiện chất lượng đầu ra chưa đạt yêu cầu. Yêu cầu **{target_member.role}** chỉnh sửa.\n\n💬 **Nhận xét từ Secretary**: {feedback}",
                                channel="secretary"
                            )
                            db.add(qg_msg)
                            
                            # Đặt lại trạng thái từ Agent đích trở đi để chạy lại
                            for reset_idx in range(target_idx, len(members)):
                                m_to_reset = members[reset_idx]
                                m_to_reset.status = "pending"
                                m_to_reset.result = None
                                m_to_reset.logs = f"=== Quality Gate yêu cầu làm lại (Lần {attempts + 1}) ==="
                            
                            db.commit()
                            
                            # Thêm feedback vào cumulative_context
                            cumulative_context += (
                                f"\n[FEEDBACK QUALITY GATE - YÊU CẦU LÀM LẠI - LẦN {attempts + 1}]\n"
                                f"Gửi {target_member.role}: {feedback}\n"
                                f"Hãy sửa đổi/bổ sung lỗi này để hoàn thành nhiệm vụ tốt hơn.\n"
                                f"=========================================\n"
                            )
                            
                            continue
                
                # Cảnh báo nếu chạm giới hạn lặp sửa đổi nhưng vẫn lỗi
                if decision == "REDO":
                    qg_msg = ChatMessage(
                        workspace_id=workspace_id,
                        sender="secretary",
                        message="⚠️ Đã đạt giới hạn làm lại (Quality Gate Loopback Limit), tự động thông qua để tiếp tục.",
                        channel="secretary"
                    )
                    db.add(qg_msg)
                    db.commit()
                break
                    
        # Auto-generate detailed Markdown Meeting Report
        try:
            from app.utils.file_manager import write_workspace_file
            
            # Gather all discussion transcript or sequence results
            summary_context = f"Dự án Swarm: {swarm_job.name}\nChế độ chạy: {mode}\n"
            summary_context += "\n=== KẾT QUẢ CỦA CÁC THÀNH VIÊN ===\n"
            for m in members:
                summary_context += f"[{m.role.upper()}]: {m.result or 'Không có'}\n\n"
            
            wrapper = AgentWrapper(workspace_id, db)
            
            report_prompt = (
                f"Bạn là Thư ký AI (Secretary Agent) điều phối của Beo OS. Hãy tổng hợp một **Báo cáo cuộc họp Swarm / Retrospective** (Markdown) cực kỳ chi tiết dựa trên dữ liệu làm việc dưới đây:\n\n"
                f"{summary_context}\n\n"
                f"Yêu cầu báo cáo phải bao gồm:\n"
                f"1. **Tổng quan cuộc họp**: Mục tiêu chung của Swarm, thời gian, chế độ chạy và các thành viên tham gia.\n"
                f"2. **Tóm tắt nội dung thảo luận & Đóng góp của từng vai trò**: Tóm tắt súc tích góc nhìn chuyên môn và kết quả của từng Agent.\n"
                f"3. **Các quyết định thống nhất & Đề xuất hành động (Consensus)**: Những file đã được tạo, các bước đi tiếp theo.\n"
                f"4. **Sơ đồ Mermaid Tokyo-Night**: Vẽ một sơ đồ flowchart hoặc sequence Mermaid tuyệt đẹp thể hiện quy trình công việc vừa thảo luận, sử dụng đúng bảng màu Tokyo-Night (classDef start_end fill:#7aa2f7,stroke:#3d59a1; classDef process fill:#292e42,stroke:#3d59a1; classDef decision fill:#bb9af7,stroke:#9d7cd8).\n\n"
                f"Hãy viết báo cáo bằng tiếng Việt chuyên nghiệp, cấu trúc markdown rõ ràng."
            )
            
            messages = [
                {"role": "system", "content": "Bạn là Thư ký AI chuyên nghiệp tổng hợp báo cáo cuộc họp Swarm."},
                {"role": "user", "content": report_prompt}
            ]
            
            report_content = wrapper.call(messages, role="secretary")
            
            # Save report under 'reports/meeting_{job_id}.md'
            write_workspace_file(workspace_id, f"reports/meeting_{swarm_job_id}.md", report_content)
            
            # Post a notification + file link to the channel
            report_link = f"/attachments/{workspace_id}/reports/meeting_{swarm_job_id}.md"
            msg_text = (
                f"📊 **[BÁO CÁO CUỘC HỌP SWARM / RETROSPECTIVE]**\n\n"
                f"Swarm **{swarm_job.name}** đã hoàn thành xuất sắc nhiệm vụ và ban hành Báo cáo cuộc họp chính thức.\n\n"
                f"🔗 **Chi tiết báo cáo xem tại**: [meeting_{swarm_job_id}.md](file:///{report_link})\n\n"
                f"{report_content[:1500]}..."
            )
            
            primary_role = "secretary"
            role_lower = members[0].role.lower() if members else "secretary"
            if any(k in role_lower for k in ["coo", "planner", "planning"]):
                primary_role = "planning"
            elif any(k in role_lower for k in ["cto", "developer", "engineering"]):
                primary_role = "engineering"
            elif any(k in role_lower for k in ["cmo", "marketer", "marketing"]):
                primary_role = "marketing"
            elif any(k in role_lower for k in ["cfo", "finance"]):
                primary_role = "finance"
            elif any(k in role_lower for k in ["cpo", "product"]):
                primary_role = "product"
                
            report_msg = ChatMessage(
                workspace_id=workspace_id,
                sender="secretary",
                message=msg_text,
                channel=f"{primary_role}_group" if primary_role != "secretary" else "secretary"
            )
            db.add(report_msg)
            db.commit()
            
        except Exception as rep_err:
            print("Lỗi tạo báo cáo cuộc họp Swarm:", rep_err)

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
