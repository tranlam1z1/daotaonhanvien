# T22 — Tìm kiếm trong tài liệu PDF và Word

## FR/AC đã đáp ứng

- **FR-04.09, FR-04.06, FR-07.05** — Ô Từ khóa trong Kho tri thức tra cứu tiêu đề, tóm tắt, nội dung bài và văn bản trong tệp PDF, DOCX, DOC đính kèm. Kết quả giữ nguyên bộ lọc danh mục, thẻ và phòng ban. Từ khóa hỗ trợ tiếng Việt và không phân biệt chữ hoa, chữ thường.
- **NFR-01, NFR-03** — Chỉ xét tệp đính kèm của bản hiện hành đã xuất bản mà người đọc có quyền xem. API trả bài tri thức khớp tìm kiếm và giữ quy trình ký link tải tệp như trước. Văn bản trích xuất nằm trong bảng có RLS.

## Giả định triển khai

- Lập chỉ mục phần văn bản PDF và nội dung chính của Word. PDF chỉ có ảnh, tài liệu khóa mật khẩu và tệp không đọc được vẫn tải được nếu hợp lệ theo quy định lưu tệp. Chức năng tìm kiếm trong tệp chỉ áp dụng cho tài liệu tối đa 50 MB và lưu tối đa 200.000 ký tự. Phần XML chính của DOCX tối đa 8 MB.
- Tệp mới được lập chỉ mục khi tải lên. Sau khi chạy migration, vận hành chạy lệnh sau cho mỗi doanh nghiệp có tệp cũ. Lệnh chạy lại an toàn và chỉ xử lý các tệp chưa có chỉ mục. Mã thoát khác 0 cho biết còn tệp cần thử lại hoặc cấu hình cần kiểm tra.

```bash
pnpm --filter @educore36/api files:backfill-search <uuid-doanh-nghiep>
```

## Kiểm tra thủ công

1. Đính kèm một PDF có văn bản và một DOCX hoặc DOC vào bài tri thức, mỗi tệp chứa một cụm từ riêng. Xuất bản bài cho một phòng ban.
2. Đăng nhập bằng nhân viên thuộc phòng ban đó. Tại **Kho tri thức**, tra cứu các cụm từ bằng chữ hoa và áp dụng bộ lọc phòng ban. Kết quả hiển thị đúng bài đã xuất bản.
3. Thử cùng từ khóa bằng tài khoản ngoài phạm vi hoặc thuộc doanh nghiệp khác. Sau đó thay tệp ở bản Nháp và kiểm tra lần nữa trước và sau khi bản mới được duyệt.
4. Chạy `pnpm --filter @educore36/api test --runTestsByPath src/files/document-text.spec.ts src/knowledge/knowledge-library.integration.spec.ts` với `TENANT_INTEGRATION_TEST=true` và PostgreSQL kiểm thử đã chạy migration. Kiểm thử tải lên dùng S3 giả lập, chạy trình trích xuất và truy vấn PostgreSQL thật.
