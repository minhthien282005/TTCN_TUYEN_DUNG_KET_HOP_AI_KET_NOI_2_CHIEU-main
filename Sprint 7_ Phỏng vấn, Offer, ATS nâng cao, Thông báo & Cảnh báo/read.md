
SPRINT 7 — PHỎNG VẤN, OFFER, ATS NÂNG CAO, THÔNG BÁO & CẢNH BÁO

Phạm vi đã triển khai
- Nhà tuyển dụng lên lịch phỏng vấn theo hồ sơ ứng tuyển, chọn thời gian, thời lượng, hình thức, địa điểm/liên kết và ghi chú.
- Ứng viên xác nhận hoặc từ chối lời mời. Nhà tuyển dụng có thể hủy lịch hoặc đánh dấu hoàn tất. Các cập nhật được thông báo trong ứng dụng và ghi vào timeline ATS.
- Nhà tuyển dụng gửi offer với khoảng lương, loại hình làm việc, ngày bắt đầu, điều khoản và hạn phản hồi. Ứng viên chấp nhận/từ chối; chấp nhận cập nhật hồ sơ sang hired.
- Dashboard `/sprint7/interviews.html` hiển thị phỏng vấn, offer, hồ sơ cần xử lý cho nhà tuyển dụng, timeline và cảnh báo hồ sơ quá 7 ngày.
- Cảnh báo lịch phỏng vấn trong 24 giờ được tạo một lần cho ứng viên và nhà tuyển dụng khi dashboard được mở. Offer hết hạn được đánh dấu expired.
- API Sprint 7 kiểm tra đăng nhập, vai trò và quyền sở hữu hồ sơ. Dữ liệu JSON runtime có dọn dữ liệu khi xóa tài khoản.
- Có migration PostgreSQL tham chiếu `migrations/007_sprint7.up.sql` và migration rollback tương ứng. Server hiện tại vẫn dùng `data/db.json` giống các sprint trước.

API
- GET `/api/sprint7/dashboard`
- POST `/api/sprint7/applications/:applicationId/interviews`
- POST `/api/sprint7/interviews/:id/{confirm|decline|cancel|complete}`
- POST `/api/sprint7/applications/:applicationId/offers`
- POST `/api/sprint7/offers/:id/{accept|decline}`

Mở trang sau khi chạy server: `http://localhost:3000/sprint7/interviews.html`.
