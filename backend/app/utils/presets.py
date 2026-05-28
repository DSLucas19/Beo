PRESET_SKILLS = [
    {
        "key": "read_file",
        "name": "Đọc tệp tin (Read Files)",
        "description": "Cập nhật quyền cho AI đọc trực tiếp nội dung các tệp tài liệu và mã nguồn (.md, .py, .js, .json, .csv, v.v.) trong phạm vi workspace để phân tích và lập báo cáo."
    },
    {
        "key": "write_file",
        "name": "Ghi/Sửa tệp tin (Write Files)",
        "description": "Cho phép AI tự động tạo mới tệp, cập nhật mã nguồn, ghi đè các cấu hình đặc tả kỹ thuật hoặc lưu trữ dữ liệu đầu ra mà không cần Founder phải sao chép thủ công."
    },
    {
        "key": "run_command",
        "name": "Thực thi lệnh Terminal (Run Commands)",
        "description": "Cho phép AI đề xuất và chạy các lệnh CLI/Shell trên hệ điều hành cục bộ (cần Founder phê duyệt qua cơ chế Human-In-The-Loop) nhằm cài đặt thư viện, biên dịch dự án hoặc khởi chạy dịch vụ."
    },
    {
        "key": "send_email",
        "name": "Gửi Email (Send Email)",
        "description": "Tích hợp dịch vụ email (giả lập ghi log hoặc SMTP thực tế) để gửi các chiến dịch marketing, phản hồi khách hàng hoặc báo cáo tiến độ tự động tới Founder."
    },
    {
        "key": "create_employee",
        "name": "Tuyển dụng nhân sự (Create Employee)",
        "description": "Ủy quyền cho AI đề xuất tuyển dụng thêm AI Employees chuyên trách dài hạn, tự động cấu hình file SOUL, PERSONALITY, phân quyền kỹ năng và thiết lập kết nối MCP riêng cho nhân viên mới."
    },
    {
        "key": "deploy_swarm",
        "name": "Triển khai Swarm (Deploy Swarm)",
        "description": "Kích hoạt nhóm tác vụ đa Agent hoạt động song song, tuần tự hoặc thảo luận nhóm xoay vòng để xử lý tự động các công việc phức tạp như lập trình MVP toàn diện hoặc chạy chiến dịch ra mắt sản phẩm."
    }
]

PRESET_MCP_SERVERS = [
    {
        "key": "slack",
        "name": "Slack Integration",
        "description": "Cầu nối liên lạc thời gian thực, cho phép các AI agents tự động gửi tin nhắn báo cáo tiến độ, cập nhật trạng thái dự án hoặc gửi thông báo quan trọng lên các kênh Slack nội bộ.",
        "default_url": "http://localhost:5001",
        "tools": [
            {"name": "post_message", "description": "Gửi tin nhắn định dạng phong phú lên Slack channel chỉ định"},
            {"name": "list_channels", "description": "Liệt kê danh sách các kênh chat đang tồn tại trên Slack workspace"},
            {"name": "get_channel_history", "description": "Đọc lịch sử các tin nhắn gần nhất để nắm bắt ngữ cảnh thảo luận"}
        ]
    },
    {
        "key": "google-calendar",
        "name": "Google Calendar",
        "description": "Quản lý và đồng bộ hóa lịch trình làm việc, thiết lập cuộc họp đối tác, nhắc nhở lịch hẹn và theo dõi các cột mốc deadline chiến lược của Solo Founder.",
        "default_url": "http://localhost:5002",
        "tools": [
            {"name": "create_event", "description": "Tạo sự kiện hoặc lịch hẹn mới trên Google Calendar"},
            {"name": "list_events", "description": "Truy xuất danh sách các sự kiện sắp diễn ra trong ngày hoặc tuần"},
            {"name": "delete_event", "description": "Xóa hoặc hủy bỏ sự kiện lịch hẹn cũ"}
        ]
    },
    {
        "key": "gmail",
        "name": "Gmail Connector",
        "description": "Đọc, lọc, phân loại độ ưu tiên của thư đến và tự động soạn thảo bản nháp email phản hồi khách hàng thông qua hòm thư Gmail của doanh nghiệp.",
        "default_url": "http://localhost:5003",
        "tools": [
            {"name": "send_email", "description": "Gửi email trực tiếp hoặc lưu bản nháp qua API Gmail"},
            {"name": "list_emails", "description": "Đọc danh sách các thư chưa đọc trong hộp thư đến"},
            {"name": "search_emails", "description": "Tìm kiếm email theo từ khóa, người gửi hoặc thời gian"}
        ]
    },
    {
        "key": "brave-search",
        "name": "Brave Web Search",
        "description": "Cung cấp cho AI khả năng tìm kiếm internet thời gian thực để cập nhật xu hướng thị trường, thu thập dữ liệu đối thủ cạnh tranh và tra cứu tài liệu kỹ thuật mới nhất.",
        "default_url": "http://localhost:5004",
        "tools": [
            {"name": "brave_web_search", "description": "Tìm kiếm thông tin tổng hợp trên toàn bộ mạng Internet"},
            {"name": "brave_local_search", "description": "Tìm kiếm thông tin doanh nghiệp, địa điểm cục bộ"}
        ]
    },
    {
        "key": "postgres",
        "name": "PostgreSQL Database",
        "description": "Truy vấn trực tiếp, tổng hợp dữ liệu giao dịch, thông tin khách hàng (CRM) hoặc dữ liệu phân tích hệ thống được lưu trữ trong cơ sở dữ liệu PostgreSQL.",
        "default_url": "http://localhost:5005",
        "tools": [
            {"name": "execute_sql", "description": "Thực thi câu lệnh SQL truy vấn đọc hoặc ghi dữ liệu có kiểm soát"},
            {"name": "get_schema", "description": "Xem cấu trúc chi tiết của các bảng (tables, columns, types)"},
            {"name": "list_tables", "description": "Liệt kê danh sách tất cả các bảng dữ liệu trong database"}
        ]
    },
    {
        "key": "google-sheets",
        "name": "Google Sheets",
        "description": "Ghi nhận doanh thu, quản lý dòng tiền, cập nhật danh sách khách hàng tiềm năng hoặc xuất các báo cáo chi phí API trực tiếp lên các bảng tính Google Sheets dùng chung.",
        "default_url": "http://localhost:5006",
        "tools": [
            {"name": "read_sheet", "description": "Đọc dữ liệu từ một vùng chọn hoặc toàn bộ sheet"},
            {"name": "write_sheet", "description": "Ghi thêm dòng mới, cập nhật ô hoặc định dạng bảng tính"},
            {"name": "create_sheet", "description": "Khởi tạo một file bảng tính Google Sheets mới trong Drive"}
        ]
    },
    {
        "key": "github",
        "name": "GitHub Operations",
        "description": "Quản trị mã nguồn dự án: theo dõi commits, quản lý issues, tự động tạo pull requests khi code MVP đã qua kiểm thử và tương tác với repositories trên GitHub.",
        "default_url": "http://localhost:5007",
        "tools": [
            {"name": "create_issue", "description": "Tạo Issue mới để báo cáo lỗi hoặc ghi nhận đầu việc cần làm"},
            {"name": "create_pull_request", "description": "Tạo PR cho branch chứa code mới đề xuất merge"},
            {"name": "list_repositories", "description": "Xem danh sách các repositories của tài khoản hoặc tổ chức"}
        ]
    }
]
