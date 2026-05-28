# 🎨 BEO SOLOPRENEUR OS: HỆ THỐNG THIẾT KẾ & HƯỚNG DẪN GIAO DIỆN (DESIGN SYSTEM & STYLE GUIDE)

Tài liệu này định nghĩa hệ thống thiết kế hợp nhất và các nguyên tắc giao diện dành cho **Beo Solopreneur OS**. Tất cả các chỉnh sửa, cập nhật hoặc phát triển UI mới đều phải tuân thủ nghiêm ngặt theo các nguyên tắc được quy định tại đây.

---

## 1. Bản Sắc Thiết Kế (Aesthetic DNA)

Giao diện của Beo được lấy cảm hứng sâu sắc từ các sản phẩm công nghệ hàng đầu dành cho lập trình viên và giới sáng tạo như **Linear, Vercel, Notion và Ollama**.

* **Tối Giản & Tập Trung Cao Độ (Minimalist & High-Contrast)**: Loại bỏ hoàn toàn sự lộn xộn. Mỗi pixel hiển thị đều phải phục vụ một mục đích rõ ràng. Tránh các chi tiết trang trí thừa thãi gây phân tâm.
* **Mật Độ Văn Bản Thấp (Low Text Density)**: Nói nhiều hơn với ít từ hơn. Sử dụng nhãn ngắn gọn, tiêu đề phụ viết hoa ngắn và giữ khoảng cách trống (breathing room) rộng rãi để giao diện dễ thở.
* **Tông Màu Xám Than Đặc Trưng (Matte Charcoal)**: Không sử dụng màu đen tuyệt đối `#000000` cho các bảng làm việc chính. Thay vào đó, hãy sử dụng các tông màu than đen sâu, ấm và sang trọng (ví dụ: `#090a0f`, `#0d0e12`, `#121214`, `#18181b`) kết hợp với các lớp phủ mờ đục bán trong suốt (translucent overlays).
* **Điều Hướng Trọng Tâm Văn Bản (Text-Centric Navigation)**: Các hành động phụ và điều hướng cấp dưới nên dựa vào font chữ thanh lịch, căn chỉnh gọn gàng thay vì lạm dụng các biểu tượng (icons) quá sặc sỡ.

---

## 2. Bảng Màu Hệ Thống (Color Palette & Dark System)

Chúng tôi sử dụng một bảng màu tối HSL được tinh tuyển để kiến tạo cảm giác cao cấp và hiện đại bậc nhất.

| Mã Token | Lớp CSS (Tailwind) | Giá trị màu | Vai trò / Mục đích |
| :--- | :--- | :--- | :--- |
| **Background Main** | `bg-background-main` | `#0b0c0f` | Nền chính của bảng làm việc ứng dụng |
| **Background Sidebar** | `bg-background-sidebar` | `#0d0e12` | Nền thanh điều hướng trái |
| **Card / Panel Bg** | `bg-white/[0.02]` | `rgba(255,255,255,0.02)` | Nền cho các thẻ tương tác và danh sách |
| **Border Muted** | `border-white/[0.04]` | `rgba(255,255,255,0.04)` | Đường viền mỏng phân chia phân hệ |
| **Text Normal** | `text-content-normal` | `#a1a1aa` (Zinc-400) | Văn bản thường, mô tả và nội dung chính |
| **Text Highlight** | `text-content-highlight`| `#f4f4f5` (Zinc-100) | Tiêu đề lớn, văn bản nổi bật, tab đang hoạt động |
| **Text Muted** | `text-content-muted` | `#52525b` (Zinc-600) | Nhãn không hoạt động, văn bản phụ mờ |

---

## 3. Quy chuẩn Font chữ & Typography

Để bảo đảm trải nghiệm đọc hoàn hảo và tăng độ tương phản của giao diện tối giản:

* **Font chữ giao diện chính**: Sử dụng `Inter Variable` hoặc `Inter` để hiển thị văn bản giao diện gọn gàng, rõ nét ở kích cỡ nhỏ.
* **Font chữ tiêu đề lớn**: Sử dụng `Outfit` hoặc `Inter` với độ dày lớn (`font-weight: 600` hoặc `700`) và khoảng cách chữ khít (`letter-spacing: -0.02em`) để tạo cảm giác chuyên nghiệp, hiện đại.
* **Font chữ lập trình & Lệnh**: Sử dụng phông chữ đơn cách (Monospace) như `JetBrains Mono` hoặc `SF Mono` cho các phím tắt, dòng lệnh, các file log và tên tệp tin.

---

## 4. Nguyên tắc Sử dụng Biểu tượng (Iconography)

Không sử dụng các emoji nhiều màu sắc, hoạt hình hoặc biểu tượng generic lòe loẹt trong giao diện chính.

* **Điều hướng cấp 1**: Sử dụng các biểu tượng hình học tối giản, dạng viền mảnh (stroke-only như Lucide Icons) với độ dày nét nhỏ (`strokeWidth={1.5}`) và sắc xám mờ.
* **Điều hướng cấp 2 (Sidebar các nhóm/dự án)**: **Hoàn toàn không dùng biểu tượng.** Chỉ sử dụng chữ viết thường/viết hoa chuẩn và căn lề thụt đầu dòng tinh tế. Điều này bắt buộc mắt người dùng tập trung vào nội dung văn bản gốc.
* **Nút bấm kích hoạt hành động**: Chỉ sử dụng biểu tượng siêu nhỏ hoặc các ký tự tối giản khi không có văn bản đi kèm.

---

## 5. Chế độ Xem Động kiểu Notion (Notion-Inspired Dynamic Views)

Các chế độ xem như **Board (Bảng Kanban), List (Danh sách), Calendar (Lịch) và Timeline (Tiến trình thời gian)** thực chất đều hiển thị cùng một nguồn dữ liệu cốt lõi nhưng dưới các giao diện khác nhau.

* **Hiển thị theo nhu cầu (Dynamic Visibility)**: Các tab chế độ xem này không tự động tạo ra mặc định.
* **Kích hoạt dựa trên tệp tin (File-Based Activation)**: Một chế độ xem chỉ xuất hiện trên Sidebar khi file cấu hình tương ứng của nó (ví dụ: `planning_board.md`) được người dùng hoặc Agent tạo ra một cách tường minh trong thư mục dự án.
* **Đồng nhất nguồn dữ liệu**: Bất kể bạn chuyển đổi qua lại giữa giao diện List hay Board, toàn bộ trạng thái công việc trong database SQLite hoặc file Markdown gốc đều được bảo toàn đồng bộ ngay lập tức.
