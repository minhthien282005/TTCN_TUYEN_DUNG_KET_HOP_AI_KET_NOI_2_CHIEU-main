
SPRINT 8 — AI HỖ TRỢ SINH VIÊN

Chức năng
- AI Career Coach dành riêng cho vai trò sinh viên, hiển thị công việc công khai đã xác minh và khoảng trống kỹ năng dựa trên hồ sơ/CV đã quét sạch.
- Tạo lộ trình bốn tuần theo công việc hoặc định hướng nghề nghiệp; gồm kỹ năng ưu tiên, kế hoạch học, sản phẩm minh chứng và gợi ý cập nhật hồ sơ trung thực.
- Luyện phỏng vấn theo công việc: câu hỏi theo kỹ năng tuyển dụng và câu hỏi hành vi/động lực; lưu tiến độ, câu trả lời, điểm cấu trúc STAR và lịch sử buổi tập.
- Góp ý bằng rubric nội bộ. Nếu đã bật đồng ý AI bên ngoài ở Công cụ AI Sprint 5 và cấu hình OPENAI_API_KEY, câu trả lời có thể được gửi tới mô hình để góp ý ngắn; khi không có đồng ý hoặc dịch vụ lỗi, dùng rubric nội bộ.
- Trang `/sprint8/coach.html` được thêm vào menu sinh viên. Dữ liệu buổi tập và lộ trình được xóa cùng tài khoản.

API
- GET `/api/sprint8/coach`
- POST `/api/sprint8/roadmap` với `jobId` tùy chọn
- POST `/api/sprint8/interviews` với `jobId` tùy chọn
- GET `/api/sprint8/interviews/:id`
- POST `/api/sprint8/interviews/:id/answer`

Lưu ý: runtime hiện tại dùng `data/db.json`; migration SQL là schema tham chiếu cho PostgreSQL.
