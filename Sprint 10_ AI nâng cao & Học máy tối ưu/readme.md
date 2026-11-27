# Sprint 10 — AI nâng cao & tối ưu xếp hạng

## Phạm vi

- Bổ sung trang `/sprint10/recommendations.html` cho sinh viên và nhà tuyển dụng. Gợi ý hai chiều dùng bộ so khớp Sprint 5 hiện có làm nền.
- Xếp hạng lai: điểm hồ sơ/tin hiện tại, embedding ngữ nghĩa Ollama khi hồ sơ và tin có vector cùng model, và tín hiệu phản hồi riêng của người dùng. Tín hiệu có trọng số giảm dần theo thời gian.
- Người dùng đánh dấu gợi ý hữu ích, ít phù hợp hoặc bỏ đánh giá. Phản hồi được giới hạn theo cặp tin/ứng viên mà tài khoản hiện có quyền xem; không chia sẻ lịch sử phản hồi giữa các tài khoản.
- Trang `/sprint10/quality.html` dành cho admin hiển thị tổng phản hồi và cấu hình embedding để theo dõi bộ xếp hạng.
- Phản hồi của người dùng được xóa cùng tài khoản. Không gửi dữ liệu matching sang AI bên ngoài.

## API

- `GET /api/sprint10/recommendations` — gợi ý đã xếp hạng cho sinh viên hoặc nhà tuyển dụng.
- `POST /api/sprint10/feedback` — lưu `relevant`, `not_relevant` hoặc `clear` cho gợi ý được phép xem.
- `GET /api/sprint10/admin/quality` — thống kê tổng hợp dành cho admin.

## Cách chạy và giới hạn

Sau khi khởi động server, đăng nhập rồi mở `/sprint10/recommendations.html`. Admin mở `/sprint10/quality.html`.

Runtime hiện vẫn dùng `data/db.json`; migration PostgreSQL là schema tham khảo, chưa được chạy. `adaptive-hybrid-v1` là bộ xếp hạng heuristic có cập nhật theo phản hồi, chưa phải mô hình được huấn luyện và đánh giá trên tập dữ liệu tuyển dụng. Điểm xếp hạng không phải xác suất được tuyển. Semantic reranking chỉ bật nếu đã có Ollama embeddings cùng model; nếu không, hệ thống dùng điểm Sprint 5 và phản hồi cá nhân.
