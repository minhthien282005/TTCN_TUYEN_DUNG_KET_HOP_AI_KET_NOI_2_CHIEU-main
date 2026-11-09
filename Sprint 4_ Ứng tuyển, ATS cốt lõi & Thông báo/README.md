# Sprint 4 — Ứng tuyển, ATS cốt lõi và thông báo

Sprint 4 bổ sung luồng ứng tuyển nối từ chi tiết tin việc làm đến trang theo dõi của sinh viên; nhà tuyển dụng quản lý ứng viên trên pipeline ATS; các lần gửi, xem, chuyển giai đoạn, từ chối hoặc rút hồ sơ đều có lịch sử và thông báo.

## Chạy trên VS Code

Mở terminal tại thư mục gốc dự án:

```powershell
npm.cmd start
```

Mở `http://localhost:3000`. Sinh viên vào **Tìm việc → Chi tiết → Ứng tuyển** hoặc mở `/applications.html`. Nhà tuyển dụng vào `/ats.html` sau khi đăng nhập.

Để email xác nhận và email đổi trạng thái được gửi, đặt các biến môi trường trong terminal trước khi chạy server:

```powershell
$env:RESEND_API_KEY = 're_xxx'
$env:MAIL_FROM = 'Ketnoi <no-reply@example.com>'
$env:APP_BASE_URL = 'http://localhost:3000'
npm.cmd start
```

Nếu chưa cấu hình Resend, thông báo trong ứng dụng vẫn hoạt động; email được đánh dấu bỏ qua. CV phải được quét sạch bởi ClamAV ở Sprint 3 trước khi có thể chọn để nộp.

## Luồng đã triển khai

1. Nhà tuyển dụng cấu hình tối đa 10 câu hỏi cho tin đang nhận hồ sơ; câu hỏi chọn đáp án có thể là knock-out và đáp án đúng không lộ ra cho ứng viên.
2. Sinh viên chọn CV đã quét/xử lý, nhập thư ứng tuyển, liên kết portfolio HTTPS và trả lời câu hỏi. API yêu cầu `Idempotency-Key`, chặn hồ sơ trùng theo sinh viên + tin, kiểm tra quyền sở hữu CV và tính điểm kỹ năng heuristic làm tín hiệu ATS ban đầu.
3. Sinh viên xem timeline, lịch sử và rút hồ sơ với lý do trước giai đoạn đề nghị. Nhà tuyển dụng lọc danh sách, xem CV của đúng công ty, xem câu trả lời và chuyển hồ sơ trên Kanban.
4. Pipeline có sáu giai đoạn chuẩn, doanh nghiệp tùy chỉnh tên từng giai đoạn. Mỗi cập nhật cần `expectedVersion`; cập nhật đồng thời cũ sẽ bị từ chối bằng HTTP 409.
5. Lịch sử thao tác, notification in-app và email outbox được lưu riêng. Worker email retry tối đa ba lần và tiếp tục xử lý sau khi server khởi động lại.

## Chạy kiểm tra

```powershell
npm.cmd run check
npm.cmd run test:sprint4
npm.cmd run test:sprint2
npm.cmd run test:sprint3
```

## Giới hạn prototype

- Runtime hiện dùng `data/db.json` và worker cùng tiến trình; migration `migrations/004_sprint4.up.sql` là schema PostgreSQL mục tiêu, chưa áp dụng. Chưa hỗ trợ nhiều instance ghi chung dữ liệu.
- Điểm ứng viên trong ATS là tỷ lệ kỹ năng khớp có trọng số để dùng tạm; không phải matching hai chiều đầy đủ của Sprint 5 và không được dùng để tự động ra quyết định tuyển dụng.
- Email phụ thuộc Resend và cấu hình sender hợp lệ. Worker local không thể cam kết SLA một phút nếu nhà cung cấp thư lỗi hoặc chưa được cấu hình.
- Quyền tải CV kiểm tra chủ sở hữu công ty và hồ sơ ứng tuyển; dữ liệu file vẫn lưu local disk theo thiết kế Sprint 3.

## Tệp chính

- `api.js`: ứng tuyển, câu hỏi sàng lọc, pipeline ATS, quyền CV, thông báo và worker email.
- `apply.html`, `applications.html`, `ats.html`, `notifications.html`: các màn hình Sprint 4.
- `migrations/004_sprint4.up.sql` và `004_sprint4.down.sql`: schema đích và rollback.
- `tests/sprint4.integration.test.js`: kiểm tra tích hợp luồng ứng tuyển, phân quyền và ATS.
- `docs/api.md`, `docs/ban-giao.md`: hợp đồng API và biên bản bàn giao.
