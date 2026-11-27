# T00 — Khởi tạo monorepo

Tạo pnpm workspace gồm Next.js/Tailwind, NestJS và shared types; bổ sung Compose, Prisma baseline rỗng, seed rỗng, cấu hình strict TypeScript/ESLint/Prettier, unit/API test, Playwright smoke và CI PostgreSQL 16.

## FR/AC đã đáp ứng

T00 không tham chiếu mã FR/AC cụ thể. Không tuyên bố hoàn thành FR/AC nghiệp vụ nào. Phần công nghệ đối chiếu PRD-EDU-001 v1.1 mục IX; tiêu chí áp dụng là mục “Hoàn thành khi” của T00. `/health` là endpoint liveness công khai, không có dữ liệu tenant để kiểm thử cách ly.

## Giả định

- `RTK.md` được tham chiếu trong hướng dẫn đầu phiên nhưng không tồn tại trong workspace; áp dụng `AGENTS.md`.
- Migration đầu tiên không tạo bảng nghiệp vụ; seed không tạo dữ liệu. Schema và seed tenant thuộc T03.
- Người chạy sao chép `.env.example` vào `apps/api/.env` trước chuỗi lệnh nghiệm thu; CI cung cấp DATABASE_URL qua môi trường.
- Health trả HTTP 200 và JSON `{"status":"ok"}`; không kiểm tra readiness của các dịch vụ hạ tầng.
- Monorepo nằm ngay tại gốc Git; workflow `.github/workflows/ci.yml` dùng lockfile và chạy các lệnh tại gốc repo.
- Compose chỉ dành cho local, dùng tài khoản mẫu. Không bổ sung client Redis/S3/SMTP hay chức năng T01 trở đi.

## Kiểm tra thủ công

1. Cài Node.js 22 LTS, pnpm 10.32.1, Docker Compose v2; mở terminal tại thư mục gốc repo `daotaonhanvien`.
2. Sao chép `.env.example` thành `apps/api/.env`, chạy `pnpm install` và `docker compose up -d`; đợi PostgreSQL healthy.
3. Chạy `pnpm db:migrate` hai lần: lần đầu áp dụng baseline trên CSDL trống, lần sau không có migration chờ. Chạy `pnpm db:seed`.
4. Chạy `pnpm dev`; mở http://localhost:3000 thấy trang trống; gọi http://localhost:4000/health nhận HTTP 200 và JSON có status ok.
5. Mở MinIO :9001, Mailpit :8025; kiểm tra các service bằng `docker compose ps`.
6. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`. Cài Chromium bằng `pnpm exec playwright install chromium`, sau đó chạy `pnpm test:e2e`.
7. Push branch và kiểm tra workflow CI có PostgreSQL 16, migration, seed và ba kiểm tra xanh.

## Kết quả xác minh

- Đã qua: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (1 test HTTP), `pnpm test:e2e` (1 Chromium smoke), build Next.js và build API.
- Prisma migrate deploy áp dụng baseline trên CSDL trống thành công; chạy lần hai không còn migration chờ; seed thành công. Kiểm tra local dùng PostgreSQL 18.6 tạm trên cổng 55432, đã dừng sau khi kiểm tra.
- Chưa xác minh Docker Compose/PostgreSQL 16 tại local vì môi trường không có Docker. Workflow CI dùng PostgreSQL 16 đã được tạo nhưng chưa có lần chạy GitHub Actions, nên chưa khẳng định CI xanh.
- Typecheck web chạy Next typegen trước tsc để không phụ thuộc file sinh từ build trước đó.
