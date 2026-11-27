# T06 — Khung giao diện ứng dụng

Sau khi đăng nhập, người dùng vào `/ung-dung`. Thanh trên hiển thị tên doanh nghiệp, chuông thông báo và menu tài khoản. Sidebar lấy danh sách mục từ quyền của phiên và thu gọn trên điện thoại. Trang hồ sơ dùng dữ liệu của chính tài khoản từ `GET /me` và API đổi mật khẩu hiện có. Thư viện UI dùng chung gồm nút, ô nhập liệu, bảng, hộp thoại, toast và trạng thái trống.

## FR và AC đã đáp ứng

- **FR-03.05, phần đổi mật khẩu và đăng xuất mọi thiết bị** — Trang hồ sơ kiểm tra mật khẩu xác nhận và gửi mật khẩu hiện tại cùng mật khẩu mới. Sau khi đổi thành công, người dùng quay về trang đăng nhập. Menu tài khoản có thao tác đăng xuất mọi thiết bị.
- **AC-01, phần dữ liệu hồ sơ** — `GET /me` trả thông tin hồ sơ và tên doanh nghiệp từ phiên đã xác thực. Test PostgreSQL kiểm tra rằng khi truyền định danh của doanh nghiệp B, phiên doanh nghiệp A vẫn nhận hồ sơ của chính mình.
- **S01, D-01, NFR-03 và NFR-12** — Khung ứng dụng dùng quyền backend theo ma trận III.2. Test trình duyệt kiểm tra khung, menu, thông báo và hồ sơ ở 360 px.

## Giả định

- Hồ sơ cá nhân hiển thị họ tên, email, số điện thoại, doanh nghiệp và vai trò. T06 có thao tác chỉnh sửa mật khẩu.
- Các mục sidebar dành cho các phân hệ tiếp theo mở trang giữ chỗ. Chuông mở trạng thái thông báo trống.
- Tài khoản QTNT hiển thị “Nền tảng EduCore36” ở vị trí tên doanh nghiệp. QLTT xuất hiện theo quan hệ quản lý trong seed. Quyền NNBG được xác định theo từng hạng mục bàn giao.
- Mốc 360 px áp dụng cho khung và hồ sơ trong T06. PRD dùng FR-07.07 và AC-15 cho luồng học tập, còn AC-18 áp dụng cho landing page.

## Kiểm tra thủ công

1. Chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev` với môi trường local. Mở `/ung-dung/ho-so` khi chưa đăng nhập và kiểm tra trang chuyển đến `/dang-nhap`.
2. Đăng nhập lần lượt bằng các tài khoản dưới đây với mật khẩu seed. Kiểm tra tên trên thanh trên, các mục riêng của từng vai trò và thông tin tài khoản tại **Tài khoản → Hồ sơ cá nhân**.

   | Tài khoản              | Mục tiêu kiểm tra                                                   |
   | ---------------------- | ------------------------------------------------------------------- |
   | `qtnt@educore36.local` | Doanh nghiệp và gói, Đăng ký pilot, Báo cáo nền tảng, Bộ mẫu        |
   | `adm@demo-a.example`   | Nhân viên, Phê duyệt nội dung, Báo cáo đào tạo                      |
   | `ptdt@demo-a.example`  | Quản lý nội dung, Phân bổ đào tạo, Kiểm tra và khảo sát             |
   | `pd@demo-a.example`    | Phê duyệt nội dung, Học tập                                         |
   | `nv1@demo-a.example`   | Xác nhận thực hành, Báo cáo đào tạo trong phạm vi quản lý trực tiếp |
   | `nv2@demo-a.example`   | Kho tri thức, Học tập, Bàn giao                                     |

3. Đặt viewport 360 px. Mở **Menu**, chọn một mục và kiểm tra sidebar thu lại. Mở chuông, kiểm tra trạng thái trống rồi nhấn Escape. Mở hồ sơ và kiểm tra khung vừa theo chiều ngang.
4. Thử đổi mật khẩu với xác nhận khác mật khẩu mới và với mật khẩu hiện tại sai. Sau khi đổi thành công, kiểm tra trang đăng nhập hiện thông báo và đăng nhập lại bằng mật khẩu mới. Khôi phục mật khẩu seed nếu tiếp tục dùng dữ liệu mẫu.
5. Đặt `TENANT_INTEGRATION_TEST=true` để chạy test API trên PostgreSQL kiểm thử. Đặt `WORKSPACE_E2E=true` và chạy `pnpm test:e2e workspace.spec.ts` trên CSDL kiểm thử đã seed.

## Kết quả xác minh

- Migration và seed chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đạt khi bật `TENANT_INTEGRATION_TEST=true`. Có 161 test đạt. Hai test tích hợp Redis và Mailpit của T02 được bỏ qua.
- Chrome chạy đạt 8 test Playwright của T06 ở 360 px, gồm 6 tài khoản seed, truy cập hồ sơ, kiểm tra quyền, đăng xuất và đổi mật khẩu.
