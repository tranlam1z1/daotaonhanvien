# TASKS — Giai đoạn 0 (Nền móng + Landing page)

Làm lần lượt theo thứ tự. Mỗi task là một PR. Mã trong ngoặc tham chiếu `docs/PRD-EDU-001_v1.1.md`.

Trạng thái: ☐ chưa làm · ◐ đang làm · ☑ xong

---

## ☑ T00 — Khởi tạo monorepo

**Làm:**
- pnpm workspaces: `apps/web` (Next.js + Tailwind), `apps/api` (NestJS), `packages/shared` (kiểu dữ liệu, hằng số dùng chung).
- `docker-compose.yml`: postgres 16, redis, minio, mailpit.
- Prisma trong `apps/api`, migration đầu tiên rỗng, lệnh `db:migrate`, `db:seed`.
- ESLint, Prettier, TypeScript strict; lệnh `dev`, `lint`, `typecheck`, `test`, `test:e2e` ở gốc.
- `.env.example`, `README.md` hướng dẫn chạy local.
- GitHub Actions: lint + typecheck + test với postgres service.
- API có `GET /health`; web có trang trống.

**Hoàn thành khi:** máy mới clone về chạy `pnpm install && docker compose up -d && pnpm db:migrate && pnpm dev` thấy web ở :3000 và `/health` ở :4000 trả về ok; CI xanh.

---

## ☑ T01 — Landing page EduCore36 (F12)

**Làm:**
- Chuyển `docs/design/landing-educore36.html` thành trang `/` của `apps/web`, tách thành component theo từng section, giữ nguyên bố cục, màu, nội dung.
- Tailwind cấu hình theo màu/font của thiết kế; bỏ Tailwind CDN.
- Thêm nút "Đăng nhập" trên thanh điều hướng, dẫn tới `/dang-nhap` (FR-12.02).
- Form đăng ký: thêm ô bắt buộc "Tôi đồng ý cho phép xử lý dữ liệu cá nhân" kèm liên kết `/chinh-sach-bao-mat`; thêm trường honeypot ẩn (FR-12.03, FR-12.05).
- Lời cảm ơn hiển thị thông tin người dùng nhập dạng văn bản, không chèn HTML (AC-17).
- Trang `/chinh-sach-bao-mat` với nội dung khung để điền sau.
- SEO: title, meta description, Open Graph, `sitemap.xml`, `robots.txt` (FR-12.07).
- Tạm thời form gọi `POST /api/public/leads` (T02 làm API); nếu lỗi mạng thì hiện thông báo lỗi thân thiện.

**Hoàn thành khi:** giao diện khớp thiết kế ở 360px, 768px, 1280px; tab vai trò, menu di động, FAQ hoạt động; Lighthouse di động Performance và SEO ≥ 85 (AC-18).

---

## ☐ T02 — API nhận đăng ký pilot (F12)

**Làm:**
- Bảng `Lead` theo mục VII của PRD.
- `POST /public/leads`: validate (họ tên, chức vụ, tên DN, quy mô, SĐT Việt Nam, đồng ý = true), bỏ qua nếu honeypot có giá trị, giới hạn 5 lần/IP/giờ.
- Lưu Lead, đẩy job BullMQ gửi email cho địa chỉ trong biến `LEAD_NOTIFY_EMAIL` (FR-12.04).
- Nối form ở T01 vào API này.

**Hoàn thành khi:** AC-16 và AC-17 có test tự động; email xuất hiện trong Mailpit khi gửi form.

---

## ☐ T03 — Lược đồ nền tảng và cách ly tenant

**Làm:**
- Bảng: Tenant, Plan, Subscription, Payment, Department, Position, User, UserRole, AuditLog (mục VII).
- RLS policy cho các bảng có `tenant_id`; middleware/interceptor đặt `app.tenant_id` cho mỗi request (D-20).
- Seed: 1 QTNT, 2 doanh nghiệp mẫu, mỗi doanh nghiệp có ADM và vài nhân viên.
- Bộ test cách ly dùng chung để các task sau tái sử dụng.

**Hoàn thành khi:** test chứng minh truy vấn trực tiếp bằng Prisma trong ngữ cảnh tenant A không trả về dòng nào của tenant B, kể cả khi cố truyền id của B (AC-01).

---

## ☐ T04 — Xác thực (FR-03.05, NFR-02)

**Làm:**
- Đăng nhập bằng email hoặc số điện thoại + mật khẩu; phiên bằng cookie httpOnly; hết hạn sau 7 ngày không hoạt động.
- Khóa 15 phút sau 5 lần sai; quên mật khẩu qua email (link dùng một lần, hết hạn 60 phút); đổi mật khẩu; đăng xuất mọi thiết bị.
- Kích hoạt tài khoản qua email mời đặt mật khẩu.
- Trang web: `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau`.

**Hoàn thành khi:** có test cho khóa tài khoản, link hết hạn, tài khoản vô hiệu hóa không đăng nhập được, doanh nghiệp bị tạm ngừng không đăng nhập được.

---

## ☐ T05 — Phân quyền (mục III.2, NFR-03)

**Làm:**
- Guard/decorator khai báo quyền cho từng endpoint theo vai trò QTNT, ADM, PTĐT, PD, NV và phạm vi phòng ban.
- Hàm kiểm tra quyền theo ngữ cảnh: quản lý trực tiếp (theo `manager_id`) và người nhận bàn giao.
- Endpoint `GET /me` trả về vai trò và quyền để frontend dựng menu.

**Hoàn thành khi:** có bảng test theo ma trận phân quyền cho các endpoint đã có.

---

## ☐ T06 — Khung giao diện ứng dụng

**Làm:**
- Layout sau đăng nhập: sidebar theo vai trò, thanh trên có tên doanh nghiệp, chuông thông báo (chưa cần dữ liệu), menu tài khoản.
- Thu gọn sidebar trên di động; thư viện component dùng chung (button, input, table, modal, toast, empty state).
- Trang hồ sơ cá nhân và đổi mật khẩu.

**Hoàn thành khi:** đăng nhập bằng từng vai trò trong seed thấy đúng menu; dùng tốt ở 360px.

---

## ☐ T07 — Quản trị nền tảng cơ bản (FR-01.01–01.03, FR-12.06)

**Làm:**
- QTNT: danh sách/tạo/sửa/tạm ngừng doanh nghiệp; khi tạo thì tạo ADM đầu tiên và gửi email mời.
- Danh mục gói; gán gói, ngày bắt đầu/kết thúc; ghi nhận thanh toán thủ công.
- Danh sách đăng ký pilot: lọc, đổi trạng thái, ghi chú, người phụ trách; nút "Chuyển thành doanh nghiệp" điền sẵn form tạo doanh nghiệp.

**Hoàn thành khi:** QTNT không truy cập được dữ liệu nghiệp vụ của doanh nghiệp (chỉ số liệu tổng hợp).

---

## ☐ T08 — Quản trị doanh nghiệp (F02)

**Làm:** FR-02.01 đến FR-02.05: hồ sơ doanh nghiệp, cây phòng ban (thêm, sửa, di chuyển, ngừng sử dụng), chức danh, cấu hình (D-05, BR-012), thông tin thuê bao.

**Hoàn thành khi:** không xóa được phòng ban/chức danh đang dùng; cấu hình lưu và đọc lại đúng.

---

## ☐ T09 — Nhân viên (F03)

**Làm:**
- FR-03.01 đến FR-03.04: CRUD nhân viên, nhập Excel theo mẫu (báo lỗi từng dòng trước khi lưu), kích hoạt/vô hiệu hóa, gán vai trò và phạm vi.
- Chặn kích hoạt khi đạt giới hạn gói, cảnh báo khi ≥ 90% (D-18, AC-02).
- Luôn còn ít nhất một ADM; email và mã nhân viên duy nhất trong doanh nghiệp.

**Hoàn thành khi:** AC-02 có test; nhập file 200 dòng có 3 dòng lỗi thì báo đúng 3 dòng và không lưu dòng nào cho tới khi sửa.

---

Sau T09: chuyển sang Giai đoạn 1 (F04 Kho tri thức, F05 Quản lý đào tạo). Danh sách task GĐ1 sẽ được bổ sung vào file này.
