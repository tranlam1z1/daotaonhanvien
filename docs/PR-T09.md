# T09 — Quản lý nhân viên

## FR và AC đã đáp ứng

- **FR-03.01** — ADM xem, thêm, sửa và xóa mềm hồ sơ nhân viên. Hệ thống kiểm tra email, mã nhân viên và liên kết phòng ban, chức danh, quản lý trực tiếp trong cùng doanh nghiệp.
- **FR-03.02** — Tải mẫu Excel, kiểm tra và báo số dòng có lỗi trước khi lưu. API kiểm tra lại khi lưu và ghi cả lô trong một giao dịch. Kiểm thử 200 dòng xác nhận đúng 3 dòng lỗi và chỉ lưu cả 200 dòng sau khi sửa và xác nhận.
- **FR-03.03, D-18, AC-02** — Kiểm tra giới hạn gói khi kích hoạt, gửi lời mời đặt mật khẩu và thu hồi phiên khi vô hiệu hóa. Cảnh báo khi số tài khoản hoặc dung lượng đạt 90%. Khi hết chỗ, giao diện hiển thị lỗi và hệ thống gửi email cho ADM đang hoạt động của doanh nghiệp và QTNT đang hoạt động. Kiểm thử hai yêu cầu đồng thời xác nhận chỉ một yêu cầu lấy được chỗ cuối cùng.
- **FR-03.04, NFR-06** — Gán vai trò ADM, PTĐT, PD và phạm vi phòng ban cho PTĐT, PD. Hệ thống bảo vệ ADM đang hoạt động cuối cùng và ghi nhật ký phân quyền, kích hoạt, vô hiệu hóa.
- **AC-01, phần T09** — Kiểm thử hai doanh nghiệp đối với danh sách, mẫu, nhập Excel và mọi API ghi. Nhân viên thường bị từ chối truy cập.
- **AC-17, phần T09** — Kiểm thử giao diện xác nhận tên nhân viên có thẻ HTML được hiển thị nguyên văn.

## Giả định

- Email, mã nhân viên và họ tên là bắt buộc. So sánh email và mã nhân viên không phân biệt hoa thường. Xóa mềm giữ mã và email để bảo toàn lịch sử, áp dụng cho hồ sơ chờ kích hoạt hoặc đã vô hiệu hóa khi đã chuyển hết cấp dưới sang quản lý khác.
- Excel dùng định dạng .xlsx, tối đa 2 MB và 2.000 dòng. Dùng mã ID trong các trang danh mục của mẫu để xác định liên kết, kể cả khi tên trùng. Mã nhân viên và số điện thoại nên giữ định dạng văn bản để bảo toàn số 0 đầu.
- Yêu cầu kích hoạt giữ chỗ ngay khi gửi lời mời. Nhân viên đăng nhập được sau khi đặt mật khẩu. Nếu SMTP gửi lời mời thất bại hoặc lời mời hết hạn, ADM có thể gửi lại cho cùng tài khoản. Tài khoản đang bàn giao vẫn chiếm chỗ và cần lý do để vô hiệu hóa.
- Giới hạn dùng gói gần nhất có trạng thái đang hiệu lực hoặc hết hạn, theo cách hiển thị thuê bao hiện có. Doanh nghiệp chưa có gói cần được gán gói trước khi kích hoạt. Cảnh báo mức sử dụng hiển thị trong màn hình Nhân viên. Thông báo chặn kích hoạt dùng SMTP hiện có, phát sinh theo từng lần bị chặn.
- Phạm vi phòng ban để trống áp dụng cho toàn doanh nghiệp, theo cơ chế phân quyền hiện có.

## Kiểm tra thủ công

1. Khởi động các dịch vụ local, chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập bằng tài khoản seed `adm@demo-a.example`, mở **Nhân viên**, thêm rồi sửa hồ sơ. Thử dùng lại email hoặc mã của nhân viên có sẵn. Thử vô hiệu hóa hoặc bỏ quyền của ADM cuối cùng.
2. Chọn **Nhập Excel**, tải mẫu và điền 200 dòng. Tạo ba lỗi ở ba dòng khác nhau, chẳng hạn email sai, mã đã dùng và phòng ban không hợp lệ. Chọn **Kiểm tra tệp**, đối chiếu số dòng và danh sách nhân viên. Sửa lỗi, chọn lại tệp, kiểm tra rồi chọn **Lưu nhân viên**.
3. Dùng QTNT gán gói có giới hạn bằng số tài khoản đang dùng cộng một. Quay lại màn hình **Nhân viên** của ADM, kích hoạt một hồ sơ và mở thư mời trong Mailpit để đặt mật khẩu. Kích hoạt hồ sơ kế tiếp và kiểm tra lỗi trên giao diện cùng email tới ADM và QTNT. Vô hiệu hóa tài khoản vừa kích hoạt và kiểm tra phiên đăng nhập cũ đã bị thu hồi.
4. Gán PTĐT hoặc PD cho một nhân viên, chọn phạm vi và tải lại để đối chiếu. Đăng nhập lại bằng người dùng doanh nghiệp B để xác nhận danh sách và danh mục của doanh nghiệp A không xuất hiện.

## Kết quả xác minh

- Migration và seed chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đạt. Có 177 bài đạt, gồm 4 bài tích hợp T09. Hai bài tích hợp T02 cần Redis và Mailpit được bỏ qua trong lần chạy này. Các bài T09 kiểm tra người nhận và nội dung email qua SMTP giả lập.
- Một bài Playwright đạt trên Chrome ở chiều rộng 360 px, dùng web, API và PostgreSQL kiểm thử.
