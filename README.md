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

Đợi PostgreSQL healthy trước khi migrate. Web: http://localhost:3000 (landing page); API: http://localhost:4000/health trả JSON `{"status":"ok"}`. `API_PORT` có thể đặt trong môi trường shell; Prisma tự đọc `apps/api/.env`. Các thông số Redis/S3/SMTP trong mẫu dành cho những task sau, chưa có client kết nối ở T00.

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

Migration đầu tiên chỉ có chú thích SQL và ghi nhận baseline trong `_prisma_migrations`; seed chủ ý không tạo dữ liệu. Thêm model/generator Prisma Client khi có schema nghiệp vụ ở T03. Dùng `pnpm --filter @educore36/api exec prisma migrate dev --name <name>` khi phát triển migration tiếp theo.

CI ở `.github/workflows/ci.yml` tại gốc Git chạy install với lockfile, migration trên PostgreSQL 16 trống, seed, lint, typecheck và test. Chưa cấu hình triển khai.

## Landing page (T01)

Trang `/` chuyển từ bản thiết kế `docs/design/landing-educore36.html`, có menu di động, tab vai trò, FAQ và form đăng ký. Trang `/chinh-sach-bao-mat` hiện là khung cần hoàn thiện. Nút Đăng nhập dẫn tới `/dang-nhap` (T04).

Form tạm gọi `POST /api/public/leads`; T02 mới bổ sung backend. Hiện tại gửi form thật sẽ báo lỗi thân thiện; E2E mock phản hồi để kiểm tra success/XSS và lỗi mạng. `pnpm test` chạy cả unit test web và test HTTP API. `pnpm test:e2e --workers=2` kiểm tra tương tác và responsive, lưu ảnh ở `test-results/t01-*.png`.

SEO dùng `SITE_URL` (mặc định http://localhost:3000). Khi chuẩn bị triển khai, tạo `apps/web/.env.local` có `SITE_URL=https://<ten-mien-thuc>` rồi build lại; xác nhận thông tin liên hệ, cam kết tiếp thị và hoàn thiện chính sách trước khi công bố. Font được phục vụ từ `/fonts`, kèm giấy phép OFL.
