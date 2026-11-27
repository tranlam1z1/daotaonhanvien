# T05 — Phân quyền

T05 bổ sung ma trận quyền, guard áp dụng cho các API cần phiên và `GET /me` để frontend lấy vai trò và phạm vi quyền. Các bài kiểm thử theo bảng bao phủ API công khai, API tài khoản và các quyền trong ma trận III.2.

## FR và AC đã đáp ứng

- **D-01, mục III.2, NFR-03** — Guard dùng vai trò từ phiên đã xác thực. Ma trận hỗ trợ nhiều vai trò và quyền theo phòng ban. Bộ kiểm tra theo ngữ cảnh dùng `manager_id` của nhân viên và người nhận trên từng hạng mục bàn giao.
- **FR-03.04, phần áp dụng quyền** — Guard và `GET /me` sử dụng vai trò và danh sách phòng ban đã lưu. API gán vai trò thuộc task quản trị nhân viên.
- **FR-03.05, phần bảo vệ API tài khoản** — Đổi mật khẩu và đăng xuất mọi thiết bị yêu cầu phiên của chính tài khoản. Các luồng đăng nhập, quên mật khẩu và đặt lại mật khẩu tiếp tục dùng chính sách xác thực hiện có.
- **FR-10.04–FR-10.06, phần kiểm tra quyền** — Có thể kiểm tra người nhận hạng mục, quản lý trực tiếp và quyền ADM của doanh nghiệp hiện tại. Các thao tác trên hồ sơ thuộc task bàn giao.
- **AC-01, NFR-01, D-20, phạm vi T05** — API lấy danh tính từ cookie và bỏ qua định danh hoặc vai trò do client gửi thêm. Test trên PostgreSQL xác nhận phiên doanh nghiệp A chỉ đọc được vai trò của chính tài khoản và guard từ chối mục tiêu của B.

## Giả định

- `GET /me` trả `id`, `tenantId`, `roles` và `permissions`. Mỗi quyền có `scope` và kèm `departmentIds` khi giới hạn theo phòng ban. QLTT và NNBG xuất hiện dưới dạng phạm vi quyền. Phạm vi QLTT hiển thị khi có ít nhất một cấp dưới trực tiếp, còn phạm vi NNBG được xác minh theo từng hạng mục.
- Quyền PTĐT hoặc PD có danh sách phòng ban rỗng áp dụng toàn doanh nghiệp như mục III.2. Với quyền có giới hạn, mục tiêu phải thuộc đầy đủ các phòng ban đã cấp. Quyền tự phục vụ của NV áp dụng mặc định cho mọi tài khoản doanh nghiệp, kể cả tài khoản cũ chỉ lưu ADM, PTĐT hoặc PD.
- Tài khoản ở trạng thái `HANDOVER` được dùng các quyền bàn giao và chức năng tự phục vụ tài khoản `/me`, đổi mật khẩu, đăng xuất. Phiên nền tảng có thể tự phục vụ tài khoản và cần vai trò QTNT đang hiệu lực để có quyền quản trị nền tảng.
- API có tài nguyên truyền bộ phân giải vào `RequirePermission` để đọc mục tiêu theo RLS trước khi xét quyền. Khi triển khai thao tác ghi dựa vào thuộc tính có thể thay đổi của tài nguyên, kiểm tra lại bằng `can` trên dữ liệu mà transaction ghi sử dụng.

## Kiểm tra thủ công

1. Chạy `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev` với CSDL local. Gọi `GET /me` khi chưa đăng nhập và kiểm tra mã 401.
2. Dùng `POST /auth/login` với `Origin` khớp `WEB_ORIGIN` để đăng nhập bằng tài khoản seed `adm@demo-a.example`. Gửi cookie nhận được khi gọi `GET /me`. Kiểm tra `roles` có `NV` và `ADM`, quyền `employees.manage` có phạm vi `tenant` và header `Cache-Control` có `private, no-store`.
3. Thêm `userId` và `tenantId` của doanh nghiệp demo-b vào query của `GET /me` với cookie demo-a. Đối chiếu phản hồi với bước 2. Đăng nhập bằng `qtnt@educore36.local` rồi gọi lại và kiểm tra `tenantId` là `null`, vai trò là `QTNT` và có quyền `platform.manage`.
4. Trỏ `DATABASE_URL` đến PostgreSQL kiểm thử đã chạy migration, đặt `TENANT_INTEGRATION_TEST=true` và chạy `pnpm test`. Bộ test bao phủ truy cập trong và ngoài phạm vi, vai trò bị thu hồi, quản lý trực tiếp, người nhận hạng mục và cách ly doanh nghiệp.

## Kết quả xác minh

- Migration chạy thành công trên PostgreSQL 16 trống.
- `pnpm lint`, `pnpm typecheck` và `pnpm test` đều đạt với `TENANT_INTEGRATION_TEST=true`. 161 test đạt. Hai test tích hợp Redis và Mailpit của T02 được bỏ qua.
