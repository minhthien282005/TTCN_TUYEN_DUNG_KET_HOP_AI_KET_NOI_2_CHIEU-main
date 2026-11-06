# Sprint 3 — Pipeline CV, Chuẩn hóa kỹ năng & Vector Embedding

Sprint 3 thêm trang quản lý CV cho sinh viên, xử lý CV trong worker nền cùng tiến trình Node, màn hình rà soát/xác nhận thông tin, quản lý chứng chỉ/hoạt động/liên kết và vector nội bộ chuẩn bị cho matching.

## Chạy trong VS Code

Mở thư mục gốc dự án trong VS Code → **Terminal → New Terminal**:

```powershell
npm.cmd start
```

Mở `http://localhost:3000`, đăng nhập bằng tài khoản sinh viên rồi chọn **CV & hồ sơ** trên menu hoặc mở `/cv.html`. Nếu server cũ đang chiếm cổng, dừng bằng `Ctrl+C` trước khi chạy lại.

Để tải CV thật, cần cài ClamAV và cấu hình đường dẫn thực thi trước khi khởi động Node:

```powershell
$env:CLAMSCAN_PATH = 'C:\Program Files\ClamAV\clamscan.exe'
npm.cmd start
```

Nếu thiếu ClamAV, API từ chối upload với HTTP 503 và không lưu CV. Không dùng `CLAMSCAN_ARGS_JSON` trong môi trường thật; biến này chỉ dành cho harness kiểm thử.

Để bật OCR cho PDF scan, cài Poppler và Tesseract có gói ngôn ngữ tiếng Việt/Anh rồi cấu hình thêm trước khi khởi động:

```powershell
$env:PDFTOPPM_PATH = 'C:\tools\poppler\Library\bin\pdftoppm.exe'
$env:TESSERACT_PATH = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
$env:TESSERACT_LANGS = 'vie+eng'
npm.cmd start
```

Kiểm tra cú pháp và kiểm thử:

```powershell
npm.cmd run check
npm.cmd run test:sprint3
npm.cmd run test:sprint2
```

## Luồng đã triển khai

1. Sinh viên tải nhiều PDF/DOCX, tối đa 10 MB mỗi file; tối đa 10 CV lưu và 3 tác vụ đang xử lý cùng lúc.
2. Backend xác nhận phần mở rộng, MIME, chữ ký và quét ClamAV. File sạch vào thư mục riêng trong `data/cv-files`; client không nhận đường dẫn file.
3. Worker nền trích xuất PDF có text hoặc DOCX, OCR PDF scan nếu Poppler/Tesseract đã cấu hình, thử lại tối đa 3 lần và lưu trạng thái/lỗi để giao diện theo dõi. Tác vụ `processing` được đưa về hàng đợi khi server khởi động lại.
4. Sinh viên xem giá trị dự đoán, độ tin cậy, nguồn trích xuất; có thể sửa, bỏ chọn và chỉ xác nhận các trường muốn cập nhật. Email trong CV chỉ hiển thị để tham khảo, không thay email đăng nhập.
5. Sinh viên có thể thêm chứng chỉ, giải thưởng/hoạt động và liên kết HTTPS; có thể chọn CV mặc định, tải file của mình hoặc xóa CV. Xóa tài khoản sẽ xóa CV lưu và vector hồ sơ.
6. Hồ sơ được vector hóa sau khi thay đổi; tin được chuẩn hóa kỹ năng và vector hóa sau khi tạo/sửa/kiểm duyệt. Admin có thể backfill dữ liệu cũ bằng `POST /api/sprint3/embeddings/rebuild`. Employer có endpoint phân tích JD heuristic để gợi ý kỹ năng.

## Phạm vi theo yêu cầu Sprint 3

| Mã | Trạng thái prototype |
|---|---|
| SP-06 | Có CRUD chứng chỉ, tổ chức, ngày cấp/hết hạn, mã và URL xác minh. |
| SP-08 | Có danh sách giải thưởng/hoạt động ngoại khóa. |
| SP-09 | Có danh sách liên kết ngoài; chỉ nhận URL HTTPS. |
| SP-11 | Upload nhiều PDF/DOCX, chọn mặc định, giới hạn dung lượng và quét ClamAV fail-closed. |
| SP-12 | Pipeline bất đồng bộ, parser rule-based mặc định và Ollama local tùy chọn, confidence theo trường, chỉnh sửa/xác nhận trước khi ghi hồ sơ. |
| MT-01 | Chuẩn hóa theo taxonomy kỹ năng hiện có, sinh vector baseline và lưu embedding hồ sơ/tin. |
| SYS-05 | Queue cục bộ có trạng thái, tối đa 3 lần thử, khôi phục tác vụ dở khi restart. |

## Giới hạn cần nắm rõ

- Parser mặc định chạy rule-based trong Node. Có thể bật Ollama local qua loopback; nếu model lỗi thì fallback rule-based. Parser đọc PDF có text và DOCX; OCR PDF scan bật tùy chọn qua Poppler/Tesseract, tối đa 5 trang. Chưa hỗ trợ mọi encoding/font PDF. Khi OCR không có hoặc thất bại, hệ thống báo nguyên nhân và retry giới hạn.
- Confidence là mức heuristic của rule parser, chưa được hiệu chuẩn. Chưa có bộ gold set 50 CV đa dạng hoặc phép đo độ đúng ≥85%; không dùng kết quả parser làm quyết định tuyển dụng tự động.
- Vector `ketnoi-hash-v1` có 128 chiều là hashed lexical baseline để chuẩn bị luồng matching; không phải embedding ngữ nghĩa multilingual-e5/BGE-M3 và không nên diễn giải là điểm phù hợp AI.
- Runtime lưu CV, queue và vector trong JSON local. Migration pgvector ở `migrations/003_sprint3.up.sql` là schema đích, chưa được áp dụng; chưa có worker/queue dùng chung giữa nhiều server instance.
- ClamAV chưa có sẵn trong repo. Cần cài scanner thật để upload hoạt động. Scanner giả trong test chỉ dùng trên file tạm của test; nó không quét malware thật.
- CV chứa dữ liệu cá nhân. Không đưa CV thật vào repo/test fixture; runtime local cần được bảo vệ và có quy trình xóa/retention trước khi triển khai.

## Kiểm chứng

`npm.cmd run check` kiểm tra cú pháp. `npm.cmd run test:sprint3` kiểm thử parser DOCX/PDF, chuẩn hóa kỹ năng, vector, quyền truy cập, xác nhận hồ sơ, chứng chỉ/liên kết, retry và lỗi OCR trên dữ liệu tạm. Các kiểm thử không thay thế việc cài ClamAV, kiểm thử với CV thật có đồng ý, bộ gold set, OCR hay benchmark production.

## Tệp chính

- `cv.html`, `cv.js`, `cv.css`, `cv-links.css`: giao diện quản lý CV và rà soát trích xuất.
- `api.js`: upload/quét, worker nền, parser, profile sections, taxonomy và embeddings.
- `migrations/003_sprint3.up.sql`, `003_sprint3.down.sql`: schema đích PostgreSQL/pgvector.
- `tests/sprint3.integration.test.js`: kiểm thử tích hợp cô lập.
- `docs/api.md`, `docs/ban-giao.md`: hợp đồng API và biên bản bàn giao.

## AI cục bộ và embedding ngữ nghĩa (tùy chọn)

Mặc định hệ thống dùng parser rule-based và vector từ khóa `ketnoi-hash-v1`. Nếu đã cài Ollama và tải model chat/embedding, có thể bật phân tích CV và semantic embedding trong PowerShell trước khi chạy server:

```powershell
$env:OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:OLLAMA_CHAT_MODEL = '<model-instruct-da-tai>'
$env:OLLAMA_EMBED_MODEL = 'nomic-embed-text'
npm.cmd start
```

CV gửi tới Ollama chỉ qua loopback. Parser coi CV là dữ liệu không đáng tin, kiểm tra trích đoạn với văn bản nguồn và vẫn yêu cầu sinh viên xác nhận. Worker embedding lưu hash nguồn trong queue (không lưu nội dung CV trong queue), thử lại tối đa ba lần và bỏ kết quả nếu dữ liệu đã thay đổi. Chưa có Ollama trong môi trường review hiện tại nên các model này chưa được chạy nghiệm thu; khi không cấu hình, ứng dụng tự dùng parser/vector baseline.
