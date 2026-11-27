# AGENTS.md — EduCore36 (PRD-EDU-001)

Hướng dẫn cho agent lập trình (Codex) làm việc trong repo này. Đọc toàn bộ file này trước khi bắt đầu bất kỳ task nào.

## 1. Sản phẩm

Nền tảng SaaS đa doanh nghiệp về quản trị tri thức và đào tạo nội bộ cho doanh nghiệp tại Thanh Hóa. Tên thương mại dự kiến: EduCore36 / TriThuc36.

- Đặc tả đầy đủ: `docs/PRD-EDU-001_v1.1.md`. Đây là nguồn sự thật duy nhất về nghiệp vụ.
- Thiết kế landing page: `docs/design/landing-educore36.html`.
- Danh sách task: `docs/TASKS.md`.

Khi một yêu cầu trong task không rõ, tra PRD theo mã (FR-xx.yy, BR-xxx, D-xx, NFR-xx, AC-xx). Nếu PRD cũng không trả lời được, chọn cách đơn giản nhất, ghi rõ giả định trong mô tả PR và không tự mở rộng phạm vi.

## 2. Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | `apps/web` — Next.js (App Router), React, TypeScript, Tailwind CSS (build, không dùng CDN) |
| Backend | `apps/api` — NestJS, TypeScript, REST, OpenAPI (Swagger) |
| CSDL | PostgreSQL 16, Prisma, migration có phiên bản |
| Hàng đợi | Redis + BullMQ |
| Lưu tệp | S3-compatible (MinIO khi chạy local) |
| Email | SMTP (Mailpit khi chạy local) |
| Kiểm thử | Vitest/Jest cho unit, Supertest cho API, Playwright cho E2E |
| Chạy local | `docker compose up -d` cho postgres, redis, minio, mailpit |

Không thêm framework hoặc dịch vụ ngoài danh sách này nếu task không yêu cầu.

## 3. Lệnh thường dùng

```bash
pnpm install
docker compose up -d
pnpm db:migrate        # chạy migration Prisma
pnpm db:seed           # dữ liệu mẫu
pnpm dev               # chạy web + api
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Task T00 tạo ra các lệnh này. Sau T00, mọi task phải giữ cho chúng chạy được.

## 4. Quy tắc bắt buộc

### Đa doanh nghiệp (D-20, NFR-01)
- Mọi bảng nghiệp vụ có cột `tenant_id` (trừ bảng của nền tảng: Plan, Lead, bảng bộ mẫu).
- Bật PostgreSQL Row Level Security cho các bảng có `tenant_id`. Mỗi request đặt `app.tenant_id` trong transaction trước khi truy vấn.
- Không bao giờ nhận `tenant_id` từ body hoặc query của client; lấy từ phiên đăng nhập.
- Mỗi API mới phải có test chứng minh người dùng doanh nghiệp A không đọc/ghi được dữ liệu doanh nghiệp B.

### Phân quyền (NFR-03)
- Kiểm tra quyền ở backend bằng guard theo ma trận mục III.2 của PRD. Ẩn nút ở frontend chỉ để tiện dùng.

### Bảo mật
- Mật khẩu băm Argon2. Không ghi mật khẩu, token vào log.
- Dữ liệu người dùng nhập chỉ hiển thị dạng văn bản; không dùng `dangerouslySetInnerHTML` trừ nội dung rich text đã qua sanitize.
- Không commit file `.env`; cập nhật `.env.example` khi thêm biến môi trường.

### Nghiệp vụ
- Các giá trị số trong quyết định D-xx (điểm đạt 70%, 3 lần làm bài, 15 ngày ân hạn…) đặt ở cấu hình, không viết cứng trong code.
- Ghi AuditLog cho các hành động liệt kê ở NFR-06.

### Giao diện
- Toàn bộ chữ hiển thị bằng tiếng Việt; code, tên biến, commit bằng tiếng Anh.
- Responsive từ 360px. Định dạng ngày dd/MM/yyyy, múi giờ Asia/Ho_Chi_Minh.
- Màu và font theo landing page: navy `#0F172A`, blue `#2563EB`, orange `#F97316`, teal `#0D9488`; font Be Vietnam Pro.

## 5. Ngoài phạm vi — không làm

AI (sinh nội dung, chatbot), tích hợp ERP/HRM, khung năng lực, cấp chứng chỉ, SSO/đăng nhập mạng xã hội, đa ngôn ngữ, cổng thanh toán, ứng dụng di động gốc.

## 6. Cách làm một task

1. Đọc task trong `docs/TASKS.md` và các mã PRD được nhắc tới.
2. Làm đúng phạm vi task; mỗi task là một PR.
3. Viết test cho quy tắc nghiệp vụ và tiêu chí nghiệm thu của task.
4. Chạy `pnpm lint && pnpm typecheck && pnpm test` trước khi kết thúc.
5. Mô tả PR gồm: mã task, các mã FR/AC đã đáp ứng, giả định đã đặt, cách kiểm tra thủ công.

## 7. Định nghĩa hoàn thành

- Đáp ứng mọi tiêu chí "Hoàn thành khi" của task.
- Lint, typecheck, test đều qua; migration chạy được trên CSDL trống.
- Có test cách ly tenant cho API mới.
- Không còn TODO chưa giải thích trong code.
