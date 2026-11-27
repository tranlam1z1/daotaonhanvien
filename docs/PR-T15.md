# T15 — Thời lượng và điều kiện hoàn thành khóa học

## FR/AC đã đáp ứng

- **FR-05.05** — Cộng thời lượng bài học theo khóa học, cộng thời lượng các khóa học thành phần theo chương trình và cảnh báo khi vượt mục tiêu.
- **FR-05.06, BR-005, D-05** — Lấy mặc định của doanh nghiệp khi tạo khóa học. Cho lưu riêng bốn tiêu chí bật/tắt và chế độ học tuần tự hoặc tự do cho từng khóa.
- **AC-01** — Kiểm tra tài khoản của doanh nghiệp A không thể đọc hoặc sửa dữ liệu đào tạo của doanh nghiệp B qua API.
- **AC-08** — T15 chuẩn bị cấu hình. F08 dùng cấu hình để xét trạng thái lượt học.

## Giả định triển khai

- PRD chưa quy định số giờ đào tạo trong một ngày. Quy đổi 1 giờ = 60 phút và 1 ngày = 24 giờ = 1.440 phút. Cảnh báo khi tổng số phút lớn hơn mục tiêu, kể cả khi chỉ vượt một phút.
- Khóa học mới nhận một bản sao cấu hình mặc định và khởi tạo chế độ tuần tự. Thay đổi mặc định doanh nghiệp về sau áp dụng cho các khóa tạo mới.
- Bản sao khóa học giữ tiêu chí và chế độ học của khóa nguồn tại thời điểm sao chép. Với khóa có trước migration, hệ thống đọc mặc định doanh nghiệp cho đến khi lưu cấu hình lần đầu.

## Kiểm tra thủ công

Trên môi trường local, chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập bằng tài khoản ADM và mở **Đào tạo**.

1. Tạo hai chương trình có mục tiêu lần lượt là 1 giờ và 1 ngày. Dùng bài học có thời lượng cộng lại lần lượt bằng 60 và 1.440 phút. Kiểm tra tổng thời lượng và xác nhận chưa có cảnh báo. Tăng mỗi tổng thêm một phút rồi kiểm tra cảnh báo xuất hiện.
2. Gắn cùng một khóa học vào hai chương trình. Sửa thời lượng, thêm hoặc gỡ một bài học rồi tải lại. Kiểm tra tổng của khóa học và cả hai chương trình. Gỡ khóa học khỏi một chương trình và kiểm tra tổng của chương trình đó giảm xuống.
3. Đổi mặc định doanh nghiệp trong T08 rồi tạo hai khóa học. Kiểm tra cả hai nhận đúng mặc định. Chỉnh tỷ lệ hoàn thành bài, điểm đạt, số lần làm tối đa, các công tắc tiêu chí, xác nhận của QLTT và chế độ học ở một khóa. Tải lại và đối chiếu từng khóa. Đổi mặc định doanh nghiệp lần nữa và kiểm tra hai khóa đã lưu giữ cấu hình riêng.
4. Lấy ID của một chương trình và một khóa học thuộc doanh nghiệp B. Dùng phiên doanh nghiệp A gọi API đọc và sửa theo các ID đó. Kiểm tra các thao tác bị từ chối và dữ liệu doanh nghiệp B giữ nguyên.

## Kết quả xác minh

- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt với pnpm 10.32.1. Bộ test mặc định chạy qua 94 bài, còn 129 bài yêu cầu bật môi trường tích hợp được bỏ qua.
- Migration chạy thành công trên PostgreSQL 16 trống. Cả 12 bài T15 đều đạt khi bật `TENANT_INTEGRATION_TEST=true`, gồm hai bài Supertest kiểm tra lưu và đọc lại qua API cùng cách ly tenant.
