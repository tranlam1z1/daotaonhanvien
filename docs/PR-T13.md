# T13 — Tra cứu và lưu trữ tri thức

## FR/AC đã đáp ứng

- **FR-04.06** — Kho tri thức tìm theo tiêu đề, tóm tắt và phần văn bản của nội dung định dạng. Có thể kết hợp danh mục, thẻ và phòng ban. Danh sách, chi tiết, tệp đính kèm và danh sách chọn bài trong bộ dựng dùng phạm vi của phiên bản công bố hiện tại.
- **FR-04.07, mục VI.1** — Lưu trữ và khôi phục cùng một phiên bản. Bài lưu trữ rời kho tri thức của người học. Người có quyền quản lý vẫn mở được lịch sử và tệp theo phạm vi từng phiên bản. Tham chiếu từ bài học vẫn trỏ đến cùng mã bài. Khóa ngoại chặn xóa vĩnh viễn bài đang được tham chiếu.
- **AC-01** — Kiểm thử hai doanh nghiệp đối với danh sách, chi tiết, tải tệp, lịch sử và các thao tác lưu trữ, khôi phục.
- **AC-03** — Gọi trực tiếp API bằng ID trả về 404 đối với bài nháp, chờ duyệt, lưu trữ hoặc ngoài phạm vi. Khi duyệt qua API T12, bài xuất hiện ngay trong danh sách, tìm kiếm và chi tiết của tài khoản đủ quyền.

## Giả định

- Ma trận III.2 chưa quy định quyền riêng cho lưu trữ, khôi phục. Áp dụng quyền quản lý nội dung của ADM và PTĐT theo phạm vi đã cấp. Khi xem phiên bản cũ, kiểm tra quyền trên cả bài hiện tại và phiên bản được mở.
- Từ khóa là cụm văn bản con, giữ dấu tiếng Việt và bỏ qua khác biệt chữ hoa, chữ thường. Bộ lọc dùng danh mục, thẻ và phòng ban được chọn trực tiếp. Bộ lọc phòng ban khớp các bài có phòng ban đó trong phạm vi công bố.
- Phiên bản có số thứ tự cao nhất trong các bản đã công bố hoặc lưu trữ quyết định khả năng hiển thị. Khi lưu trữ, phiên bản cũ không xuất hiện thay thế. URL tải tệp đã ký trước đó có hiệu lực đến thời điểm hết hạn theo cấu hình T10.

## Kiểm tra thủ công

1. Chạy PostgreSQL và các dịch vụ local, rồi chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Dùng T12 chuẩn bị một bài nháp, một bài chờ duyệt và một bài đã xuất bản. Gắn danh mục, thẻ, một tệp và đặt phạm vi cho một phòng ban.
2. Dùng tài khoản nhân viên trong phòng ban mở **Kho tri thức**. Kết hợp từ khóa với ba bộ lọc. Thử lần lượt từ xuất hiện ở tiêu đề, tóm tắt và phần nội dung. Mở chi tiết và tải tệp. Dùng nhân viên ngoài phạm vi để kiểm tra bài không xuất hiện.
3. Gọi `GET /knowledge/read/{id}` và `GET /knowledge/read/{id}/files/{fileId}` với phiên nhân viên. Kiểm tra mã 404 cho bản nháp, bài chờ duyệt, bài ngoài phạm vi và bài thuộc doanh nghiệp khác. Duyệt bài chờ duyệt bằng T12, sau đó kiểm tra bài xuất hiện ngay cho nhân viên đúng phạm vi.
4. Dùng ADM hoặc PTĐT đúng phạm vi mở **Quản lý nội dung → Đã xuất bản và lưu trữ**. Lưu trữ bài đang có bài học tham chiếu. Kiểm tra bài biến mất khỏi tra cứu, URL chi tiết và tệp trả 404. Mở **Xem lịch sử**, xem phiên bản cũ, rồi khôi phục và kiểm tra bài xuất hiện lại đúng phạm vi.
5. Chạy `pnpm --filter @educore36/api test --runTestsByPath src/knowledge/knowledge-library.integration.spec.ts` với `TENANT_INTEGRATION_TEST=true` và `DATABASE_URL` trỏ vào PostgreSQL kiểm thử đã chạy migration. Bài tích hợp kiểm tra tham chiếu từ bài học được giữ và khóa ngoại chặn xóa vĩnh viễn.

## Kết quả xác minh

- Toàn bộ 14 migration áp dụng thành công trên PostgreSQL 16 trống.
- Các lệnh `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt. Có 215 bài đạt, gồm 4 bài tích hợp T13. Tám bài tích hợp cần dịch vụ phụ trợ được bỏ qua.
