# T16 — Phê duyệt và phiên bản khóa học, chương trình

## FR và tiêu chí nghiệm thu

- **FR-05.07, AC-03, BR-003, BR-013** — Khóa học đi qua một lượt duyệt bao gồm toàn bộ module và bài học. Chương trình có lượt duyệt riêng. Phiên bản xuất bản hiện ngay qua API đọc trong đúng phạm vi. F06 chỉ lấy được phiên bản đã xuất bản.
- **AC-04, D-02, FR-11.03 (sự kiện từ chối)** — Từ chối yêu cầu lý do, đưa nội dung về Nháp và gửi thông báo trong ứng dụng cho người tạo. Người tạo thấy lý do trên bản Nháp, có thể sửa và gửi lại.
- **AC-05, D-03, D-09** — Bản Nháp mới không ghi đè phiên bản đang xuất bản. F06 lấy ID phiên bản đã xuất bản mới nhất. F07 đọc đúng phiên bản đã giao theo ID, giữ nội dung, thứ tự module và bài học, tham chiếu và cấu hình hoàn thành đã lưu.
- **AC-01, BR-007, BR-012, D-04, NFR-06** — Giới hạn API theo tenant và phạm vi phòng ban. Tự xuất bản cần cấu hình doanh nghiệp và quyền duyệt. Ghi AuditLog cùng giao dịch duyệt, từ chối hoặc tự duyệt. Mỗi lần gửi duyệt có mã riêng để một quyết định cũ không áp dụng vào lượt gửi lại.

## Giả định

- Dùng phạm vi phòng ban của T14. Bản Nháp cũ thiếu người tạo được gán cho người soạn có quyền khi họ lưu, gửi duyệt hoặc tự xuất bản lần đầu. Bản Nháp phát sinh từ một lần sửa bản đã xuất bản thuộc người thực hiện lần sửa đó.
- Chương trình lưu danh sách ID khóa học theo thứ tự. Duyệt chương trình chỉ xuất bản thông tin chương trình và cấu trúc liên kết. Từng khóa phải được duyệt trước khi có thể phân bổ. Bản khóa học lưu tham chiếu tệp, tri thức và bài kiểm tra bằng ID.
- Phiên bản xuất bản dùng số lần lưu của bản soạn. Các số phiên bản xuất bản có thể không liền nhau.
- API đọc trả thông tin giới thiệu của phiên bản đã xuất bản cho NV đúng phòng ban hoặc toàn doanh nghiệp. API phân bổ trả ID phiên bản cho ADM hoặc PTĐT đúng phạm vi. F07 dùng hàm nội bộ `TrainingApprovalService.assignedCourseVersion` sau khi xác thực lượt học, trong giao dịch cùng tenant. T16 cung cấp các điểm tích hợp này.

## Kiểm tra thủ công

1. Chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Chuẩn bị ADM, PD và NV trong cùng doanh nghiệp. Gán PD một phòng ban và đặt NV vào phòng ban đó. Tắt **Tự phê duyệt**.
2. Dùng ADM mở **Đào tạo**, tạo khóa học có nhiều module và bài học rồi thêm vào một chương trình. Gửi duyệt cả hai. Dùng PD mở **Phê duyệt nội dung**, xem trước và duyệt chương trình. Với phiên NV, gọi `GET /training/read/programs/{id}` và xác nhận trả `200`. Kiểm tra `GET /training/read/courses/{id}` vẫn trả `404` và phiên ADM gọi `GET /training/assignable/courses/{id}` cũng trả `404`. Duyệt khóa học rồi kiểm tra cả hai API khóa học trả `200`.
3. Lưu `versionId` từ API phân bổ. Sửa tên, nội dung và thứ tự bài học rồi gửi duyệt. Xác nhận API đọc và phân bổ vẫn trả phiên bản cũ. Duyệt lại và đối chiếu ID mới. Chạy bài tích hợp T16 để xác nhận truy vấn nội bộ F07 bằng ID cũ vẫn trả đúng nội dung ban đầu.
4. Với một bản đã gửi duyệt, thử **Rút lại** rồi gửi lại. Dùng PD thử gửi lý do trắng qua API và xác nhận `400`, sau đó từ chối với lý do hợp lệ từ giao diện. Dùng tài khoản tạo mở chuông thông báo và đối chiếu lý do trên thẻ Nháp. Sửa rồi gửi lại.
5. Kiểm tra ADM tự xuất bản được khi bật **Tự phê duyệt** và bị chặn khi tắt. Đối chiếu tác nhân trong AuditLog. Dùng phiên PD ngoài phạm vi và phiên doanh nghiệp khác để thử mở bản chờ duyệt hoặc thao tác trực tiếp theo ID.

## Kết quả xác minh

- `pnpm db:migrate` áp dụng thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt với pnpm 10.32.1. Chạy test với `TENANT_INTEGRATION_TEST=true` có 220 bài đạt, gồm 4 bài tích hợp T16, và 8 bài được bỏ qua theo cấu hình.
