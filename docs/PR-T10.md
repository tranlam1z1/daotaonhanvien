# T10 — Lưu trữ tệp cho tri thức và bài học

## FR/AC đã đáp ứng

- **FR-04.02 và FR-05.04, phần tệp và video tải lên** — `POST /files` lưu tệp vào bucket S3 riêng tư, với khóa `tenantId/fileId`. API trả mã tệp, tên, MIME và dung lượng. Handler bài tri thức hoặc bài học gọi `FilesService.downloadForContent` sau khi kiểm tra quyền đọc nội dung và lấy liên kết tệp đã lưu.
- **AC-01, D-20, NFR-01** — `FileObject` có RLS. Backend lấy tenant từ phiên đăng nhập, kiểm tra quyền ADM hoặc PTĐT trong phạm vi được cấp khi tải lên. Kiểm thử chứng minh tenant A không đọc, ghi hoặc lấy URL ký cho tệp của tenant B, kể cả khi biết ID tệp.
- **D-17, NFR-09** — Giới hạn mặc định là 50 MB cho tài liệu và hình ảnh, 500 MB cho video. Khóa dòng doanh nghiệp khi xác nhận dung lượng giúp hai lượt tải lên đồng thời không vượt gói. Bản ghi tệp và bộ đếm cùng được cập nhật trong một giao dịch sau khi S3 lưu thành công.

## Giả định

- MB và GB dùng lũy thừa cơ số 1024, cùng cách quy đổi với màn hình thuê bao. Dung lượng lấy theo gói gần nhất có trạng thái đang hiệu lực hoặc hết hạn, theo cách đọc gói hiện có. Doanh nghiệp cần được gán gói trước khi tải lên.
- Tệp hỗ trợ gồm PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG, JPEG, GIF, WebP, MP4/M4V, MOV và WebM. Backend kiểm tra phần mở rộng và chữ ký định dạng. Với OOXML, backend còn kiểm tra thành phần nhận diện trong ZIP. Xác thực này kiểm tra kiểu tệp ở mức định dạng.
- Bucket do người vận hành tạo và giữ riêng tư. URL tải xuống có hiệu lực 300 giây mặc định và trả tệp dạng đính kèm. T10 cung cấp API tải lên và điểm tích hợp tải xuống phía server. T11 và T14 cung cấp nội dung có liên kết tệp để gọi điểm tích hợp đó.
- PTĐT có phạm vi phòng ban truyền `departmentId` trên URL lúc tải lên. ADM và PTĐT toàn doanh nghiệp có thể tải lên mà bỏ qua tham số này. Quyền tải xuống do nội dung liên kết quyết định.
- Tệp được giữ tạm trên đĩa trong lúc nhận yêu cầu. Khi S3 hoặc giao dịch lỗi, API cố gắng xóa đối tượng chưa đăng ký. Nếu tiến trình dừng đột ngột hoặc kho tệp không nhận lệnh xóa, đối tượng chưa có bản ghi có thể còn trong bucket và cần được đối soát khi vận hành.

## Kiểm tra thủ công

1. Chạy `docker compose up -d`, cập nhật biến S3 trong `apps/api/.env` từ `.env.example`, chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`.
2. Qua giao diện quản trị MinIO ở cổng `9001`, tạo bucket riêng tư theo `S3_BUCKET` (mặc định `educore36-files`). Dùng QTNT gán gói có dung lượng cho doanh nghiệp mẫu.
3. Đăng nhập ADM và dùng cookie phiên gọi `POST /files` với `Origin` là `WEB_ORIGIN` và một trường multipart tên `file`. Ví dụ sau khi lưu cookie phiên vào `session.cookies`:

   ```bash
   curl -i -b session.cookies -H 'Origin: http://localhost:3000' \
     -F 'file=@tai-lieu.pdf' http://localhost:4000/files
   ```

4. Kiểm tra API trả `201`, MinIO có đối tượng dưới tiền tố doanh nghiệp và **Tổ chức → Thông tin thuê bao** tăng đúng số byte. Thử tệp HTML đổi đuôi thành PDF, tệp quá giới hạn cấu hình và tệp vượt dung lượng còn lại. Kiểm tra các yêu cầu lỗi giữ nguyên bộ đếm.
5. Trên PostgreSQL và bucket kiểm thử, bật `FILE_STORAGE_INTEGRATION_TEST=true` rồi chạy `pnpm --filter @educore36/api test files.integration`. Bộ test tự tạo và dọn bucket, dùng handler nội dung chỉ có trong môi trường test để kiểm tra tệp tải về đúng dữ liệu, URL hết hạn và tenant khác bị từ chối. Tình huống tranh chấp giữ chỗ kiểm tra hai lượt tải lên đồng thời với dung lượng chỉ còn đủ cho một tệp.

## Kết quả xác minh

- Migration và seed chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt. Có 183 bài đạt, gồm 6 kiểm thử T10 với PostgreSQL và MinIO thực. Hai bài tích hợp T02 cần Redis và Mailpit được bỏ qua.
- MinIO thực từ chối truy cập trực tiếp vào bucket riêng tư và từ chối URL ký đã hết hạn. Kiểm thử hai lượt tải lên đồng thời xác nhận chỉ một lượt được ghi nhận, với bộ đếm dừng đúng ở giới hạn.
