# Biên bản bàn giao Sprint 4

**Phạm vi:** ứng tuyển, ATS cốt lõi, câu hỏi sàng lọc, thông báo trong ứng dụng và email outbox.

## Sản phẩm bàn giao

- `/apply.html`: ứng viên chọn CV, viết thư, điền portfolio/câu trả lời và gửi hồ sơ từ chi tiết tin.
- `/applications.html`: timeline và lịch sử; cho phép rút hồ sơ trước khi nhà tuyển dụng gửi đề nghị.
- `/ats.html`: nhà tuyển dụng lọc hồ sơ theo tin/trạng thái, xem hồ sơ và CV, chuyển giai đoạn; tùy chỉnh nhãn pipeline và câu hỏi.
- `/notifications.html`: thông báo theo user, badge chưa đọc, đọc từng thông báo hoặc đọc tất cả.
- API kiểm tra quyền, chống nộp trùng, idempotency, knock-out, optimistic locking, lịch sử stage, outbox email; migration có rollback.

## Cách chạy

```powershell
npm.cmd start
```

Mở `http://localhost:3000`. Sinh viên chọn **Ứng tuyển** sau khi đăng nhập; nhà tuyển dụng mở `/ats.html`. Tải CV yêu cầu ClamAV theo cấu hình Sprint 3.

Muốn bật email Resend trong PowerShell, đặt `RESEND_API_KEY`, `MAIL_FROM` và `APP_BASE_URL` trước `npm.cmd start`. Nếu chưa cấu hình, notification trong app vẫn gửi; email được đánh dấu bỏ qua.

## Kiểm tra

- `npm.cmd run check`: đạt, cú pháp các module Sprint 1–4 hợp lệ.
- `npm.cmd run test:sprint4`: đạt; kiểm thử đăng nhập, screening/knock-out, duplicate/idempotency, ATS filters, CV ownership, optimistic locking, từ chối/rút hồ sơ, notification, account cleanup và route static.
- `npm.cmd run test:sprint2`: đạt 5/5; hồi quy doanh nghiệp, tin việc, tìm kiếm và kiểm duyệt.
- `npm.cmd run test:sprint3`: đạt 4/4; hồi quy parser, CV ownership/review, taxonomy và worker.
- Kiểm tra HTTP với server dùng `DATA_DIR` tạm: `/applications.html`, `/ats.html` và tài nguyên JS/CSS Sprint 4 trả HTTP 200; API dữ liệu chưa đăng nhập trả 401 như yêu cầu.

## Giới hạn và nghiệm thu

- Đây là prototype local trên JSON, chưa chạy staging. PostgreSQL migration chưa được áp dụng; worker outbox nằm cùng tiến trình và chưa an toàn khi chạy nhiều instance.
- Email phụ thuộc cấu hình Resend và chưa được gửi tới hộp thư thật trong kiểm thử. Email giả lập không chứng minh SLA một phút.
- Điểm ATS dựa trên kỹ năng khớp có trọng số để tham khảo; thuật toán matching đầy đủ thuộc Sprint 5.
- Test dùng dữ liệu tổng hợp, không có CV thật hoặc tài khoản người dùng thật.

**Trạng thái đề xuất:** bàn giao prototype Sprint 4 để demo/review local; chưa nghiệm thu production.
