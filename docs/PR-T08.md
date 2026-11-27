# T08 — Quản trị doanh nghiệp

Màn hình **Tổ chức** trong ứng dụng hiển thị hồ sơ, phòng ban, chức danh, cấu hình và thông tin thuê bao của doanh nghiệp đang đăng nhập. ADM có quyền chỉnh sửa. PTĐT, PD và QLTT có quyền đọc theo ma trận phân quyền.

## FR và AC đã đáp ứng

- **FR-02.01** — Cập nhật tên doanh nghiệp, logo, địa chỉ, mã số thuế và thông tin người liên hệ.
- **FR-02.02** — Thêm, đổi tên, di chuyển và ngừng sử dụng phòng ban. API chặn chọn chính phòng ban đó, phòng ban cấp dưới hoặc phòng ban thuộc doanh nghiệp khác làm cấp trên. Thao tác di chuyển đồng thời được kiểm tra trong giao dịch.
- **FR-02.03** — Thêm, sửa và ngừng sử dụng chức danh. Phòng ban và chức danh ngừng sử dụng vẫn giữ liên kết với nhân viên.
- **FR-02.04, BR-012, D-05** — Lưu và đọc lại quyền tự phê duyệt, các tiêu chí hoàn thành mặc định, số ngày nhắc trước hạn và thời hạn bàn giao mặc định.
- **FR-02.05** — Xem gói, ngày hết hạn, số tài khoản đang kích hoạt và giới hạn, cùng dung lượng đã dùng.
- **AC-01, phần T08** — Kiểm thử API với hai doanh nghiệp xác nhận rằng dữ liệu trong truy vấn và nội dung yêu cầu không thay đổi doanh nghiệp của phiên đăng nhập. API chặn sửa danh mục hoặc chọn phòng ban cấp trên thuộc doanh nghiệp khác.
- **AC-17, phần T08** — Giao diện hiển thị tên danh mục dưới dạng văn bản. Kiểm thử trình duyệt nhập tên có thẻ HTML và xác nhận tên hiển thị nguyên văn.

## Giả định

- Logo dùng đường dẫn ảnh HTTPS. Trường logo có thể để trống.
- Phòng ban và chức danh dùng trạng thái **Ngừng sử dụng** để lưu lịch sử và giữ liên kết. Khi ngừng sử dụng một phòng ban, mỗi phòng ban cấp dưới giữ trạng thái riêng. Phòng ban ngừng sử dụng không nhận thêm phòng ban cấp dưới.
- Số ngày nhắc mặc định là 0, tương ứng ngày đến hạn. Thời hạn bàn giao để trống lấy ngày nghỉ việc theo D-16. Các thiết lập này được lưu để các tính năng đào tạo và bàn giao áp dụng.
- Thông tin thuê bao hiển thị gói được gán gần nhất có trạng thái đang hiệu lực hoặc hết hạn. Số tài khoản lấy từ trạng thái thực tế và tính cả tài khoản đang bàn giao theo D-16. Dung lượng đọc từ bộ đếm theo doanh nghiệp, khởi tạo 0 byte trên nền dữ liệu chưa có tệp. Tính năng quản lý tệp sẽ cập nhật bộ đếm khi phát sinh dung lượng.

## Kiểm tra thủ công

1. Chạy dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập bằng `adm@demo-a.example` với mật khẩu seed và mở **Tổ chức**.
2. Sửa hồ sơ, lưu và tải lại trang. Kiểm tra tên, mã số thuế, địa chỉ, người liên hệ và logo. Nhập một đường dẫn logo không dùng HTTPS để kiểm tra lỗi xác thực.
3. Thêm một phòng ban cấp cao nhất và một phòng ban cấp dưới. Di chuyển phòng ban cấp dưới sang một phòng ban khác. Kiểm tra danh sách chọn cấp trên không chứa chính phòng ban đang sửa hay phòng ban cấp dưới của nó.
4. Đổi trạng thái phòng ban **Vận hành** và chức danh **Nhân viên** sang **Ngừng sử dụng**. Kiểm tra các mục vẫn hiển thị sau khi tải lại, với trạng thái mới.
5. Bật tự phê duyệt, sửa phần trăm hoàn thành, điểm đạt, số lần thử, xác nhận thực hành, lịch nhắc và hạn bàn giao. Lưu, tải lại và đối chiếu. Xóa số ngày bàn giao, lưu lại và kiểm tra trường vẫn để trống.
6. Gán một gói cho doanh nghiệp bằng tài khoản QTNT, rồi quay lại **Thông tin thuê bao** dưới tài khoản ADM. Kiểm tra tên gói, ngày hết hạn theo dd/MM/yyyy, số tài khoản và dung lượng.
7. Đăng nhập bằng `ptdt@demo-a.example` để kiểm tra chế độ chỉ xem. Đăng nhập bằng `adm@demo-b.example` và kiểm tra dữ liệu hồ sơ, danh mục và thuê bao riêng của doanh nghiệp B.

## Kết quả xác minh

- Migration và seed chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đạt. Có 173 bài đạt, gồm 7 bài tích hợp T08 trên PostgreSQL. Hai bài tích hợp Redis và Mailpit của T02 được bỏ qua.
- Một bài Playwright đạt trên Chrome ở 360 px với API và PostgreSQL kiểm thử. Bài kiểm tra lưu cấu hình qua lần tải lại, hiển thị văn bản chứa HTML và ngừng sử dụng phòng ban.
