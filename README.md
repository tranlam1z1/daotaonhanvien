# EduCore36

Monorepo và landing page theo PRD-EDU-001 v1.1. Chưa có chức năng nghiệp vụ sau đăng nhập.

## Cấu trúc repo

```text
.github/workflows/  # CI
apps/web/           # Next.js
apps/api/           # NestJS và Prisma
packages/shared/    # Kiểu dữ liệu và hằng số dùng chung
docs/               # PRD, task, thiết kế và mô tả PR
tests/e2e/          # Playwright
```

Các lệnh pnpm và Docker Compose chạy tại gốc repo. Compose cố định project name là `educore36` để tên tài nguyên không phụ thuộc tên thư mục clone.

## Chạy local

Cần Node.js 22.14+ (khuyến nghị Node 22 LTS), pnpm 10.32.1 và Docker Compose v2. Chạy các lệnh ngay tại thư mục gốc repo `daotaonhanvien`:

```powershell
Copy-Item .env.example apps/api/.env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Đợi PostgreSQL healthy trước khi migrate. Web: http://localhost:3000 (landing page); API: http://localhost:4000/health trả JSON `{"status":"ok"}`. `API_PORT` có thể đặt trong môi trường shell; API và Prisma đọc `apps/api/.env`. API cần `LEAD_NOTIFY_EMAIL`; Redis và SMTP được dùng cho đăng ký pilot T02. T10 cần bucket S3 riêng tư theo `S3_BUCKET` (mặc định `educore36-files`). Tạo bucket qua console MinIO trước khi thử tải tệp. Xem [các bước kiểm tra T10](docs/PR-T10.md#kiểm-tra-thủ-công).

PostgreSQL :5432, Redis :6379, MinIO :9000 (console :9001), Mailpit SMTP :1025 (web :8025). Tài khoản local nằm trong Compose và `.env.example`, chỉ dùng phát triển. Không commit `.env`.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm --filter @educore36/web build
pnpm --filter @educore36/api build
```

`test` chạy unit test kiểm tra form web và kiểm thử HTTP thật của Nest qua Supertest; `test:e2e` tự khởi động cả hai app và kiểm tra bằng Chromium. Health là liveness công khai, không truy vấn dữ liệu tenant. T03 mới bổ sung dữ liệu, RLS và kiểm thử cách ly.

Migration đầu tiên chỉ có chú thích SQL và ghi nhận baseline trong `_prisma_migrations`; migration T02 tạo bảng Lead cấp nền tảng. Seed chủ ý không tạo dữ liệu. Prisma Client được sinh khi `pnpm install`; sau khi sửa schema, chạy `pnpm --filter @educore36/api exec prisma generate`. Dùng `pnpm --filter @educore36/api exec prisma migrate dev --name <name>` khi phát triển migration tiếp theo.

CI ở `.github/workflows/ci.yml` tại gốc Git chạy install với lockfile, migration trên PostgreSQL 16 trống, seed, lint, typecheck và test; có Redis 7 và Mailpit để chạy kiểm thử tích hợp T02. Chưa cấu hình triển khai.

## Landing page (T01)

Trang `/` chuyển từ bản thiết kế `docs/design/landing-educore36.html`, có menu di động, tab vai trò, FAQ và form đăng ký. Trang `/chinh-sach-bao-mat` hiện là khung cần hoàn thiện. Nút Đăng nhập dẫn tới `/dang-nhap` (T04).

Form gọi `POST /public/leads` tại `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:4000`), kết nối API thật của T02. `pnpm test` chạy unit test web và test HTTP API. `pnpm test:e2e --workers=2` kiểm tra tương tác, responsive, success/XSS và lỗi mạng, lưu ảnh ở `test-results/t01-*.png`.

SEO dùng `SITE_URL` (mặc định http://localhost:3000). Khi chuẩn bị triển khai, tạo `apps/web/.env.local` có `SITE_URL=https://<ten-mien-thuc>` rồi build lại; xác nhận thông tin liên hệ, cam kết tiếp thị và hoàn thiện chính sách trước khi công bố. Font được phục vụ từ `/fonts`, kèm giấy phép OFL.

## API đăng ký pilot (T02)

Đặt `LEAD_NOTIFY_EMAIL` trong `apps/api/.env` thành email QTNT cần nhận thông báo. SMTP local mặc định là Mailpit `localhost:1025`; mở http://localhost:8025 để xem thư. Nếu nâng cấp từ T01, bổ sung các biến mới từ `.env.example`, chạy `pnpm install` và `pnpm db:migrate` trước `pnpm dev`.

Để đổi địa chỉ API, đặt `NEXT_PUBLIC_API_URL` trong `apps/web/.env.local` trước khi build; đặt `WEB_ORIGIN` trong `apps/api/.env` đúng origin web để cho phép CORS. Trình duyệt gọi API trực tiếp; backend dùng IP kết nối, không tin `X-Forwarded-For` do client gửi. Khi triển khai sau reverse proxy, cần thiết kế proxy tin cậy/ghi đè IP trước khi mở công khai; mặc định không bật trust proxy.

API kiểm tra các trường bắt buộc, quy mô, SĐT Việt Nam và `consent: true`; honeypot `website` có nội dung trả cùng HTTP 201 nhưng không lưu/gửi mail. Giới hạn 5 request/IP trong cửa sổ một giờ tính từ request đầu tiên, kể cả dữ liệu sai/honeypot; lần vượt giới hạn trả 429 và `Retry-After`. Không nhận tenant hay trạng thái do client gán, không có API công khai để đọc/sửa Lead.

Lead được lưu trước khi đẩy BullMQ job. Worker gửi thư văn bản thuần; retry 5 lần với backoff 1/2/4/8 giây. Lead chưa gửi được quét lại mỗi 5 giây để khôi phục khi enqueue gián đoạn. Job thất bại sau hết retry được giữ trong Redis để vận hành kiểm tra/retry; không có màn hình quản trị trong T02. Email có thể trùng nếu worker dừng ngay sau SMTP chấp nhận nhưng trước khi ghi nhận đã gửi.

Kiểm thử tích hợp yêu cầu PostgreSQL, Redis, Mailpit đang chạy và đã migrate. Chạy trong PowerShell tại gốc repo:

```powershell
# Các biến shell cũng được tiến trình Playwright/API kế thừa.
$env:DATABASE_URL='postgresql://educore36:educore36@localhost:5432/educore36?schema=public'
$env:REDIS_URL='redis://localhost:6379'
$env:SMTP_HOST='localhost'
$env:SMTP_PORT='1025'
$env:LEAD_NOTIFY_EMAIL='pilot@educore36.local'
$env:MAILPIT_URL='http://localhost:8025'
$env:LEAD_INTEGRATION_TEST='true'
pnpm test
pnpm test:e2e --workers=2
```

Không đặt `LEAD_INTEGRATION_TEST` thì bỏ qua test cần dịch vụ thật. Test tích hợp API tự dọn Lead/email của nó; test trình duyệt giữ lại đăng ký và email mang tiền tố `T02-browser-` để kiểm tra thủ công. Nên dùng CSDL/Redis/Mailpit riêng khi kiểm thử. Chi tiết phạm vi, giả định và kiểm tra thủ công: `docs/PR-T02.md`.

## Lược đồ và cách ly doanh nghiệp (T03)

Migration bổ sung Tenant, Plan, Subscription, Payment, Department, Position, User, UserRole, AuditLog; liên kết Lead tới Tenant/User. Bảng nghiệp vụ có metadata tạo/cập nhật, xóa mềm và RLS `ENABLE` + `FORCE`. Tenant có `tenant_id = id`; User/UserRole/AuditLog cho phép tenant rỗng để lưu dữ liệu QTNT, nhưng ngữ cảnh tenant không thấy các dòng nền tảng này.

`TenantDatabase.run(tenantId, work)` mở transaction, chuyển sang role `educore36_tenant` (NOLOGIN, NOSUPERUSER, NOBYPASSRLS) rồi đặt `app.tenant_id` bằng `set_config(..., true)`. Trong callback, dùng **`TenantDatabase.client`** cho mọi truy vấn Prisma nghiệp vụ; getter từ chối truy cập ngoài transaction. Không tạo PrismaClient riêng trong handler nghiệp vụ. AsyncLocalStorage giữ client theo request; lỗi handler rollback transaction, transaction kết thúc sẽ giải phóng role và tenant setting.

Interceptor toàn cục chỉ lấy `request.user.tenantId` từ phiên backend xác minh. T04 cần gán `request.user` trong authentication guard trước interceptor; T03 không thêm đăng nhập hoặc cho phép chọn tenant qua HTTP. QTNT có tenant rỗng không được đọc dữ liệu doanh nghiệp. Endpoint công khai `/health`, `/public/leads` không tạo ngữ cảnh tenant; Lead dùng kết nối nền tảng của T02 và role tenant không có quyền trên bảng Lead.

Migration cần tài khoản bootstrap có quyền tạo role/grant; seed và fixture test cần tài khoản bootstrap có quyền vượt RLS (local Compose dùng superuser). Khi tách tài khoản runtime, cấp membership bằng `GRANT educore36_tenant TO <runtime_role>`; không cấp BYPASSRLS cho tài khoản này. Kết nối nền tảng cho Lead là ranh giới riêng, không dùng trong handler tenant.

`pnpm db:seed` tạo QTNT `qtnt@educore36.local`, hai doanh nghiệp `demo-a`, `demo-b`, mỗi nơi có `adm`, `nv1`, `nv2` với email `adm@demo-a.example`, `nv1@demo-a.example`... Mật khẩu local là `EduCore36Local!`, có thể đổi bằng `SEED_PASSWORD` trước lần seed đầu; chỉ lưu băm Argon2id. Chạy lại không reset mật khẩu hay nhân đôi dữ liệu. Chưa có giao diện đăng nhập trong T03.

Bật kiểm thử RLS thật trên CSDL kiểm thử đã migrate:

```powershell
$env:DATABASE_URL='postgresql://educore36:educore36@localhost:5432/educore36?schema=public'
$env:TENANT_INTEGRATION_TEST='true'
pnpm db:migrate
pnpm test
```

CI bật biến này trên PostgreSQL 16. Test đọc/ghi hai chiều A/B bằng role không bypass, ID đoán trước, HTTP interceptor với phiên giả lập chỉ trong test, quan hệ chéo tenant, request đồng thời và rollback. Fixture `apps/api/src/testing/tenant-fixture.ts` tạo/dọn dữ liệu theo UUID riêng; contract `tenant-isolation-contract.ts` tái sử dụng cho model/API ở task sau. Chỉ dùng CSDL kiểm thử với tài khoản bootstrap cho bộ test này.
