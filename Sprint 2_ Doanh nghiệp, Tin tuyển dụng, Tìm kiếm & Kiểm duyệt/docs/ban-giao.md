# Biên bản bàn giao Sprint 2

**Dự án:** Ketnoi — nền tảng kết nối tuyển dụng hai chiều  
**Sprint:** Doanh nghiệp, tin tuyển dụng, tìm kiếm và kiểm duyệt  
**Ngày lập:** 06/11/2026  
**Trạng thái:** Bàn giao prototype để review và demo local; chưa nghiệm thu staging/production.

## 1. Mục tiêu Sprint

Hoàn thiện luồng từ doanh nghiệp đăng hồ sơ và tin tuyển dụng, admin xác minh/kiểm duyệt, đến sinh viên tìm kiếm và theo dõi tin phù hợp.

## 2. Nội dung bàn giao

- Hồ sơ doanh nghiệp và trạng thái xác minh; upload giấy tờ PDF/PNG/JPEG có kiểm tra định dạng và quét ClamAV trước khi lưu.
- Quản lý tin từ bản nháp, gửi duyệt, công khai, cần chỉnh sửa, từ chối, tạm dừng, hết hạn, đóng đến lưu trữ; hỗ trợ sửa, nhân bản và gia hạn.
- Tìm kiếm tiếng Việt không phân biệt dấu, một số từ đồng nghĩa, các bộ lọc tuyển dụng, sắp xếp và phân trang.
- Sinh viên xem chi tiết, lưu tin theo nhóm/ghi chú, xem lịch sử, chọn chế độ riêng tư hồ sơ và chặn doanh nghiệp.
- Admin xem số liệu, quản lý tài khoản, xác minh doanh nghiệp, duyệt tin và xử lý báo cáo.
- Trang chi tiết có URL thân thiện, canonical, sitemap, robots.txt và dữ liệu cấu trúc JobPosting.
- Hợp đồng API, migration PostgreSQL đích, hướng dẫn chạy, giới hạn triển khai và kiểm thử tích hợp được lưu trong thư mục Sprint 2.

## 3. Cách chạy và trình tự demo

Yêu cầu Node.js 20 trở lên. Mở terminal VS Code tại thư mục gốc repo:

```powershell
npm.cmd start
```

Truy cập `http://localhost:3000`. Nếu server đã chạy từ trước, nhấn `Ctrl+C` trong terminal của server rồi chạy lại lệnh trên để nạp phiên bản code mới. Các trang demo:

1. Trang chủ → **Tìm việc** → lọc và mở chi tiết tin.
2. Đăng nhập nhà tuyển dụng → `/employer.html` → lưu hồ sơ công ty, nộp giấy tờ, tạo nháp/gửi duyệt và theo dõi trạng thái.
3. Đăng nhập admin → `/moderation.html` → xác minh công ty, duyệt/yêu cầu chỉnh sửa/từ chối tin.
4. Đăng nhập sinh viên → `/my-jobs.html` → lưu tin, xem lịch sử và chỉnh quyền riêng tư.
5. Quay lại trang tìm việc để xác nhận tin đã duyệt và còn hạn xuất hiện.

Ứng dụng không có tài khoản admin mặc định. Chỉ để demo local, có thể dừng server, sao lưu `data/db.json` và cấp role `admin` cho tài khoản demo trong dữ liệu local. Không làm thao tác này trên môi trường dùng chung.

## 4. Kết quả kiểm chứng

- `npm.cmd run check`: kiểm tra cú pháp JavaScript, đạt.
- `npm.cmd run test:sprint2`: đạt 5/5 kiểm thử tích hợp trên dữ liệu tạm. Bao gồm quyền truy cập, upload từ chối khi scanner không có, vòng đời tin, tìm kiếm/lọc, lưu tin/lịch sử, admin và hết hạn tự động.
- Tìm kiếm trên bộ dữ liệu kiểm thử 10.000 tin đạt p95 khoảng 52 ms ở lần chạy local gần nhất. Đây không phải benchmark production.
- Kiểm tra trình duyệt trên server mới: trang chủ, tìm việc, chi tiết tin, doanh nghiệp, tin đã lưu và moderation đều trả giao diện; route không yêu cầu đăng nhập hiển thị lời nhắc phù hợp. Lighthouse mobile trang tìm việc: accessibility 96, best practices 100, SEO 100, agentic browsing 100; còn một audit accessibility chưa đạt.
- Server cũ đang giữ cổng 3000 trả 404 cho `/my-jobs.html`, còn server mới nạp code hiện tại trả 200. Cần khởi động lại server khi demo để tránh dùng tiến trình cũ.
- Chưa có baseline screenshot để so sánh hồi quy hình ảnh; chưa xác nhận các luồng UI sau đăng nhập trong trình duyệt bằng tài khoản demo.

## 5. Giới hạn và rủi ro

- Runtime hiện dùng `data/db.json`; không dùng chung dữ liệu cho nhiều server instance. Migration PostgreSQL là schema đích, chưa áp dụng và ứng dụng chưa kết nối PostgreSQL.
- Tìm kiếm hiện quét dữ liệu JSON trong bộ nhớ. p95 trên dữ liệu giả lập local không đảm bảo hiệu năng khi triển khai thật.
- Upload giấy tờ sẽ trả lỗi 503 nếu chưa cài/configure ClamAV (`CLAMSCAN_PATH`). Không tự đánh dấu sạch khi scanner không khả dụng.
- Chưa có tra cứu mã số thuế/domain tự động; admin xác minh thủ công. Tệp lưu local; chưa tích hợp S3/MinIO, URL ký trước, email production hoặc staging.
- Chế độ hiển thị hồ sơ được lưu cho luồng tìm ứng viên sau này; chưa có API để doanh nghiệp tìm ứng viên trong Sprint 2.
- Kiểm thử bảo mật chuyên sâu, kiểm thử trình duyệt đầy đủ với tài khoản, kiểm thử tải production, triển khai staging và diễn tập backup/restore chưa được thực hiện.

Prototype hiện phù hợp để review và trình diễn local theo luồng nghiệp vụ. Chưa đủ điều kiện tuyên bố nghiệm thu production.

## 6. Tài liệu bàn giao

- [`../readme.md`](../readme.md) — hướng dẫn chạy, phạm vi và giới hạn.
- [`api.md`](api.md) — endpoint, trạng thái và validation.
- [`../migrations/002_sprint2.up.sql`](../migrations/002_sprint2.up.sql) và [`../migrations/002_sprint2.down.sql`](../migrations/002_sprint2.down.sql) — PostgreSQL schema đích và rollback.
- [`../tests/sprint2.integration.test.js`](../tests/sprint2.integration.test.js) — kiểm thử tích hợp.

## 7. Xác nhận bàn giao

**Người bàn giao:** ____________________  
**Người nhận/reviewer:** ____________________  
**Ngày xác nhận:** ____________________  
**Ghi chú nghiệm thu:** ____________________
