# Sprint 6 — Lời mời, Mutual Match, Chat Realtime & Sourcing

## Phạm vi đã triển khai

- Nhà tuyển dụng đã xác minh tìm hồ sơ sinh viên **đang bật chế độ công khai**, lọc theo từ khóa, kỹ năng và địa điểm; chỉ dữ liệu nghề nghiệp công khai được trả về, không có email, số điện thoại hay đường dẫn CV riêng tư.
- Nhà tuyển dụng gửi lời mời gắn với tin đang tuyển. Sinh viên đồng ý hoặc từ chối; lời mời hết hạn sau 14 ngày và giới hạn 30 lời mời/ngày/tài khoản.
- Sinh viên có thể chủ động gửi quan tâm tới tin đang tuyển; nhà tuyển dụng đồng ý hoặc từ chối. Mutual match chỉ được tạo khi phía nhận chấp nhận.
- Người gửi có thể thu hồi lời mời/quan tâm khi yêu cầu còn đang chờ; người nhận được thông báo về việc thu hồi.
- Khi hai bên kết nối, hệ thống tạo một cuộc trò chuyện riêng và thông báo trong ứng dụng cho cả hai bên.
- Chat văn bản tối đa 2.000 ký tự, giới hạn 30 tin/phút/tài khoản, tải lịch sử và cập nhật gần thời gian thực qua Server-Sent Events (SSE); giao diện tự đồng bộ dự phòng mỗi 12 giây.
- Thành viên có thể chặn kết nối; cuộc trò chuyện đóng, hai bên không thể gửi tin nhắn hoặc tạo kết nối mới với nhau.
- Xóa tài khoản dọn lời mời, quan tâm, kết nối, hội thoại và tin nhắn của tài khoản đó.

## Chạy trong dự án

1. Từ thư mục gốc chạy `npm start` (hoặc `npm run dev`).
2. Mở `http://localhost:3000/network.html` và đăng nhập bằng tài khoản sinh viên/nhà tuyển dụng.
3. Sinh viên bật hiển thị hồ sơ công khai ở CV & Hồ sơ để xuất hiện trong sourcing. Nhà tuyển dụng cần có doanh nghiệp đã xác minh và tin tuyển dụng đang công khai để gửi lời mời.
4. Thử luồng ứng viên quan tâm → nhà tuyển dụng chấp nhận, hoặc nhà tuyển dụng mời → sinh viên chấp nhận; sau đó mở Trò chuyện.

## API

- `GET /api/sprint6/sourcing?q=&skill=&location=` — danh sách ứng viên công khai (nhà tuyển dụng đã xác minh).
- `POST /api/sprint6/invitations`, `GET /api/sprint6/invitations`, `POST /api/sprint6/invitations/:id/respond`.
- `DELETE /api/sprint6/invitations/:id` — nhà tuyển dụng thu hồi lời mời đang chờ.
- `GET /api/sprint6/jobs`, `POST /api/sprint6/interests`, `POST /api/sprint6/interests/:id/respond`.
- `DELETE /api/sprint6/interests/:id` — sinh viên thu hồi yêu cầu quan tâm đang chờ.
- `GET /api/sprint6/matches`, `GET /api/sprint6/conversations`, `GET /api/sprint6/conversations/:id`, `POST /api/sprint6/conversations/:id/messages`.
- `POST /api/sprint6/conversations/:id/block` — chặn thành viên và đóng kết nối/hội thoại.
- `GET /api/sprint6/events` — luồng SSE có xác thực phiên.

## Kết quả chạy thử

- Chạy thử trên bản sao database dùng riêng cho QA; dữ liệu chính trong `data/db.json` không bị thay đổi.
- Đạt cả hai chiều: nhà tuyển dụng mời → sinh viên chấp nhận → mutual match → chat; sinh viên quan tâm → nhà tuyển dụng chấp nhận.
- Đã xác nhận sourcing không trả email/số điện thoại/CV; thu hồi lời mời/quan tâm hoạt động; chặn sẽ đóng chat và ngăn gửi tin/lời mời mới.
- Regression hiện có: Sprint 2 **5/5**, Sprint 3 **4/4**, Sprint 4 **1/1**.
- Lighthouse giao diện Sprint 6: mobile và desktop đều Accessibility **100**, Best Practices **100**, SEO **100**; không có lỗi console trong lần kiểm tra trình duyệt.

## Lưu trữ và giới hạn

Prototype hiện lưu `sprint6Invitations`, `sprint6Interests`, `sprint6Matches`, `sprint6Conversations`, `sprint6Messages` và `sprint6Blocks` trong `data/db.json`, dùng chung cơ chế lưu hiện tại của dự án. Các migration SQL trong `migrations/` là lược đồ tham chiếu nếu chuyển sang PostgreSQL; cần ánh xạ các tên bảng users/companies/jobs theo migration thực tế trước khi chạy trên môi trường đó.

SSE cần kết nối HTTP giữ mở. Máy chủ prototype đơn tiến trình đáp ứng được luồng demo; triển khai nhiều tiến trình cần pub/sub dùng chung (ví dụ Redis) để phát tin nhắn giữa các máy chủ. Chưa hỗ trợ gửi tệp đính kèm hoặc chuyển thông tin liên hệ riêng qua sourcing.

<!-- Note: Sprint 6 update date 15/11/2026. -->
