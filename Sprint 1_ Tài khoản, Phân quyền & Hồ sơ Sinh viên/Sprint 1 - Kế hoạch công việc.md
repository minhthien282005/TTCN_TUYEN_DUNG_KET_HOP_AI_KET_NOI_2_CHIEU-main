# Sprint 1 — Tài khoản, Phân quyền & Hồ sơ Sinh viên

**Thời lượng:** 1 tuần (tuần 1 của kế hoạch tổng thể)  
**Mục tiêu:** Người dùng có thể đăng ký, đăng nhập an toàn; sinh viên tạo và cập nhật hồ sơ cơ bản; hệ thống có phân quyền, danh mục dùng chung và môi trường staging để demo.

## Phạm vi chức năng

- **Tài khoản:** AUTH-01, 02, 03, 04, 06, 07, 10, 11, 13, 14, 16.
- **Hồ sơ sinh viên:** SP-01, 02, 03, 04, 05, 07, 10.
- **Quản trị nền tảng:** AD-07 (danh mục cơ bản), AD-12 (audit log nền tảng).
- **Hệ thống:** SYS-01 (khung đa ngôn ngữ), SYS-07 (rate limit).

## Sản phẩm bàn giao

- Đăng ký/đăng nhập hoạt động trên staging; xác minh email, quên/đặt lại mật khẩu và quản lý phiên cơ bản.
- Hồ sơ sinh viên có thể tạo/cập nhật theo từng phần, gồm thông tin, học vấn, kỹ năng, kinh nghiệm, dự án, ngoại ngữ và nguyện vọng.
- Danh mục ngành, trường, địa điểm và kỹ năng được nạp để chọn trong hồ sơ.
- RBAC và kiểm tra quyền sở hữu hồ sơ được áp dụng cho API.
- Khung đa ngôn ngữ, rate limit, audit log nền tảng và email được cấu hình.
- Taxonomy kỹ năng v1 có tên chuẩn, alias và nhóm.

## Danh sách công việc

| ID | Nhóm | Công việc | Kết quả cần có |
|---|---|---|---|
| S1-01 | PM | Chốt backlog Sprint 1 theo phạm vi chức năng; xác nhận tiêu chí chấp nhận, phụ thuộc email/staging và cách demo. | Sprint backlog rõ ưu tiên, người phụ trách và trạng thái. |
| S1-02 | PM | Theo dõi tiến độ/rủi ro; refinement Sprint 2; tổ chức review và retrospective cuối sprint. | Cập nhật tiến độ, quyết định và việc cải tiến được ghi lại. |
| S1-03 | BE | Chi tiết hóa ERD và migration cho users, consents, student profile, education, experience, project, skill, student skill và preferences. | Migration có ràng buộc, chỉ mục cần thiết và phương án rollback. |
| S1-04 | BE | Xây API đăng ký sinh viên/NTD, đăng nhập, refresh/logout, xác minh email, quên/đặt lại mật khẩu, đổi mật khẩu/email. | API có validation, mã lỗi nhất quán và hợp đồng OpenAPI cập nhật. |
| S1-05 | BE | Băm mật khẩu bằng Argon2 hoặc bcrypt; phát hành/kiểm tra token; khóa tạm sau 5 lần đăng nhập sai; áp dụng rate limit. | Không lưu mật khẩu thô; token hết hạn đúng; brute force bị giới hạn. |
| S1-06 | BE | Xây RBAC theo vai trò và middleware kiểm tra quyền sở hữu dữ liệu hồ sơ; ngăn người dùng đọc/sửa hồ sơ người khác. | Các endpoint hồ sơ chỉ cho chủ sở hữu hoặc vai trò được phép truy cập. |
| S1-07 | BE | Xây CRUD hồ sơ sinh viên và các phần học vấn, kỹ năng, kinh nghiệm, dự án, ngoại ngữ, nguyện vọng; hỗ trợ lưu cập nhật từng phần. | Hồ sơ lưu được theo từng phần và trả dữ liệu nhất quán. |
| S1-08 | BE | Xây CRUD/endpoint đọc danh mục ngành, trường, địa điểm, kỹ năng; nạp dữ liệu mẫu. | Danh mục được chuẩn hóa và sẵn sàng cho form hồ sơ. |
| S1-09 | BE | Lưu consent theo mục đích/phiên bản; hỗ trợ xóa mềm tài khoản; ghi audit log cho đăng nhập và thay đổi dữ liệu nhạy cảm. | Có lịch sử đồng ý, trạng thái xóa mềm và log actor/action/time. |
| S1-10 | FE | Xây form đăng ký/đăng nhập, xác minh email, quên/đặt lại mật khẩu và hiển thị lỗi/giới hạn đăng nhập. | Luồng tài khoản dùng được trên giao diện và phản hồi lỗi dễ hiểu. |
| S1-11 | FE | Xây onboarding nhiều bước để thu thập ngành, vị trí, loại hình công việc, địa điểm và nguyện vọng cơ bản. | Người dùng có thể hoàn tất hoặc tiếp tục hồ sơ theo từng bước. |
| S1-12 | FE | Xây trang hồ sơ theo tab/phần: thông tin cá nhân, học vấn, kỹ năng, kinh nghiệm, dự án, ngoại ngữ và nguyện vọng. | Tạo/sửa/lưu từng phần; danh mục được dùng thay cho nhập tự do khi phù hợp. |
| S1-13 | FE | Tích hợp khung đa ngôn ngữ, trạng thái loading/rỗng/lỗi và thông báo lưu thành công; xử lý phiên hết hạn. | Chuỗi giao diện tách khỏi component; người dùng biết trạng thái thao tác. |
| S1-14 | AI | Hoàn thiện taxonomy kỹ năng v1 (tên chuẩn, alias, nhóm) và hàm chuẩn hóa tên đơn giản. | Kỹ năng tương đương được ánh xạ về tên chuẩn; dữ liệu import được kiểm tra. |
| S1-15 | AI | Ghi nhận lựa chọn mô hình LLM/embedding và kế hoạch dữ liệu; thử nghiệm nhanh parse CV/matching nếu điều kiện cho phép. | Báo cáo ngắn về độ phù hợp, giới hạn, chi phí và phương án fallback; không mở rộng thành tính năng parse CV sản phẩm. |
| S1-16 | UX | Hoàn thiện wireframe và prototype cho đăng ký, onboarding, hồ sơ; thống nhất design system ban đầu với FE. | Luồng chính được rà soát và bàn giao trước khi hoàn thiện giao diện. |
| S1-17 | DO | Cấu hình biến môi trường, secrets, email SMTP/SendGrid và deployment staging; không đưa thông tin bí mật vào repository. | Email xác minh/reset gửi được trên staging hoặc có mock được ghi rõ. |
| S1-18 | DO | Hoàn thiện CI cho lint/test/build, log nền tảng SYS-08 và sao lưu cơ bản SYS-09 đã khởi tạo từ Sprint 0. | Pipeline xanh; có log và bản sao lưu thử theo hướng dẫn vận hành. |
| S1-19 | QA | Viết và thực hiện test case AUTH: email trùng, xác minh, token hết hạn, reset mật khẩu, sai mật khẩu 5 lần và rate limit. | Lỗi được ghi nhận có bước tái hiện; không còn lỗi nghiêm trọng trong luồng tài khoản. |
| S1-20 | QA | Kiểm tra RBAC/quyền sở hữu hồ sơ, validation đầu vào, consent, CRUD hồ sơ và danh mục; kiểm tra API bằng Postman. | Người dùng không thể truy cập hồ sơ trái phép; các trường hợp lỗi có phản hồi phù hợp. |
| S1-21 | QA | Chuẩn bị smoke test staging và demo luồng đăng ký → xác minh → onboarding → tạo/cập nhật hồ sơ. | Kịch bản demo chạy được trên staging và có kết quả QA xác nhận. |

## Lịch thực hiện gợi ý

| Thời điểm | Trọng tâm |
|---|---|
| Tuần 1, ngày 1–2 | Refinement; chốt ERD/API; chia việc; khởi tạo migration và khung auth. |
| Tuần 1, ngày 3–5 | Hoàn thiện đăng ký/đăng nhập, token, email; làm form và CRUD hồ sơ theo lát cắt nhỏ. |
| Tuần 2, ngày 1–2 | Hoàn thiện RBAC, consent, danh mục, audit log, rate limit và taxonomy kỹ năng. |
| Tuần 2, ngày 3–4 | Tích hợp FE/BE, kiểm thử API và phân quyền; sửa lỗi; deploy staging. |
| Tuần 2, ngày 5 | Smoke test, demo luồng hoàn chỉnh, review/retro và chốt backlog Sprint 2. |

## Tiêu chí chấp nhận

- Người dùng đăng ký bằng email hợp lệ; email trùng bị từ chối với thông báo phù hợp.
- Mật khẩu được băm Argon2/bcrypt; token có thời hạn và refresh/logout theo thiết kế.
- Xác minh email và quên/đặt lại mật khẩu hoạt động; token xác minh/reset hết hạn đúng.
- Tài khoản bị khóa tạm sau 5 lần nhập sai liên tiếp; rate limit áp dụng cho endpoint nhạy cảm.
- Sinh viên tạo, xem và cập nhật được hồ sơ cơ bản cùng các phần học vấn/kỹ năng/kinh nghiệm/dự án/ngoại ngữ/nguyện vọng.
- Mọi API hồ sơ kiểm tra quyền chủ sở hữu; tài khoản khác không đọc hoặc sửa được hồ sơ.
- Consent được lưu có mục đích và phiên bản; thay đổi dữ liệu nhạy cảm và đăng nhập được ghi audit log.
- Danh mục cơ bản được nạp; taxonomy kỹ năng có tên chuẩn, alias và nhóm.
- Có khung i18n; luồng chính có trạng thái tải, lỗi và thành công.
- Demo được trên staging; CI xanh; API mới có tài liệu; migration có rollback; QA xác nhận không còn lỗi nghiêm trọng mở.

## Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Email staging chưa được cấu hình hoặc bị giới hạn | Dùng SMTP sandbox/mock trong dev; ghi rõ cấu hình staging cần thay thế trước demo. |
| Form hồ sơ dài làm giảm khả năng hoàn tất | Chia thành nhiều bước/tab, lưu từng phần và cho phép tiếp tục sau. |
| Mô hình AI/API ngoài chưa sẵn sàng | Giữ phần thử nghiệm không chặn luồng sản phẩm; ghi phương án fallback và tiếp tục chuẩn bị taxonomy/dữ liệu. |
| Lỗi phân quyền làm lộ hồ sơ | Kiểm tra quyền ở backend cho từng endpoint; QA thử truy cập chéo giữa hai tài khoản. |
| Phạm vi Sprint 1 quá lớn | Ưu tiên đăng nhập, RBAC và hồ sơ cốt lõi; đưa cải tiến không bắt buộc vào backlog thay vì giảm tiêu chuẩn bảo mật. |

## Tham chiếu

Tổng hợp từ tài liệu **PHÂN TÍCH VÀ THIẾT KẾ DỰ ÁN**, phần tổng quan sprint (trang 53–54) và chi tiết Sprint 1 (trang 55–56). Phạm vi mã chức năng theo trang 56; tiêu chí bảo mật và bàn giao được diễn giải thành đầu việc có thể theo dõi trong sprint.
