# Biên bản bàn giao Sprint 1

**Dự án:** Ketnoi — nền tảng kết nối tuyển dụng hai chiều  
**Sprint:** Tài khoản, phân quyền và hồ sơ sinh viên  
**Ngày lập:** 06/11/2026  
**Trạng thái:** Bàn giao prototype để review; chưa nghiệm thu staging/production.

## 1. Mục tiêu Sprint

Tạo nền tảng tài khoản cho sinh viên và nhà tuyển dụng; hỗ trợ sinh viên khởi tạo hồ sơ, khai báo định hướng nghề nghiệp và kiểm soát quyền riêng tư. Các chức năng matching, tin tuyển dụng, ứng tuyển và ATS thuộc sprint tiếp theo.

## 2. Nội dung đã bàn giao

- Đăng ký hai vai trò, consent khi đăng ký, xác minh email, đăng nhập/đăng xuất, khóa tạm sau 5 lần sai, quên/đặt lại mật khẩu, đổi email/mật khẩu và API xoay phiên.
- Onboarding ba bước và hồ sơ sinh viên gồm thông tin cá nhân, học vấn, kỹ năng, kinh nghiệm, dự án, ngoại ngữ, nguyện vọng, loại hình việc làm, địa điểm và chế độ hiển thị.
- API hồ sơ giới hạn theo tài khoản hiện đăng nhập; endpoint hồ sơ từ chối vai trò nhà tuyển dụng. Có API danh mục, chuẩn hóa alias kỹ năng, lịch sử consent, audit log và xóa mềm tài khoản.
- Giao diện trang chủ responsive, điều hướng cho hai nhóm người dùng, form tài khoản và hồ sơ. Ví dụ cơ hội trên trang chủ được ghi là minh họa.
- OpenAPI, ERD/schema PostgreSQL up/down, taxonomy kỹ năng v1, ghi chú AI/dữ liệu, hướng dẫn vận hành và checklist QA.

## 3. Cách chạy và demo

Yêu cầu Node.js 20 trở lên. Từ thư mục gốc repo:

```powershell
npm.cmd start
```

Mở `http://localhost:3000`. Đăng ký tài khoản demo, mở liên kết xác minh được hiển thị trong giao diện local rồi đăng nhập. Demo onboarding, cập nhật hồ sơ và kiểm tra tài khoản nhà tuyển dụng không đọc được API hồ sơ sinh viên. Dừng server bằng `Ctrl+C`.

Kiểm tra cú pháp:

```powershell
npm.cmd run check
```

## 4. Kết quả kiểm tra đã thực hiện

- `npm.cmd run check`: đạt.
- Smoke flow cô lập: đăng ký, xác minh, đăng nhập sinh viên; lưu và PATCH hồ sơ; alias kỹ năng được chuẩn hóa; nhà tuyển dụng nhận 403 khi gọi API hồ sơ.
- Trang chủ đã được mở ở desktop và mobile; Lighthouse ghi nhận accessibility 95, SEO 100, best practices 100 ở cả hai kích thước.
- Checklist QA đầy đủ trong `qa-checklist.md` chưa được chạy; workflow CI chưa có kết quả chạy được lưu trong repo.

## 5. Giới hạn và rủi ro cần xử lý

- Runtime hiện lưu `data/db.json`; lock đăng nhập và rate limit nằm trong bộ nhớ tiến trình. Migration PostgreSQL mới là schema mục tiêu, chưa được áp dụng.
- Mật khẩu dùng Node `scrypt`, khác tiêu chí Argon2/bcrypt trong backlog.
- Email thật cần Resend API key và sender đã xác minh. Chưa có thông tin host, database hoặc secrets để triển khai staging.
- Danh mục ngành/trường/địa điểm là dữ liệu mẫu đọc tĩnh; chưa có màn hình/API CRUD cho quản trị danh mục.
- Giao diện hiện chỉ có tiếng Việt; bản dịch/i18n đầy đủ chưa làm.

Prototype này phù hợp để review và demo local. Chưa đủ điều kiện đưa lên internet, chạy nhiều replica hoặc đánh dấu Sprint 1 đã nghiệm thu.

## 6. Việc cần hoàn tất trước khi chốt Sprint

1. Chạy và ghi kết quả từng case trong `qa-checklist.md`, sửa các lỗi phát hiện.
2. Chốt giải pháp password hashing, PostgreSQL, session và rate limit dùng chung.
3. Cấu hình Resend và host HTTPS staging qua secret manager.
4. Áp dụng migration, chạy smoke test đăng ký → xác minh → onboarding → cập nhật hồ sơ trên staging, lưu kết quả QA.
5. Nhóm bổ sung người phụ trách, quyết định review/retro và backlog Sprint 2; các thông tin này chưa có trong repo nên không được tự điền.

## 7. Tài liệu bàn giao

- `Sprint 1 - Kế hoạch công việc.md` — phạm vi và tiêu chí chấp nhận.
- `docs/delivery-status.md` — trạng thái từng đầu việc S1-01 đến S1-21.
- `docs/openapi.yaml` — hợp đồng API prototype.
- `docs/design-and-erd.md` và `migrations/` — thiết kế dữ liệu và schema mục tiêu.
- `docs/qa-checklist.md` — test case và kịch bản demo.
- `docs/operations.md` — chạy local, email, backup và staging handoff.
