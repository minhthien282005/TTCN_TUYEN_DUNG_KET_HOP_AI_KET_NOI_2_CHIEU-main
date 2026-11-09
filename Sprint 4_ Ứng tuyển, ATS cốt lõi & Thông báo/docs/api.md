# Sprint 4 API

Các endpoint yêu cầu session đăng nhập. Endpoint student chỉ nhận vai trò `student`; employer endpoints chỉ nhận `employer`. Lỗi trả `{ "error": "..." }`. Trạng thái lưu trong JSON runtime hiện tại; schema PostgreSQL đích ở `migrations/004_sprint4.up.sql`.

## Student

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/sprint4/jobs/:jobId/apply-data` | Kiểm tra tin còn hiệu lực, câu hỏi công khai, CV đã quét của sinh viên và trạng thái nộp. |
| POST | `/api/sprint4/student/applications` | Nộp hồ sơ; cần `Idempotency-Key` 8–120 ký tự và JSON gồm `jobId`, `cvId`, `coverLetter`, `portfolioLinks`, `answers`. |
| GET | `/api/sprint4/student/applications` | Timeline các hồ sơ của sinh viên hiện tại. |
| POST | `/api/sprint4/student/applications/:id/withdraw` | Rút hồ sơ đang trước trạng thái `offered`; body `{ "reason": "..." }` tối thiểu 5 ký tự. |

Hồ sơ duy nhất theo cặp sinh viên/tin. Cùng idempotency key và cùng request trả lại hồ sơ đã tạo; dùng lại key với request khác trả HTTP 409. `cvId` phải thuộc sinh viên hiện tại, đã quét sạch và có trạng thái parse `review` hoặc `confirmed`. Câu hỏi required phải được trả lời. Nếu knock-out không đạt, hồ sơ được ghi nhận với trạng thái `rejected` và notification thay vì vào pipeline nhà tuyển dụng.

## Employer / ATS

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/sprint4/employer/jobs` | Tin của công ty hiện tại và số đơn. |
| GET/PUT | `/api/sprint4/employer/jobs/:jobId/screening` | Đọc/cấu hình tối đa 10 câu hỏi; dạng `text`, `single_choice`, `boolean`. Knock-out chỉ áp dụng cho lựa chọn có đáp án đúng. API ứng viên không trả đáp án đúng. |
| GET/PUT | `/api/sprint4/employer/pipeline` | Xem hoặc tùy chỉnh tên của 6 giai đoạn chuẩn. |
| GET | `/api/sprint4/employer/applications?jobId=&stage=&q=` | Danh sách hồ sơ chỉ thuộc công ty hiện tại; lọc theo tin, trạng thái, tên/email/kỹ năng. |
| GET | `/api/sprint4/employer/applications/:id` | Xem thông tin ứng viên, câu trả lời, thư, CV và log; lần xem đầu chuyển `submitted` sang `viewed`. |
| GET | `/api/sprint4/employer/applications/:id/cv` | Xem CV đã quét sạch của hồ sơ mà công ty sở hữu. |
| PATCH | `/api/sprint4/employer/applications/:id/stage` | Chuyển pipeline hoặc từ chối; bắt buộc `expectedVersion` để tránh ghi đè thao tác đồng thời. |

Pipeline chuẩn: `submitted → viewed → screening → interview → offered → hired`. Có thể đi tới một giai đoạn phía sau; `rejected` là thao tác kết thúc riêng và cần reason code (`skills`, `experience`, `education`, `screening`, `position_filled`, `other`). `other` yêu cầu ghi chú. Mọi chuyển trạng thái được thêm vào `ApplicationStageLog`; phiên bản cũ nhận HTTP 409.

## Notifications / email

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/sprint4/notifications` | Tối đa 100 notification mới nhất và số chưa đọc của user hiện tại. |
| POST | `/api/sprint4/notifications/:id/read` | Đánh dấu notification thuộc chính user đã đọc. |
| POST | `/api/sprint4/notifications/read-all` | Đánh dấu các notification của user hiện tại đã đọc. |

Notification in-app được lưu đồng bộ với sự kiện ứng tuyển. Email được xếp vào outbox, worker retry tối đa ba lần; nếu `sendMail` không được cấu hình, email chuyển `skipped` còn in-app notification vẫn giữ nguyên.

## Ví dụ nộp hồ sơ

```http
POST /api/sprint4/student/applications
Idempotency-Key: 9f8cc7c4-7ea7-4b14-a59e-ef02d63cd09e
Content-Type: application/json
```

```json
{
  "jobId": "job-uuid",
  "cvId": "cv-uuid",
  "coverLetter": "Tôi muốn ứng tuyển vị trí này...",
  "portfolioLinks": ["https://portfolio.example.test"],
  "answers": [{ "questionId": "question-uuid", "value": "Có" }]
}
```
