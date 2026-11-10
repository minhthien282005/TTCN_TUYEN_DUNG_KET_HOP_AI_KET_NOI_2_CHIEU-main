# Bàn giao Sprint 5

## Đã triển khai

- Gợi ý việc làm cho sinh viên từ hồ sơ và CV đã quét/phân tích.
- Gợi ý ứng viên cho doanh nghiệp từ các hồ sơ đã bật công khai; giới hạn vào tin đã xuất bản của doanh nghiệp.
- Lý do, kỹ năng khớp và kỹ năng nên bổ sung hiển thị trên từng gợi ý.
- Thông báo in-app và email outbox cho cặp phù hợp mới; worker kiểm tra mỗi phút và có baseline để tránh gửi dồn dữ liệu cũ.
- Trợ lý nghề nghiệp trên trang chủ có tìm việc, xem gợi ý, tư vấn hoàn thiện hồ sơ; hỗ trợ provider sinh tạo tùy chọn sau khi bật đồng ý riêng, có fallback nội bộ.
- Công cụ vai trò riêng để soạn/tối ưu mô tả tuyển dụng, viết câu kinh nghiệm và tóm tắt CV; người dùng xem lại rồi tự sao chép nội dung.
- Điều hướng vai trò và trang `/matches.html` đã được nối vào app.
- Trang chủ có tìm kiếm theo từ khóa/địa điểm, chip tìm nhanh và danh sách công việc mới hoặc gợi ý theo matching của sinh viên.

## Kiểm tra

- Chạy cú pháp JavaScript bằng `node --check` cho API, client chat, công cụ AI, trang chủ, client matching và server.
- Kiểm tra khoảng cách/định dạng thay đổi bằng `git diff --check`.
- Chưa kiểm thử email/provider thật; cần khóa Resend/OpenAI do người vận hành cung cấp để bật dịch vụ ngoài.

## Cần cấu hình khi triển khai

- Resend (`RESEND_API_KEY`, `MAIL_FROM`) cho email notification; in-app không phụ thuộc dịch vụ này.
- OpenAI (`OPENAI_API_KEY`) là tùy chọn, mặc định trợ lý không gửi dữ liệu ra ngoài.
- Dùng PostgreSQL/queue ngoài tiến trình và kiểm định mô hình trước khi dùng sản xuất.
<!-- Note: Sprint 5 update date 10/11/2026. -->
