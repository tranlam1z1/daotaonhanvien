# T11 — Danh mục, thẻ và soạn thảo tri thức

## FR/AC đã đáp ứng

- **FR-04.01** — Quản lý danh mục dạng cây và thẻ trong **Quản lý nội dung**. Chặn đặt danh mục dưới chính nó hoặc dưới danh mục hậu duệ. Giữ danh mục và thẻ đang được sử dụng.
- **FR-04.02, NFR-04, AC-17** — Tạo, sửa và xem trước bản nháp có tiêu đề, tóm tắt, rich text, tệp đính kèm và một video tải lên hoặc một liên kết video. Dùng T10 để lưu tệp và cấp URL ký sau khi kiểm tra quyền mở bản nháp và liên kết tệp. Backend lọc HTML trước khi lưu và trả về. Trình soạn thảo nhận nội dung dán dưới dạng văn bản.
- **FR-04.03, mục III.2** — Lưu phạm vi toàn doanh nghiệp, theo phòng ban hoặc theo chức danh. Backend kiểm tra phạm vi của PTĐT khi liệt kê, mở, lưu và tải tệp của bản nháp.
- **AC-01** — Kiểm thử hai doanh nghiệp bao phủ API soạn thảo, danh mục, thẻ, API đọc và tải tệp. Các tham chiếu danh mục, thẻ, tệp, phòng ban và chức danh được kiểm tra trong tenant của phiên.
- **AC-03, phần bản nháp** — API đọc chỉ trả phiên bản đã xuất bản trong phạm vi người đọc. Bản nháp và tệp gắn với bản nháp chỉ mở được qua luồng soạn thảo với quyền tương ứng. Quy trình phê duyệt và xuất bản thuộc T12.

## Giả định

- Danh mục và thẻ dùng chung trong doanh nghiệp. ADM hoặc PTĐT có quyền toàn doanh nghiệp có thể quản lý chúng. PTĐT có phạm vi phòng ban chọn được danh mục, thẻ có sẵn và chỉ lưu được bản nháp mà mọi phòng ban được chọn đều nằm trong phạm vi được giao.
- Danh mục và thẻ được xóa mềm khi không còn được tham chiếu. Danh mục có danh mục con phải chuyển hoặc xóa các mục con trước.
- Phạm vi theo phòng ban và theo chức danh dùng các mục đang hoạt động. Phạm vi và phân loại được lưu trên phiên bản để có thể giữ nguyên thông tin của phiên bản đã xuất bản khi soạn phiên bản mới.
- Bản nháp mới có thể đính kèm tệp do người đang soạn tải lên. Khi sửa, người có quyền được giữ hoặc gỡ tệp đã gắn. Gỡ liên kết chỉ thay đổi bản nháp, tệp vẫn nằm trong kho T10. Video dùng một tệp hoặc một đường dẫn HTTPS, mở qua liên kết.
- Tiêu đề bắt buộc, tóm tắt và nội dung có thể để trống trong bản nháp. Rich text giữ định dạng đoạn, tiêu đề, đậm, nghiêng, trích dẫn và danh sách. Tiêu đề, tóm tắt, tên danh mục và tên thẻ hiển thị dưới dạng văn bản.

## Kiểm tra thủ công

1. Chạy dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Tạo bucket theo [T10](PR-T10.md#kiểm-tra-thủ-công) và dùng QTNT gán gói có dung lượng cho doanh nghiệp mẫu. Đăng nhập `adm@demo-a.example` rồi mở **Quản lý nội dung**.
2. Trong **Danh mục và thẻ**, tạo danh mục cha và con, thêm thẻ. Thử đặt danh mục cha dưới con và xóa danh mục đang có con. Kiểm tra thao tác bị từ chối.
3. Mở **Soạn bản nháp**, nhập tiêu đề và tóm tắt, định dạng một đoạn, chọn danh mục con và thẻ. Chọn phạm vi **Theo phòng ban**, tải PDF và chọn tệp video hoặc nhập liên kết HTTPS. Lưu, tải lại trang và mở **Xem trước**. Đối chiếu dữ liệu, tải PDF qua nút trên bản xem trước rồi sửa phạm vi thành **Theo chức danh** và lưu lại.
4. Gán PTĐT một phòng ban rồi đăng nhập bằng tài khoản đó. Kiểm tra chỉ nhìn thấy bản nháp trong phạm vi và thử truy cập một bản nháp ngoài phạm vi bằng ID. Gọi `GET /knowledge/read/{itemId}` bằng phiên nhân viên và kiểm tra bản nháp trả `404`.
5. Dán HTML có thẻ và sự kiện vào trình soạn thảo, rồi lưu và xem lại. Kiểm tra nội dung dán xuất hiện dưới dạng văn bản. Có thể chạy bài Playwright T11 trên dữ liệu kiểm thử với `WORKSPACE_E2E=true` và `FILE_STORAGE_INTEGRATION_TEST=true` để kiểm tra trình soạn thảo, bản xem trước và tải tệp ở 360 px.

## Kết quả xác minh

- Migration và seed chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đạt với 188 bài, gồm 5 bài tích hợp T11. Hai bài tích hợp T02 cần Redis và Mailpit được bỏ qua.
- Playwright đạt trên Chrome ở 360 px với PostgreSQL và MinIO thực. Bài kiểm tra tạo danh mục và thẻ, soạn thảo an toàn, lưu, mở lại, chỉnh sửa và tải tệp đã gắn qua URL ký.
