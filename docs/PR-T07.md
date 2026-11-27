# T07 — Quản trị nền tảng cơ bản

QTNT quản lý doanh nghiệp, gói thuê bao, thanh toán và đăng ký pilot trong hai mục **Doanh nghiệp và gói** và **Đăng ký pilot**.

## FR và AC đã đáp ứng

- **FR-01.01** — Danh sách và chi tiết doanh nghiệp, tạo, sửa, tạm ngừng và kích hoạt lại. Hệ thống tạo ADM đầu tiên ở trạng thái chờ kích hoạt trong giao dịch tạo doanh nghiệp, rồi gửi email đặt mật khẩu sau khi lưu thành công.
- **FR-01.02** — Xem, tạo và sửa gói gồm tên, giới hạn tài khoản, dung lượng, giá và chu kỳ tháng hoặc năm.
- **FR-01.03** — Gán gói theo khoảng ngày, gia hạn, thay gói và ghi nhận thanh toán thủ công. Lịch sử thuê bao và thanh toán vẫn tra cứu được sau khi thay gói. Các thay đổi thuê bao ghi AuditLog theo **NFR-06**.
- **FR-12.06** — Lọc đăng ký theo trạng thái, người phụ trách và từ khóa. QTNT cập nhật trạng thái, ghi chú, người phụ trách và chuyển đăng ký thành doanh nghiệp từ biểu mẫu điền sẵn. Mỗi đăng ký chỉ liên kết được một lần, kể cả khi xử lý đồng thời.
- **AC-01, phần API T07** — Tài khoản doanh nghiệp A bị chặn ở mọi API quản trị nền tảng, kể cả khi truyền định danh của doanh nghiệp B. QTNT tra cứu thông tin quản trị và số liệu thuê bao tổng hợp. Vai trò PostgreSQL của nền tảng bị chặn khi đọc hồ sơ nhân sự, phòng ban và cấu hình nội bộ.
- **AC-17, phần giao diện quản trị** — Tên, thông tin liên hệ và ghi chú pilot được hiển thị bằng văn bản. Bài kiểm thử trình duyệt xác nhận HTML trong dữ liệu pilot xuất hiện nguyên văn trên danh sách và khi điền sang biểu mẫu.

## Giả định

- Mã đăng nhập là định danh doanh nghiệp. QTNT nhập mã và email ADM khi chuyển đổi pilot. Tên doanh nghiệp, tên liên hệ, số điện thoại và tên ADM được điền từ đăng ký. Thao tác chuyển đổi giữ trạng thái xử lý pilot đã chọn.
- Người phụ trách đăng ký được chọn từ các tài khoản nền tảng đang hoạt động. Khi gửi email mời thất bại, doanh nghiệp và tài khoản chờ kích hoạt đã được lưu. QTNT có thể dùng **Gửi lại lời mời** tại chi tiết doanh nghiệp.
- Thay gói đưa thuê bao hiện tại vào lịch sử ngay khi lưu. Gói mới có kỳ tính theo các ngày đã nhập. Gia hạn giữ cùng thuê bao và yêu cầu ngày kết thúc muộn hơn. Ngày kết thúc bao gồm trọn ngày theo múi giờ Việt Nam. Số tài khoản tính phí hiển thị theo số liệu đã lưu trên thuê bao.

## Kiểm tra thủ công

1. Chạy dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập bằng `qtnt@educore36.local` và mật khẩu seed.
2. Mở **Doanh nghiệp và gói**. Tạo doanh nghiệp với email ADM thử nghiệm. Kiểm tra lời mời trong Mailpit, mở liên kết đặt mật khẩu và đăng nhập bằng ADM. Sửa doanh nghiệp, tạm ngừng rồi thử sử dụng phiên ADM đang mở. Kích hoạt lại và kiểm tra ADM đăng nhập được.
3. Tạo rồi sửa một gói. Tại chi tiết doanh nghiệp, gán gói với ngày bắt đầu và kết thúc, gia hạn, ghi nhận một thanh toán rồi đổi gói. Kiểm tra khoản thanh toán vẫn nằm trong thuê bao cũ và ngày hiển thị theo định dạng dd/MM/yyyy.
4. Gửi một đăng ký pilot từ trang chủ. Trong **Đăng ký pilot**, thử lọc, phân công, nhập ghi chú và đổi trạng thái. Chọn **Chuyển thành doanh nghiệp**, kiểm tra các trường điền sẵn, bổ sung mã đăng nhập và email ADM, rồi lưu. Mở lại danh sách và kiểm tra đăng ký đã được chuyển. Nhập chuỗi HTML vào tên hoặc ghi chú pilot để xác minh chuỗi hiển thị nguyên văn.
5. Đăng nhập bằng `adm@demo-a.example`, mở trực tiếp `/ung-dung/doanh-nghiep` và gọi `GET /platform/companies` bằng phiên đó. Kiểm tra màn hình báo thiếu quyền và API trả 403.

## Kết quả xác minh

- Migration và seed đã chạy trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt. Có 166 bài kiểm thử đạt khi bật `TENANT_INTEGRATION_TEST=true`, gồm 5 bài tích hợp T07. Hai bài tích hợp Redis và Mailpit của T02 được bỏ qua. Bài tích hợp T07 dùng bộ gửi thư giả lập để kiểm tra lời mời, kích hoạt và gửi lại khi SMTP lỗi.
- Hai bài kiểm thử Playwright chạy đạt trên Chrome ở 360 px. Bài kiểm tra pilot sử dụng dữ liệu trả về giả lập. Bài kiểm tra sửa doanh nghiệp gọi API thật trên PostgreSQL kiểm thử.
