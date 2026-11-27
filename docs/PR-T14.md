# T14 — Trình dựng chương trình và khóa học

## FR/AC đã đáp ứng

- **FR-05.01** — Tạo và sửa chương trình có tên, mô tả, đối tượng, loại hội nhập/chuyên môn và thời gian mục tiêu theo ngày hoặc giờ.
- **FR-05.02, BR-009** — Tạo khóa học từ chương trình hoặc từ danh sách khóa học. Nhiều chương trình có thể dùng chung một khóa học qua bảng liên kết.
- **FR-05.03, FR-05.04** — Lưu thứ tự module và bài học sau khi kéo thả hoặc dùng nút Lên/Xuống. Mỗi bài có thời lượng theo phút và cấu hình văn bản, tệp tài liệu, video, liên kết tri thức hoặc tham chiếu bài kiểm tra.
- **FR-05.10** — Sao chép trong cùng doanh nghiệp thành khóa học Nháp có mã khóa học, module và bài học riêng. Các liên kết của chương trình nguồn không chuyển sang bản sao.
- **AC-01** — Guard `content.edit` áp dụng phạm vi phòng ban. Các bảng đào tạo dùng RLS và khóa ngoại kèm tenant. Kiểm thử bao phủ danh sách, ghi chương trình/khóa học, mở khóa học, sao chép, tải tệp và các tham chiếu giữa hai doanh nghiệp.
- **AC-17** — Tên, mô tả và nội dung văn bản hiển thị dưới dạng văn bản. Video nhận một tệp hoặc một URL HTTPS đã kiểm tra.

## Giả định

- Đối tượng chương trình là trường văn bản. Phạm vi soạn thảo là toàn doanh nghiệp hoặc một phòng ban, cố định sau khi tạo. Chương trình và khóa học dùng chung khi cùng phạm vi soạn thảo.
- Thời gian mục tiêu là số nguyên dương theo đơn vị ngày hoặc giờ. Thời lượng bài học là số nguyên dương theo phút. Thứ tự bài học được chỉnh trong module hiện tại.
- Tri thức dùng mã bài và kiểm tra lại quyền đọc bản xuất bản hiện hành. Tệp mới do người soạn tải lên qua T10. Có thể giữ tệp đã gắn với khóa học có quyền sửa; bản sao giữ tham chiếu đã được kiểm tra. Các bài kiểm tra cần có bản ghi cùng phạm vi. T14 hỗ trợ chọn và lưu tham chiếu, phần soạn và làm bài thuộc F08.
- Mỗi lần lưu đối chiếu số lần sửa của bản đang mở để phát hiện thay đổi từ phiên khác.

## Kiểm tra thủ công

1. Chạy các dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập `adm@demo-a.example` và mở **Đào tạo**.
2. Tạo một chương trình hội nhập với mục tiêu theo ngày. Tạo khóa học ngay trong chương trình. Tạo chương trình chuyên môn với mục tiêu theo giờ, chọn khóa học vừa tạo, rồi tải lại và kiểm tra hai chương trình cùng hiển thị khóa học.
3. Sửa khóa học. Tạo hai module và ít nhất hai bài trong một module. Kéo đổi thứ tự module và bài học, lưu, tải lại và mở khóa học để kiểm tra. Thử nút **Lên** và **Xuống** ở màn hình hẹp.
4. Lưu bài văn bản, tệp PDF, video tải lên hoặc URL HTTPS, tri thức đã xuất bản và bài kiểm tra cùng phạm vi. Với tệp, chuẩn bị bucket và gói có dung lượng theo [T10](PR-T10.md#kiểm-tra-thủ-công). Với bài kiểm tra, dùng bản ghi `quizzes` trong CSDL kiểm thử hoặc fixture của `training.integration.spec.ts`. Mở lại khóa học để đối chiếu lựa chọn và dùng **Tải tệp đã lưu** để kiểm tra liên kết.
5. Dán một chuỗi có thẻ HTML vào tên khóa học và bài văn bản. Lưu và mở lại để kiểm tra chuỗi hiển thị nguyên văn. Sao chép khóa học, sửa nội dung hoặc thứ tự của bản sao, rồi mở khóa gốc để đối chiếu.
6. Đăng nhập một PTĐT được gán phòng ban và thử mở khóa học ngoài phạm vi bằng mã. Thử dùng mã khóa học, tệp, tri thức hoặc bài kiểm tra của doanh nghiệp khác qua API. Các bài kiểm thử Supertest tái hiện các trường hợp này với hai tenant.

## Kết quả xác minh

- Migration và seed chạy trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đạt. Tổng cộng 216 bài qua, gồm 4 bài tích hợp T14. 8 bài tích hợp cần Redis, Mailpit hoặc MinIO được bỏ qua. Bài T14 xác nhận quyền truy cập trước khi gọi bộ ký URL thử nghiệm.
- Playwright trên Chrome xác nhận kéo thả bằng chuột, thứ tự sau khi tải lại và hiển thị an toàn ở 360 px.
