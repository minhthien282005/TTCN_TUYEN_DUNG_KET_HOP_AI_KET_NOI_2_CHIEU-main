# Sprint 3 API

Các endpoint dưới đây yêu cầu session đăng nhập. CV/profile sections và embedding status chỉ dành cho role `student`; JD parser dành cho `employer`; endpoint rebuild embeddings dành cho `admin`. Request/response là JSON, trừ file nội dung được gửi base64 trong JSON. Lỗi trả `{ "error": "..." }`.

## CV và parse

| Method | Path | Tác dụng |
|---|---|---|
| GET | `/api/sprint3/cvs` | Liệt kê CV thuộc tài khoản sinh viên. |
| POST | `/api/sprint3/cvs` | Upload, validate và quét file rồi enqueue parse. Trả HTTP 202. |
| GET | `/api/sprint3/cvs/:id` | Đọc trạng thái và kết quả parse của CV thuộc chính chủ. |
| GET | `/api/sprint3/cvs/:id/file` | Tải lại file CV thuộc chính chủ dưới dạng attachment. |
| POST | `/api/sprint3/cvs/:id/default` | Đặt CV mặc định. |
| POST | `/api/sprint3/cvs/:id/confirm` | Ghi các trường đã người dùng chọn xác nhận vào profile. |
| DELETE | `/api/sprint3/cvs/:id` | Xóa metadata và file riêng của CV thuộc chính chủ. |

Upload body:

```json
{
  "file": {
    "fileName": "resume.pdf",
    "mimeType": "application/pdf",
    "dataBase64": "JVBERi0xLjQ..."
  }
}
```

Chỉ nhận PDF/DOCX tối đa 10 MB, đúng extension/MIME/chữ ký file. Tối đa 10 CV/sinh viên và 3 tác vụ chờ/xử lý đồng thời. Upload cần ClamAV thực sự; scanner unavailable trả 503, file infected trả 400, không ghi file sạch giả. Trạng thái: `queued`, `processing`, `retry_wait`, `review`, `confirmed`, `failed`. Worker retry tối đa 3 lần; kết quả parse cung cấp giá trị, confidence, parser và nguồn heuristic cho từng trường.

Body confirm:

```json
{
  "confirmFields": ["fullName", "phone", "skills", "education", "experiences"],
  "fields": {
    "fullName": "Nguyễn An",
    "phone": "0912345678",
    "skills": ["React", "JS"],
    "education": ["Đại học Hà Nội"],
    "experiences": ["Thực tập Web"]
  }
}
```

Email trích xuất chỉ để tham khảo, không được phép thay email đăng nhập. Chỉ những khóa trong `confirmFields` mới được ghi. Kỹ năng được chuẩn hóa theo taxonomy trong Sprint 1.

## Chứng chỉ, hoạt động và liên kết

| Method | Path | Tác dụng |
|---|---|---|
| GET | `/api/sprint3/profile-sections` | Đọc chứng chỉ, hoạt động và liên kết riêng của mình. |
| PATCH | `/api/sprint3/profile-sections` | Thay thế từng danh sách được gửi: `certifications`, `activities`, `externalLinks`. |

Mỗi danh sách là mảng tối đa theo giới hạn backend; trường `title` bắt buộc. URL liên kết chỉ giữ lại URL `https://`. Gửi `[]` để xóa danh sách tương ứng.

## Job description parser

`POST /api/sprint3/jd/parse` yêu cầu role `employer`, nhận `{ "title": "...", "description": "..." }` và gợi ý title/kỹ năng theo taxonomy với độ tin cậy heuristic. Endpoint chỉ trả gợi ý; nhà tuyển dụng phải rà soát và tự lưu tin.

## Embedding

| Method | Path | Access | Tác dụng |
|---|---|---|---|
| GET | `/api/sprint3/embedding-status` | Student | Trạng thái vector hồ sơ/tin, provider, số tác vụ semantic đang chờ. |
| POST | `/api/sprint3/embeddings/rebuild` | Admin | Tạo/cập nhật vector baseline và xếp hàng semantic nếu đã cấu hình Ollama loopback. |

Vector mặc định `ketnoi-hash-v1` là baseline từ khóa 128 chiều, không phải embedding ngữ nghĩa. Có thể cấu hình `OLLAMA_BASE_URL=http://127.0.0.1:11434` và `OLLAMA_EMBED_MODEL=<model>` để worker gọi Ollama nội bộ; endpoint không phải loopback sẽ bị từ chối. Queue chỉ lưu mã thực thể, model, hash nguồn và trạng thái, retry tối đa 3 lần; dữ liệu đổi trong lúc xử lý thì kết quả cũ bị bỏ. Trường `profileSemanticReady` chỉ true khi vector profile hiện tại được tạo bởi model Ollama đã cấu hình. Không cấu hình Ollama thì ứng dụng chỉ dùng baseline.

Có thể cấu hình thêm `OLLAMA_CHAT_MODEL=<model-instruct>` để worker thử trích xuất CV bằng Ollama cục bộ. Model chỉ được sử dụng khi endpoint loopback; nội dung được đánh dấu là dữ liệu không tin cậy, kết quả phải khớp nguồn ở các trường trích dẫn được và vẫn cần sinh viên xác nhận. Nếu model lỗi, worker ghi cảnh báo và dùng parser rule-based để CV vẫn chuyển sang bước review.

Vector `ketnoi-hash-v1` dài 128 chiều. Dữ liệu không xuất hiện trong API công khai. Đây là baseline hashed lexical, chưa phải vector semantic từ mô hình đa ngôn ngữ.
