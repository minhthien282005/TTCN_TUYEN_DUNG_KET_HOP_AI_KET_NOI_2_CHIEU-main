# Biên bản bàn giao Sprint 3

**Dự án:** Ketnoi — nền tảng kết nối tuyển dụng hai chiều  
**Sprint:** Pipeline CV, chuẩn hóa kỹ năng và vector embedding  
**Trạng thái:** Bàn giao prototype để review/demo local; chưa nghiệm thu staging/production.

## Bàn giao

- Trang CV truy cập qua menu trang chủ `/cv.html`.
- Sinh viên có thể tải nhiều CV, đặt CV mặc định, xem trạng thái, rà soát kết quả confidence theo trường, chỉnh giá trị và xác nhận trường muốn ghi vào hồ sơ.
- API có ownership checks cho CV, chứng chỉ, hoạt động và liên kết; file lưu bằng tên ngẫu nhiên trong thư mục riêng và không lộ đường dẫn lưu trữ.
- Queue nền thử lại tối đa ba lần, lưu lỗi giải thích được và phục hồi tác vụ đang dở khi server khởi động lại.
- Profile và job được tạo vector baseline; API admin backfill vector cho dữ liệu cũ. Schema PostgreSQL/pgvector đích nằm trong `migrations/`.

## Chạy và kiểm thử

Tại terminal VS Code ở thư mục gốc:

```powershell
$env:CLAMSCAN_PATH = 'C:\Program Files\ClamAV\clamscan.exe'
npm.cmd start
```

Mở `http://localhost:3000`, đăng nhập sinh viên, chọn **CV & hồ sơ**. Cần cài ClamAV trước khi upload; thiếu scanner thì API từ chối upload.

```powershell
npm.cmd run check
npm.cmd run test:sprint3
```

Kiểm thử tích hợp dùng scanner fixture giả chỉ trong data directory tạm để kiểm tra luồng; fixture không quét virus thật.

## Kết quả và giới hạn

- Parser mặc định dùng rules; có tùy chọn Ollama local cho CV extraction nhưng Ollama chưa có trong môi trường review. OCR PDF scan cần Poppler/Tesseract (tối đa 5 trang), hiện chưa cài hoặc kiểm chứng. Chưa có bộ 50 CV thật được gán nhãn để xác nhận mục tiêu độ đúng ≥85%; 50 fixture hiện có là dữ liệu tổng hợp, không đại diện chất lượng thực tế.
- Mặc định vector 128 chiều `ketnoi-hash-v1` là hashed lexical baseline. Có worker Ollama loopback tùy chọn với queue/retry, nhưng Ollama chưa có trong môi trường review nên chưa nghiệm thu semantic embedding bằng model thật. PostgreSQL/pgvector migration là schema đích, chưa chạy.
- Queue lưu trong JSON và worker nằm cùng tiến trình; chưa có BullMQ/shared worker cho nhiều instance. File CV dùng local disk; chưa có object storage, retention job hoặc quy trình production cho dữ liệu cá nhân.
- Cần QA bằng CV mẫu có đồng ý, PDF nhiều cột/encoding, malware test file trong môi trường scanner an toàn, OCR với gói ngôn ngữ thực, xử lý restart/backup và kiểm thử tải trước khi staging.

## Kết quả kiểm tra lần bàn giao

- `npm.cmd run check`: đạt.
- `npm.cmd run test:sprint3`: đạt 4/4; gồm parser/taxonomy/vector, cấu hình Ollama an toàn, fixture CV tổng hợp và luồng upload/review/confirm/retry.
- `npm.cmd run test:sprint2`: đạt 5/5; tìm kiếm 10.000 tin có p95 71.4 ms trong lần chạy bàn giao.
- ClamAV, Tesseract, Poppler, PostgreSQL và Ollama không được cài trong môi trường kiểm tra này. Scanner giả chỉ dùng trong test cô lập, không xác nhận khả năng quét virus thật.
- Trạng thái bàn giao: prototype local để demo/review; chưa nghiệm thu production. Cần cấu hình ClamAV trước khi upload CV thật.

## Xác nhận

**Người bàn giao:** ____________________  
**Người nhận/reviewer:** ____________________  
**Ngày xác nhận:** ____________________  
**Ghi chú:** ____________________
