# Sprint 5 — Matching hai chiều, giải thích và AI hỗ trợ

Sprint này bổ sung ghép nối theo cả hai hướng, giải thích lý do gợi ý, thông báo in-app/email, tìm việc nhanh và việc làm phù hợp trên trang chủ, trợ lý chat và công cụ soạn nội dung AI. Các tệp giao diện, API và tài liệu nằm trong thư mục Sprint 5; `public/index.html`, `public/site-nav.js` và Sprint 1 server chỉ được nối vào ứng dụng đang chạy.

## Chạy trong VS Code

Mở terminal ở thư mục gốc dự án, chạy `npm.cmd start`, rồi mở `http://localhost:3000`. Trang chủ có ô tìm kiếm và tin mới; trang gợi ý ở `/matches.html`; trợ lý chat ở nút **Hỏi AI**; công cụ soạn tin và hỗ trợ nội dung CV ở `/ai-tools.html`.

## Luồng matching

- Sinh viên: việc đang công khai, doanh nghiệp đã xác minh, chưa hết hạn và chưa ứng tuyển. So khớp kỹ năng trên hồ sơ và CV đã xử lý, định hướng/ngành, địa điểm, loại hình và bằng chứng dự án/kinh nghiệm.
- Nhà tuyển dụng: ứng viên hồ sơ công khai được so với các tin công khai của chính doanh nghiệp. Không trả email/điện thoại hoặc tệp CV; ứng viên đã ứng tuyển vào doanh nghiệp không bị hiển thị như sourcing mới.
- Mỗi kết quả có điểm 0–100, kỹ năng khớp/thiếu và lý do đọc được. Tỷ trọng tham khảo được nêu trên trang; điểm không tự động quyết định tuyển dụng.
- Worker quét mỗi phút và phát thông báo mới một lần cho mỗi cặp ứng viên–tin đạt ngưỡng (55% cho sinh viên, 65% cho nhà tuyển dụng). Email dùng chung outbox/worker Sprint 4; cần cấu hình Resend thì mới gửi thư ra ngoài. Lần khởi động đầu ghi nhận baseline yên lặng để không gửi hàng loạt thông báo lịch sử.
- Hồ sơ riêng tư không được dùng để sourcing. Sinh viên quản lý quyền hiển thị tại trang CV & hồ sơ.

## Trợ lý AI trang chủ

Trợ lý nhận câu hỏi tiếng Việt, tìm việc, đọc gợi ý của tài khoản đã đăng nhập, góp ý hồ sơ và tin tuyển dụng. Trang `/ai-tools.html` còn có công cụ soạn/tối ưu mô tả việc làm, viết câu kinh nghiệm CV và tóm tắt hồ sơ; người dùng xem lại rồi sao chép, ứng dụng không tự sửa tin/CV. Mặc định chạy chế độ ngữ cảnh nội bộ, không gọi dịch vụ AI bên ngoài. Nếu đơn vị vận hành đã bật provider bằng `OPENAI_API_KEY`, người dùng vẫn phải bật ô đồng ý riêng trước khi gửi nội dung/ngữ cảnh tối thiểu ra ngoài; tài khoản đã đăng nhập lưu lựa chọn và có thể thu hồi, khách chỉ đồng ý cho lần hỏi hiện tại. Khi provider lỗi, trợ lý tự quay về câu trả lời nội bộ. Nội dung câu hỏi/biểu mẫu không được lưu vào lịch sử.

## Giới hạn prototype

- Matching hiện là điểm số heuristic có giải thích, chưa phải mô hình học máy được huấn luyện hoặc điểm xác suất thành công.
- Chat nội bộ mặc định dùng phân loại ý định/ngữ cảnh, không phải hội thoại mô hình sinh. Mô hình sinh cần nhà vận hành cấu hình API key và chấp thuận gửi câu hỏi cùng ngữ cảnh tối thiểu (kỹ năng, việc gợi ý hoặc kỹ năng ứng viên; không gửi thông tin liên hệ/tệp CV).
- Worker cùng tiến trình và JSON runtime hiện có giới hạn một instance ghi dữ liệu.
- Thông báo qua email cần Resend như Sprint 4; nếu chưa đặt cấu hình, thông báo in-app vẫn được tạo và email outbox được đánh dấu theo worker.

## Tệp

- `api.js`: scoring, API, trợ lý ngữ cảnh/model, chống trùng thông báo và worker matching.
- `matches.html`, `matches.js`, `sprint5.css`: trang gợi ý hai chiều và giải thích.
- `ai-tools.html`, `ai-tools.js`, `tools.css`: công cụ soạn/tối ưu tin tuyển dụng và hỗ trợ nội dung CV.
- `homepage.js`, `homepage.css`: tìm việc nhanh và danh sách việc làm cá nhân hóa trên trang chủ.
- `assistant.css`, `home-assistant.js`: giao diện chat nổi trên trang chủ.
- `migrations/005_sprint5.up.sql`, `migrations/005_sprint5.down.sql`: schema đích PostgreSQL (runtime JSON chưa áp dụng migration).
- `docs/ban-giao.md`: biên bản bàn giao và trạng thái.
- `docs/api.md`: routes Sprint 5 và hợp đồng request/response.
<!-- Note: Sprint 5 update date 10/11/2026. -->
