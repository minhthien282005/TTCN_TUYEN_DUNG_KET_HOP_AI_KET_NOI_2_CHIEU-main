# Sprint 9 — Quản trị, kiểm duyệt tự động, an toàn & tuân thủ dữ liệu

## Phạm vi triển khai

- Chấm điểm rủi ro tin tuyển dụng theo luật nội bộ: yêu cầu phí/chuyển tiền, yêu cầu OTP hoặc thông tin tài chính nhạy cảm, lời hứa thu nhập bất thường và tin trùng tiêu đề trong cùng doanh nghiệp.
- Tin có điểm từ 40 trở lên được gắn cờ để admin ưu tiên kiểm tra. Hệ thống không tự đăng, từ chối hay gỡ tin; quyết định cuối cùng vẫn ở trang kiểm duyệt hiện có.
- Trung tâm admin `/sprint9/admin.html` hiển thị số tin rủi ro, tóm tắt đồng ý AI và 80 sự kiện audit gần nhất; trang kiểm duyệt cũ tiếp tục xử lý duyệt tin/tài khoản/báo cáo.
- Trang quyền riêng tư `/sprint9/privacy.html` cho tài khoản đã đăng nhập xem lịch sử đồng ý AI, rút lại/cho phép gửi câu trả lời đến AI ngoài và tải JSON dữ liệu của chính tài khoản. Bản export không chứa tệp CV gốc hoặc thông tin xác thực.
- API export loại bỏ thông tin xác thực tài khoản và đường dẫn tệp nội bộ; ghi sự kiện audit khi tải dữ liệu.
- Các trang admin và quyền riêng tư được thêm vào điều hướng theo vai trò. API Sprint 9 yêu cầu đăng nhập; API overview yêu cầu role admin.

## API

- `GET /api/sprint9/admin/overview` — tổng quan rủi ro, thống kê và audit, chỉ admin.
- `GET /api/sprint9/privacy/consents` — lịch sử đồng ý của tài khoản hiện tại.
- `GET /api/sprint9/privacy/export` — tải bản sao JSON của dữ liệu tài khoản hiện tại.

## Lưu trữ và giới hạn

Runtime vẫn dùng `data/db.json`, giống server hiện tại. Migration `009_sprint9.*.sql` là schema tham chiếu cho PostgreSQL, chưa được tự động chạy. Bộ lọc rủi ro là luật heuristic, có thể bỏ sót hoặc gắn cờ nhầm; không thay thế kiểm duyệt của con người. Không có xử lý pháp lý/DSAR tự động hoặc cam kết xóa bản sao đã tải xuống.

Mở `http://localhost:3000/sprint9/admin.html` bằng tài khoản admin hoặc `http://localhost:3000/sprint9/privacy.html` bằng tài khoản đã đăng nhập.
