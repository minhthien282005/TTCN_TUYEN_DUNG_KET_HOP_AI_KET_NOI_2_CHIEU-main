# Sprint 2 — Doanh nghiệp, Tin tuyển dụng, Tìm kiếm & Kiểm duyệt

Sprint 2 hoàn thiện luồng đăng tin từ doanh nghiệp đến admin rồi tới sinh viên: hồ sơ và giấy tờ doanh nghiệp, vòng đời tin, tìm kiếm/lọc, xem chi tiết, lưu tin/lịch sử và công cụ quản trị.

Biên bản bàn giao để review/demo nằm tại [`docs/ban-giao.md`](docs/ban-giao.md).

## Chạy trong VS Code

Mở thư mục gốc dự án trong VS Code, chọn **Terminal → New Terminal**, rồi chạy:

```powershell
npm.cmd start
```

Mở `http://localhost:3000`. Dừng server bằng `Ctrl+C`. Kiểm tra cú pháp và chạy kiểm thử tích hợp bằng:

```powershell
npm.cmd run check
npm.cmd run test:sprint2
```

Các trang Sprint 2:

- Tìm việc và lọc nâng cao: `/jobs.html`
- Chi tiết tin: chọn **Xem chi tiết** trong kết quả tìm kiếm
- Hồ sơ công ty và quản lý tin: `/employer.html`
- Tin đã lưu và lịch sử xem: `/my-jobs.html` (sinh viên đã đăng nhập)
- Bảng quản trị và kiểm duyệt: `/moderation.html` (admin)

Đăng ký và xác minh tài khoản nhà tuyển dụng ở trang chủ, đăng nhập, lưu hồ sơ công ty rồi tạo tin nháp hoặc gửi duyệt. Admin có thể được thiết lập cho demo local bằng cách dừng server, sao lưu `data/db.json`, rồi đổi role của tài khoản demo thành `admin`. Không áp dụng cách cấp quyền thủ công này cho môi trường dùng chung.

## Phạm vi đã triển khai

- Hồ sơ doanh nghiệp có thông tin công khai, mã số thuế, chi nhánh, văn hóa, phúc lợi, mạng xã hội và trạng thái xác minh.
- Tải giấy tờ PDF/PNG/JPEG tối đa 5 MB, kiểm tra phần mở rộng/MIME/chữ ký tệp và quét bằng ClamAV trước khi lưu. Thiếu ClamAV thì API từ chối upload (fail closed); admin chỉ tải được giấy tờ sạch qua phiên đăng nhập.
- Tin có bản nháp, chờ duyệt, đã đăng, tạm dừng, cần chỉnh sửa, từ chối, hết hạn, đóng và lưu trữ; kiểm tra quyền sở hữu, hạn đăng tối đa 90 ngày, gia hạn, nhân bản, đóng/mở và tự hết hạn.
- Tiêu chí kỹ năng bắt buộc/ưu tiên và trọng số tổng 100%; thông tin lương, hình thức, cấp bậc, kinh nghiệm, ngoại ngữ, số lượng, yêu cầu, phúc lợi và quy trình tuyển dụng.
- Tìm kiếm không phân biệt dấu tiếng Việt, có một số từ đồng nghĩa như developer/lập trình viên; bộ lọc theo địa điểm, loại việc, lĩnh vực, kỹ năng, lương, ngày đăng, hình thức làm việc, cấp bậc, kinh nghiệm, ngoại ngữ và quy mô công ty; sắp xếp, phân trang và chặn công ty.
- Sinh viên lưu tin theo nhóm/ghi chú, xem lịch sử, chọn chế độ hiển thị hồ sơ và chặn doanh nghiệp. API việc làm công khai không trả thông tin liên hệ riêng hoặc ID chủ sở hữu.
- Admin có số liệu tổng quan, tìm/khóa/mở khóa tài khoản, đặt lại mật khẩu, duyệt giấy tờ công ty, duyệt/yêu cầu sửa/từ chối/gỡ tin và xử lý báo cáo.
- Trang chi tiết có URL thân thiện, canonical, sitemap, robots.txt và dữ liệu có cấu trúc JobPosting.

## Giới hạn triển khai

- Ứng dụng hiện lưu JSON cục bộ trong `data/` để demo. Migration PostgreSQL trong `migrations/` là schema đích, chưa được áp dụng và runtime chưa kết nối PostgreSQL; không dùng chung dữ liệu cho nhiều instance.
- Tìm kiếm hiện quét dữ liệu JSON trong bộ nhớ. Tích hợp PostgreSQL full-text/unaccent hoặc Elasticsearch/OpenSearch vẫn cần triển khai khi chuyển backend.
- Để tải giấy tờ cần cài ClamAV và đặt `CLAMSCAN_PATH` trong môi trường chạy. Không có dịch vụ tra cứu mã số thuế/domain tự động; admin xác minh thủ công dựa trên hồ sơ.
- Tệp hiện lưu trong thư mục riêng trên máy chủ local. Chưa có S3/MinIO, URL ký trước, triển khai cloud, gửi email production hoặc luồng triển khai staging.
- Chế độ hiển thị hồ sơ được lưu cho luồng tìm ứng viên sau này; Sprint 2 chưa có API duyệt danh sách ứng viên cho doanh nghiệp.

## Kiểm chứng hiện tại

`npm.cmd run check` kiểm tra cú pháp JavaScript. `npm.cmd run test:sprint2` kiểm thử API và các luồng chính trên dữ liệu tạm, gồm xác minh/giấy tờ fail-closed, quyền, vòng đời tin, tìm kiếm, quyền riêng tư, admin, tự hết hạn và 10.000 tin giả lập. Kết quả lần kiểm tra gần nhất: 5/5 kiểm thử qua; p95 tìm kiếm 54.1 ms trên máy local trong lần chạy đó. Đây là kiểm thử tích hợp cục bộ, không phải benchmark production hay xác nhận migration PostgreSQL.

## Tệp chính

- `api.js`: API và quy tắc truy cập Sprint 2.
- `jobs.html`, `jobs.js`, `job.html`, `job.js`: tìm kiếm và chi tiết công khai.
- `employer.html`, `employer.js`: hồ sơ công ty và quản lý tin.
- `my-jobs.html`, `my-jobs.js`: tin đã lưu, lịch sử và quyền riêng tư.
- `moderation.html`, `moderation.js`: quản trị và kiểm duyệt.
- `docs/api.md`: hợp đồng API.
- `migrations/002_sprint2.up.sql` và `002_sprint2.down.sql`: schema PostgreSQL đích và rollback.
- `tests/sprint2.integration.test.js`: kiểm thử tích hợp.
