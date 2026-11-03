# Sprint 1 — Tài khoản, phân quyền và hồ sơ sinh viên

Mã prototype Sprint 1 nằm trong thư mục này:

- `server.js`: HTTP API, đăng ký/xác minh/đăng nhập, session, consent, hồ sơ, taxonomy, audit và giới hạn request.
- `app.js`: giao diện modal tài khoản, onboarding ba bước, dashboard và hồ sơ.
- `migrations/`: schema PostgreSQL mục tiêu cùng migration rollback. Chưa áp dụng; runtime hiện vẫn dùng JSON local.
- `data/skills.json`: taxonomy kỹ năng chuẩn, alias và nhóm.
- `scripts/backup.js`: sao lưu dữ liệu JSON local.
- `.env.example`: mẫu biến môi trường để sao chép ra file `.env` ở root khi cấu hình môi trường.

Chạy từ thư mục gốc bằng `npm.cmd start`; không chạy server từ thư mục này để giữ đúng đường dẫn đến `public/` và `data/`.

## Tài liệu Sprint 1

- [Kế hoạch công việc](Sprint%201%20-%20K%E1%BA%BF%20ho%E1%BA%A1ch%20c%C3%B4ng%20vi%E1%BB%87c.md)
- [Trạng thái bàn giao](docs/delivery-status.md)
- [OpenAPI](docs/openapi.yaml)
- [ERD và thiết kế UX](docs/design-and-erd.md)
- [QA checklist và demo](docs/qa-checklist.md)
- [AI và dữ liệu](docs/ai-and-data-note.md)
- [Vận hành, backup và staging](docs/operations.md)

## Phạm vi prototype

- Đăng ký sinh viên/nhà tuyển dụng, xác minh email, đăng nhập/đăng xuất, khóa đăng nhập sai, quên/đặt lại mật khẩu, đổi email/mật khẩu và xoay phiên.
- Onboarding ba bước; hồ sơ có thông tin, học vấn, kỹ năng, kinh nghiệm, dự án, ngoại ngữ, nguyện vọng, loại hình việc làm và quyền riêng tư.
- API kiểm tra quyền chủ hồ sơ, consent theo mục đích/phiên bản, audit log, xóa mềm tài khoản và giới hạn request.
- Trang chủ responsive; matching, tin tuyển dụng, ứng tuyển và ATS thuộc các sprint sau.

## Giới hạn

`data/db.json` là prototype single-process; lockout/rate limits ở bộ nhớ. Mật khẩu dùng Node `scrypt` thay vì tiêu chí Argon2/bcrypt trong backlog. Email thật cần cấu hình Resend; staging chưa được triển khai và ứng dụng chưa nối PostgreSQL. Không đưa lên internet hoặc chạy nhiều replica trước khi xử lý các mục này. Xem `docs/delivery-status.md`.
