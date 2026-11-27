
# T04 — Xác thực

Người dùng có thể đăng nhập bằng email hoặc số điện thoại tại `/dang-nhap`, yêu cầu đặt lại mật khẩu tại `/quen-mat-khau` và mở liên kết từ email tại `/dat-lai-mat-khau`. API hỗ trợ đổi mật khẩu và đăng xuất mọi thiết bị.

## FR và AC đã đáp ứng

- **FR-03.05, NFR-02:** đăng nhập bằng mật khẩu Argon2id, cookie HttpOnly, phiên gia hạn theo hoạt động và hết hạn sau 7 ngày không dùng. Tài khoản bị khóa 15 phút sau 5 lần đăng nhập sai. Mật khẩu mới có ít nhất 8 ký tự, gồm chữ và số. Liên kết khôi phục hết hạn sau 60 phút và chỉ dùng một lần.
- **FR-03.03 và FR-01.01 (phần xác thực):** lời mời cho tài khoản chờ kích hoạt, đặt mật khẩu để chuyển sang hoạt động, kiểm tra trạng thái tài khoản và doanh nghiệp khi đăng nhập hoặc dùng phiên.
- **AC-01 (phạm vi T04), D-20 và NFR-01:** phiên và liên kết email chỉ gắn với tài khoản đã xác minh. Test HTTP và PostgreSQL kiểm tra đổi mã doanh nghiệp, giả mạo `tenantId` hoặc `userId`, truy cập bằng UUID doanh nghiệp khác và phạm vi thu hồi phiên.
- **NFR-04 và NFR-06 (phạm vi T04):** yêu cầu ghi dữ liệu phải đến từ `WEB_ORIGIN`. Cookie có thuộc tính Secure ở production. Đăng nhập thành công và kích hoạt qua lời mời được ghi vào AuditLog.

## Giả định

- Mã đăng nhập doanh nghiệp là tùy chọn. Điền mã khi email hoặc số điện thoại trùng giữa các doanh nghiệp. Nếu nhiều tài khoản trong cùng doanh nghiệp dùng chung số điện thoại, dùng email để đăng nhập. Tài khoản QTNT để trống mã. Trạng thái bàn giao vẫn sử dụng được phiên.
- Lời mời hết hạn sau 24 giờ. Lệnh nội bộ `auth:invite` gửi lời mời cho tài khoản đã ở trạng thái chờ kích hoạt. Việc tạo tài khoản, duyệt cấp quyền kích hoạt và giới hạn gói thuộc luồng quản trị nhân viên.
- Đổi hoặc đặt lại mật khẩu thu hồi toàn bộ phiên của tài khoản và các liên kết còn hiệu lực. Trang đăng nhập xác nhận phiên đã được tạo. Giao diện hồ sơ và tài khoản nằm trong T06.
- Frontend và API triển khai cùng site để trình duyệt gửi cookie SameSite=Lax. `WEB_ORIGIN` là origin của frontend và `NEXT_PUBLIC_API_URL` trỏ tới API. Runtime dùng role PostgreSQL `educore36_auth` cho xác thực. Migration dùng kết nối bootstrap có quyền tạo role và vượt FORCE RLS để định tuyến danh tính trước khi có phiên.

## Kiểm tra thủ công

1. Trên CSDL local, chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Mở `/dang-nhap`, dùng `adm@demo-a.example` và mật khẩu seed. Kiểm tra cookie HttpOnly trong công cụ phát triển. Gửi 5 lần với mật khẩu sai và thử lại bằng mật khẩu đúng trong thời gian khóa. Dùng số điện thoại đã lưu trên một tài khoản mẫu để kiểm tra đường đăng nhập còn lại.
2. Mở `/quen-mat-khau`, nhập email và kiểm tra Mailpit tại `http://localhost:8025`. Mở liên kết trong thư, lưu mật khẩu mới, kiểm tra đăng nhập với mật khẩu mới rồi thử dùng lại liên kết. Để thử hết hạn ngay, đặt `expires_at` của bản ghi RESET trong CSDL local về quá khứ trước khi mở liên kết.
3. Chuyển một tài khoản mẫu sang `PENDING`, rồi chạy `pnpm --filter @educore36/api auth:invite demo-a adm@demo-a.example` với tài khoản đang chờ tương ứng. Mở thư mời, đặt mật khẩu và đăng nhập. Thử lại với tài khoản `DISABLED` hoặc doanh nghiệp `SUSPENDED` để kiểm tra API trả 401.
4. Đăng nhập qua `POST /auth/login` ở hai thiết bị để nhận hai cookie. Dùng một cookie gửi `POST /auth/change-password` với `currentPassword` và `password`, hoặc `POST /auth/logout-all`. Cả hai phiên cũ phải trả 401 khi dùng lại. Khi gọi bằng công cụ HTTP, gửi `Origin` trùng với `WEB_ORIGIN` và `Content-Type: application/json` cho yêu cầu có body.
5. Đặt `TENANT_INTEGRATION_TEST=true` và `DATABASE_URL` trỏ đến PostgreSQL kiểm thử đã chạy migration. Chạy `pnpm lint`, `pnpm typecheck` và `pnpm test`. Bộ test T04 tạo dữ liệu riêng và kiểm tra trực tiếp API trên PostgreSQL có RLS.

## Kết quả xác minh

- Migration và seed thành công trên CSDL PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt. Có 131 test qua, gồm 10 test tích hợp T04. Hai test tích hợp tùy chọn của T02 dùng Redis và Mailpit được bỏ qua.
- Chrome ở chiều rộng 360 px đã chạy qua đăng nhập bằng email và số điện thoại, kiểm tra cookie HttpOnly, đặt lại mật khẩu và kích hoạt qua thư nhận từ SMTP cục bộ.
