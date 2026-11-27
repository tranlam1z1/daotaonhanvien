# T12 — Phê duyệt và phiên bản tri thức

## FR/AC đã đáp ứng

- **FR-04.04, AC-03, BR-003, BR-007, BR-012, BR-013, D-04** — Người tạo gửi, rút lại hoặc gửi lại phiên bản. ADM và PD xem trước và quyết định trong phạm vi được cấp. Duyệt xuất bản ngay cho người đọc đúng phạm vi. Người tạo có quyền duyệt trong phạm vi bài dùng được nút **Xuất bản** khi cấu hình tự phê duyệt được bật.
- **AC-04, D-02, FR-11.03 (sự kiện từ chối)** — Bắt buộc nhập lý do, trả phiên bản về Nháp và lưu thông báo cho người tạo. Lý do xuất hiện trên bản nháp và trong chuông thông báo.
- **FR-04.05, AC-03, D-03** — Sửa bài đã xuất bản tạo phiên bản Nháp từ nội dung, phạm vi và liên kết tệp của bản hiện tại. Người đọc tiếp tục thấy bản đã xuất bản đến khi duyệt bản kế tiếp. Người có quyền soạn thảo xem lại bản cũ và tệp trong lịch sử.
- **AC-01, NFR-06** — API dùng phiên đã xác thực, quyền theo phòng ban và RLS theo doanh nghiệp. Mỗi lần duyệt, tự duyệt hoặc từ chối ghi AuditLog cùng giao dịch đổi trạng thái. Quyết định gắn với lượt gửi duyệt cụ thể để một yêu cầu cũ không áp dụng lên lượt gửi lại.

## Giả định

- Quyền gửi duyệt và rút lại thuộc người tạo phiên bản. Với dữ liệu T11, migration dùng người tạo bài làm người tạo phiên bản đã tồn tại. Khi tự phê duyệt tắt, người tạo cần người duyệt khác để xuất bản bài mình gửi.
- PD được giao phòng ban chỉ duyệt phiên bản có toàn bộ phòng ban nằm trong phạm vi được giao. Phạm vi toàn doanh nghiệp hoặc theo chức danh cần quyền duyệt toàn doanh nghiệp, theo cách đánh giá quyền của T11.
- Mỗi bài có tối đa một phiên bản đang soạn hoặc chờ duyệt. Lịch sử hiển thị các phiên bản từng xuất bản trong phạm vi hiện hành của người có quyền soạn thảo.
- Thông báo từ chối dùng chuông trong ứng dụng. Thông báo lưu tiêu đề và lý do tại thời điểm quyết định.

## Kiểm tra thủ công

1. Chạy dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Tắt **Tự phê duyệt** trong cấu hình doanh nghiệp. Chuẩn bị một ADM, một PD được giao phòng ban và một NV trong phòng ban đó.
2. Với ADM, mở **Quản lý nội dung**, tạo bản nháp có phạm vi phòng ban của PD rồi **Gửi duyệt** từ bản xem trước. Mở **Chờ duyệt**, xem trước và **Rút lại**, rồi gửi lại. Dùng phiên NV gọi `GET /knowledge/read/{itemId}` trước khi duyệt và kiểm tra trả `404`.
3. Với PD, mở **Phê duyệt nội dung** và mở bản xem trước. Thử từ chối khi lý do trống, rồi nhập lý do và từ chối. Tạo thêm một bản đích có cả phòng ban ngoài quyền PD và xác nhận bản này không xuất hiện trong hàng chờ của PD.
4. Quay lại tài khoản tạo, mở chuông **Thông báo**, kiểm tra tiêu đề và lý do. Mở bản nháp đã bị từ chối, đối chiếu lý do, sửa và gửi lại. Duyệt bằng PD rồi kiểm tra cùng URL đọc trả `200` cho NV ngay sau quyết định.
5. Trong danh sách bài đã xuất bản, bấm **Sửa bài đã xuất bản**. Đổi tiêu đề, lưu và gửi duyệt. Kiểm tra phiên NV vẫn đọc tiêu đề cũ. Duyệt phiên bản mới, tải lại và kiểm tra tiêu đề mới. Mở **Xem lịch sử** để xem lại nội dung và tệp của phiên bản cũ.
6. Bật **Tự phê duyệt** và soạn một bài mới bằng ADM. Mở bản xem trước, bấm **Xuất bản** rồi kiểm tra NV đọc được ngay. Kiểm tra AuditLog có tác nhân cho các quyết định, gồm lần tự xuất bản.

## Kết quả xác minh

- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt với pnpm 10.32.1. Bộ test mặc định có 94 bài đạt và 130 bài được bỏ qua theo cấu hình.
- `pnpm db:migrate` chạy thành công trên cơ sở dữ liệu PostgreSQL 16 trống.
- Cả 3 bài tích hợp T12 đạt trên cơ sở dữ liệu vừa migrate khi bật `TENANT_INTEGRATION_TEST=true` và chạy `pnpm --filter @educore36/api test knowledge-approval.integration.spec.ts`. Các bài bao phủ chuyển trạng thái, cách ly tenant, phạm vi PD, tự phê duyệt, thông báo từ chối, AuditLog và lịch sử phiên bản.
