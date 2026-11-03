# Sprint 0 — Khởi động & Hạ tầng

**Thời lượng:** 1 tuần  
**Mục tiêu:** Chốt yêu cầu và kiến trúc nền tảng, thống nhất công nghệ, chuẩn bị thiết kế và dựng môi trường để Sprint 1 có thể bắt đầu phát triển ngay.

## Phạm vi và đầu ra

- Tài liệu yêu cầu phần mềm (SRS) và backlog đã ưu tiên cho MVP.
- Wireframe các luồng chính và ERD mức tổng quan.
- Quyết định kiến trúc, công nghệ, quy ước làm việc và cấu trúc repository.
- Repository có CI cơ bản; môi trường dev dựng được bằng một lệnh.
- Khởi tạo nền tảng log tập trung (SYS-08) và sao lưu cơ bản (SYS-09).
- Bộ dữ liệu giả lập ban đầu: tối thiểu 50 tin tuyển dụng, 100 hồ sơ sinh viên mẫu và danh sách kỹ năng ban đầu.

## Danh sách công việc

| ID | Nhóm | Công việc | Kết quả cần có |
|---|---|---|---|
| S0-01 | PM | Xác nhận mục tiêu, phạm vi MVP, đối tượng sử dụng, giả định, ràng buộc và các phụ thuộc bên ngoài. | Phạm vi được nhóm thống nhất; các điểm chưa rõ được ghi thành câu hỏi/rủi ro. |
| S0-02 | PM | Chia yêu cầu thành epic/user story, ưu tiên P0/P1/P2, lập backlog Sprint 1 và ghi tiêu chí chấp nhận cho các luồng ưu tiên. | Product backlog có thứ tự và đủ điều kiện refinement. |
| S0-03 | PM | Thống nhất cách làm Scrum, công cụ quản lý việc, lịch daily/review/retro, quy ước nhánh, pull request và Definition of Done. | Quy ước nhóm được ghi trong repository. |
| S0-04 | UX | Vẽ wireframe các luồng cốt lõi: đăng ký/đăng nhập, onboarding và hồ sơ sinh viên, tìm việc, ứng tuyển, ATS cơ bản và quản trị. | Wireframe được nhóm duyệt; trạng thái loading, rỗng và lỗi được thể hiện ở mức cần thiết. |
| S0-05 | UX | Đề xuất design system ban đầu: màu sắc, kiểu chữ, khoảng cách, component và nguyên tắc responsive. | Bộ quy tắc giao diện đủ để bắt đầu Sprint 1. |
| S0-06 | BE | Chọn framework backend; phác thảo kiến trúc module/service, cấu trúc dự án, quy ước API và định dạng lỗi thống nhất. | Tài liệu quyết định kiến trúc (ADR) và khung API. |
| S0-07 | BE | Lập ERD mức tổng quan cho User, StudentProfile, Company, Job, Application, Skill và các quan hệ chính; ghi nhận dữ liệu nhạy cảm và quyền sở hữu dữ liệu. | ERD phiên bản đầu được review, làm cơ sở chi tiết hóa ở Sprint 1. |
| S0-08 | AI | So sánh lựa chọn LLM/embedding phù hợp tiếng Việt, chi phí, khả năng truy cập và phương án dự phòng; thử nghiệm nhanh parse CV/matching nếu có dữ liệu và dịch vụ sẵn. | Ghi chú lựa chọn, giới hạn và phương án fallback; chưa triển khai tính năng AI sản phẩm. |
| S0-09 | AI | Xây taxonomy kỹ năng phiên bản đầu (tên chuẩn, alias, nhóm) và kế hoạch tạo dữ liệu giả lập/thu thập dữ liệu có đồng ý. | Danh sách kỹ năng ban đầu và kế hoạch dữ liệu. |
| S0-10 | DO | Tạo repository, cấu trúc thư mục, README hướng dẫn, mẫu biến môi trường và quy tắc không commit bí mật. | Thành viên có thể clone và làm theo hướng dẫn. |
| S0-11 | DO | Dựng Docker Compose cho các dịch vụ nền tảng đã chốt (PostgreSQL/pgvector, Redis, object storage và queue nếu cần). | Một lệnh dựng môi trường dev; health check xác nhận các dịch vụ sẵn sàng. |
| S0-12 | DO | Tạo CI chạy lint, kiểm tra/build cơ bản; cấu hình dev/staging ở mức khung, quản lý secrets qua biến môi trường. | Pipeline tự chạy khi push/PR và báo trạng thái rõ ràng. |
| S0-13 | DO | Khởi tạo log tập trung (SYS-08), correlation ID ở mức nền tảng và sao lưu cơ bản CSDL (SYS-09); ghi hướng dẫn khôi phục. | Log có thể tra cứu; có bản sao lưu thử và hướng dẫn restore. |
| S0-14 | QA | Xác định chiến lược kiểm thử, công cụ dự kiến và mẫu test case cho các luồng chính; thống nhất cách ghi lỗi. | Kế hoạch kiểm thử và test case khung cho Sprint 1. |
| S0-15 | Cả nhóm | Tạo dữ liệu giả lập ban đầu: tối thiểu 50 tin và 100 hồ sơ; rà soát dữ liệu mẫu không chứa thông tin cá nhân thật. | Bộ dữ liệu mẫu có thể nạp vào môi trường dev. |
| S0-16 | Cả nhóm | Review tài liệu/thiết kế, demo dựng môi trường từ trạng thái sạch, tổng kết rủi ro và chốt backlog Sprint 1. | Biên bản review, danh sách rủi ro và backlog Sprint 1 sẵn sàng. |

## Lịch thực hiện gợi ý

| Thời điểm | Trọng tâm |
|---|---|
| Ngày 1 | Kickoff; chốt phạm vi, công nghệ và các quyết định có ảnh hưởng lớn. |
| Ngày 2 | Hoàn thiện yêu cầu/backlog; phác thảo kiến trúc, ERD và luồng wireframe. |
| Ngày 3 | Dựng repository, Docker Compose, CI; xây taxonomy và dữ liệu mẫu. |
| Ngày 4 | Hoàn thiện wireframe/SRS; thiết lập log, sao lưu; rà soát kiểm thử và rủi ro. |
| Ngày 5 | Dựng môi trường từ đầu, review/demo, sửa lỗi nền tảng và chốt Sprint 1. |

## Tiêu chí hoàn thành (Definition of Done)

- Duyệt SRS/backlog ưu tiên, wireframe và ERD mức tổng quan.
- Công nghệ và kiến trúc nền tảng được chốt; thay đổi về sau cần ghi rõ lý do.
- Thành viên mới có thể làm theo hướng dẫn để dựng toàn bộ môi trường dev bằng một lệnh.
- CI chạy thành công trên repository.
- SYS-08 có log nền tảng; SYS-09 có bản sao lưu thử và hướng dẫn khôi phục.
- Có tối thiểu 50 tin và 100 hồ sơ giả lập cùng taxonomy kỹ năng ban đầu.
- Backlog Sprint 1 có user story, tiêu chí chấp nhận và phụ thuộc đã được làm rõ.

## Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Chưa thống nhất công nghệ làm chậm khởi động | Chốt lựa chọn trong hai ngày đầu; ghi quyết định và hạn chế đổi giữa chừng. |
| Thiếu dữ liệu CV/job hoặc quyền dùng dữ liệu | Dùng dữ liệu giả lập/ẩn danh; không đưa dữ liệu cá nhân thật vào repo. |
| Phụ thuộc API LLM, email hoặc lưu trữ ngoài chưa sẵn sàng | Ghi rõ phụ thuộc, cung cấp cấu hình mock/fallback để môi trường dev vẫn chạy. |
| Phạm vi Sprint 0 phình sang triển khai tính năng | Giới hạn ở nền tảng, thiết kế và thử nghiệm kỹ thuật; tính năng người dùng chuyển backlog Sprint sau. |
