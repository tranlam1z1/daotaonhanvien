# T03 — Lược đồ nền tảng và cách ly tenant

Bổ sung chín bảng nền tảng/nghiệp vụ theo mục VII, migration có phiên bản, seed một QTNT và hai doanh nghiệp (mỗi nơi một ADM, hai NV). Mọi bảng tenant bật ENABLE/FORCE RLS; truy vấn Prisma nghiệp vụ chạy trong transaction với role không sở hữu bảng, không có SUPERUSER/BYPASSRLS và `app.tenant_id` lấy từ phiên backend.

## FR/AC đã đáp ứng

- **AC-01:** Prisma trong ngữ cảnh A không đọc, sửa, xóa dữ liệu B khi biết UUID; kiểm thử cả hai chiều trên Tenant, Subscription, Payment, Department, Position, User, UserRole, AuditLog. Chặn tạo dòng tenant khác, liên kết chéo tenant và đổi tenant của dòng hiện có. Test HTTP dùng controller chỉ có trong test để kiểm chứng interceptor thực tế; không thêm API nghiệp vụ vào sản phẩm.
- **D-20, NFR-01 (phần nền tảng T03):** tenant_id, RLS ở PostgreSQL, transaction theo request và bộ test cách ly dùng chung. Không nhận tenant từ body/query/header. Test xác minh role không bypass/không sở hữu bảng, RLS được bật và FORCE, request đồng thời không rò ngữ cảnh, lỗi rollback.
- **Mục VII:** đủ Tenant, Plan, Subscription, Payment, Department, Position, User, UserRole, AuditLog; UUID, metadata tạo/cập nhật, xóa mềm cho bảng nghiệp vụ. Bổ sung khóa ngoại nullable cho Lead đã có từ T02.
- **FR:** T03 không yêu cầu hoàn thiện FR chức năng nào. Lược đồ hỗ trợ FR-01.01–01.03, FR-02.01–02.05, FR-03.01/03.04 ở các task sau; không tuyên bố hoàn thành các chức năng đó. Không triển khai xác thực T04, phân quyền T05 hay CRUD T07–T09.

## Giả định

- Tenant có `tenant_id = id`. User tenant rỗng là tài khoản nền tảng; UserRole tenant rỗng chỉ nhận QTNT, không có phạm vi phòng ban. AuditLog tenant rỗng dành cho thao tác nền tảng. Ngữ cảnh QTNT trong kết nối tenant không thấy dữ liệu doanh nghiệp hoặc bản ghi nền tảng.
- Phạm vi phòng ban UserRole lưu UUID array theo danh sách trong mục VII; trigger kiểm tra người dùng và mọi phòng ban cùng tenant. Các quan hệ tenant khác dùng khóa ngoại ghép; người ghi thanh toán/actor audit có thể thuộc cùng tenant hoặc nền tảng. Metadata người tạo/cập nhật nullable để hỗ trợ bootstrap/hệ thống.
- Migration và seed dùng tài khoản bootstrap đặc quyền (Compose local là superuser). Runtime nghiệp vụ luôn SET LOCAL ROLE `educore36_tenant`; khi dùng tài khoản kết nối riêng cần cấp membership role này. Kết nối Lead nền tảng T02 được giữ riêng về mục đích sử dụng; không sử dụng trong handler nghiệp vụ tenant.
- T04 sẽ cung cấp `request.user` từ phiên đã xác minh trong guard. Khi có phiên, interceptor mở transaction và đặt tenant; không có tenant thì đóng quyền truy cập dữ liệu nghiệp vụ. Endpoint công khai hiện có không tạo tenant context; getter client nghiệp vụ từ chối truy cập ngoài transaction. Không thêm cách chọn doanh nghiệp bằng HTTP trong T03.
- Seed chỉ phục vụ local, mật khẩu mẫu `EduCore36Local!` hoặc `SEED_PASSWORD`, lưu Argon2id; seed lại giữ nguyên dữ liệu/mật khẩu đã có. Chưa thể đăng nhập trước T04. Gói mẫu là dữ liệu seed, không bổ sung quy tắc tính phí.
- Không có hành động đăng nhập/phân quyền/quản trị mới cần audit trong T03; mới cung cấp bảng AuditLog cho NFR-06 ở các task chức năng sau.
- `RTK.md` được tham chiếu trong hướng dẫn đầu phiên nhưng không có trong repo; áp dụng AGENTS.md hiện có. Giữ nguyên các thay đổi T02 chưa commit của workspace.

## Cách kiểm tra thủ công

1. Sao chép `.env.example` sang `apps/api/.env`, chạy `pnpm install`, `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`. Migration cần quyền tạo role/grant; seed cần tài khoản bootstrap vượt RLS.
2. Chạy `pnpm db:seed` lần hai. Dùng Prisma Studio bằng tài khoản bootstrap xác nhận vẫn có hai Tenant `demo-a`/`demo-b`, một QTNT `qtnt@educore36.local`, sáu người dùng tenant với vai trò ADM/NV. Mật khẩu trong DB là chuỗi `$argon2id$`, không phải văn bản gốc.
3. Trên CSDL kiểm thử, đặt `TENANT_INTEGRATION_TEST=true` rồi chạy `pnpm test`. Bộ test tạo hai tenant bằng UUID riêng và tự dọn; đọc/sửa/xóa theo UUID tenant khác phải bị chặn, kể cả Prisma không truyền bộ lọc tenant.
4. Trong PostgreSQL bằng bootstrap: `BEGIN; SET LOCAL ROLE educore36_tenant; SELECT set_config('app.tenant_id', '<UUID demo-a>', true); SELECT id, tenant_id FROM users; ROLLBACK;`. Chỉ thấy ba nhân viên demo-a; thêm điều kiện `WHERE id = '<UUID nhân viên demo-b>'` phải trả 0 dòng. Không đặt tenant hoặc đặt chuỗi rỗng cũng trả 0 dòng. Role này không được đọc Lead.
5. Với task sau, inject TenantDatabase và dùng `.client` trong callback `.run(...)` hoặc trong request đã có phiên; tái sử dụng fixture/contract trong `apps/api/src/testing`. Không tạo PrismaClient riêng ở handler tenant.
6. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`. CI bật bộ test tenant thật trên PostgreSQL 16; bộ tích hợp T02 bật riêng bằng `LEAD_INTEGRATION_TEST=true` khi có Redis/Mailpit.

## Kết quả xác minh

- Migration từ CSDL trống thành công; `prisma validate` qua. Seed chạy hai lần vẫn có 2 Tenant, 1 QTNT, 6 nhân viên tenant.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` với `TENANT_INTEGRATION_TEST=true`: 121 test qua (17 web, 104 API), gồm 72 test tích hợp RLS/HTTP PostgreSQL thật và 5 test tenant interceptor. Hai test tích hợp dịch vụ T02 bỏ qua vì không bật Redis/Mailpit ở lượt kiểm tra này.
- Local dùng PostgreSQL 18 có sẵn tại cổng kiểm thử riêng vì máy không có Docker executable; không sử dụng CSDL local đang chạy ở cổng 5432. CI cấu hình PostgreSQL 16 và bật test T03; chưa chạy CI từ xa trong phiên này.
