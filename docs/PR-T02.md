# T02 — API nhận đăng ký pilot

Form landing page gửi đăng ký đến NestJS `POST /public/leads`. API kiểm tra dữ liệu, chặn spam theo IP, lưu Lead trong PostgreSQL và đẩy BullMQ job gửi email văn bản thuần đến `LEAD_NOTIFY_EMAIL`. Lead chưa gửi thông báo được quét lại để khôi phục enqueue bị gián đoạn.

## FR/AC đã đáp ứng trong phạm vi T02

- **FR-12.03:** Kiểm tra độc lập tại server: họ tên, chức vụ, tên doanh nghiệp, quy mô, số điện thoại Việt Nam và đồng ý xử lý dữ liệu phải bằng boolean `true`. Giữ validation trình duyệt từ T01, nối form với API thật.
- **FR-12.04:** Bảng Lead theo mục VII, trạng thái mặc định Mới; BullMQ worker gửi email tới cấu hình QTNT. Có migration có phiên bản và Prisma Client.
- **FR-12.05:** Honeypot bỏ qua âm thầm, Redis Lua đếm nguyên tử giới hạn 5 lần/IP/giờ, trả 429 kèm `Retry-After` khi vượt mức.
- **AC-16:** Test tự động cho dữ liệu hợp lệ/thiếu/sai, consent, lưu thật vào PostgreSQL, gửi qua BullMQ/SMTP thật và xác nhận Mailpit nhận thư dưới 60 giây. Playwright gửi form thật, ngoài các test mock HTTP/lỗi mạng của T01.
- **AC-17:** Test HTTP kiểm tra payload HTML/JavaScript chỉ là dữ liệu; email chỉ có phần text, tiêu đề cố định. Playwright xác nhận nội dung nhập hiện nguyên văn trong lời cảm ơn, không tạo thẻ hoặc thực thi script. Màn hình quản trị thuộc T07, chưa có trong T02.

## Giả định và ranh giới

- Giữ hợp đồng JSON T01: `fullName`, `jobTitle`, `companyName`, `companySize` (`under-30`, `30-100`, `over-100`), `phone`, `consent`, `website`. Chuẩn hóa SĐT về đầu `0`, chấp nhận di động 10 chữ số và cố định đầu `02` gồm 11 chữ số, hỗ trợ `+84` và dấu phân cách phổ biến. Giới hạn họ tên/chức vụ 200 ký tự, tên DN 300, chuỗi SĐT đầu vào 40.
- Lead là dữ liệu nền tảng theo ngoại lệ trong AGENTS.md, không gán tenant từ client và không áp dụng RLS nghiệp vụ tenant ở task này. `tenant_id`, `assignee_id` để nullable UUID, chưa có khóa ngoại vì Tenant/User thuộc T03. Ghi chú và trạng thái đủ cho schema; quản lý/chuyển đổi thuộc T07. Test bảo vệ API mới xác nhận client không thể gán tenant/trạng thái/người phụ trách hoặc đọc/sửa Lead khác.
- Cửa sổ giới hạn là một giờ từ request đầu tiên; request sai/honeypot cũng tính vào giới hạn. IP lấy từ kết nối Express, không tin header chuyển tiếp. Form gọi trực tiếp API; CORS theo `WEB_ORIGIN`, địa chỉ frontend theo `NEXT_PUBLIC_API_URL`. Chưa tự bật trust proxy khi chưa biết topology triển khai.
- Thư gửi ngay khi job được xử lý; retry tối đa 5 lần với backoff. `notification_sent_at` hỗ trợ khôi phục enqueue qua quét mỗi 5 giây. Job hết retry giữ trong Redis để vận hành retry; thời hạn dưới một phút được kiểm tra khi dịch vụ hoạt động bình thường. SMTP có ngữ nghĩa ít nhất một lần: có thể gửi trùng nếu dừng sau SMTP nhưng trước cập nhật DB.
- Không thêm tính năng quản lý Lead, tenant, đăng nhập hoặc audit cho hành động quản trị chưa tồn tại. Không có endpoint công khai đọc Lead; response không trả thông tin đã lưu.
- `RTK.md` được tham chiếu trong hướng dẫn đầu phiên nhưng không có trong workspace; áp dụng AGENTS.md hiện có.

## Cách kiểm tra thủ công

1. Làm theo README: sao chép `.env.example` sang `apps/api/.env`, đặt `LEAD_NOTIFY_EMAIL`, chạy `pnpm install`, `docker compose up -d`, `pnpm db:migrate`, `pnpm dev`.
2. Mở http://localhost:3000, điền đủ form và đồng ý xử lý dữ liệu. Network phải có `POST http://localhost:4000/public/leads` trả 201, lời cảm ơn hiển thị dữ liệu vừa nhập.
3. Mở http://localhost:8025: trong một phút thấy email gửi đến `LEAD_NOTIFY_EMAIL` có họ tên/chức vụ/DN/quy mô/SĐT. Chạy `pnpm --filter @educore36/api exec prisma studio` để đối chiếu bản ghi Lead: trạng thái NEW, IP/thời gian có giá trị, tenant/người phụ trách rỗng.
4. Thử thiếu từng trường, bỏ đồng ý hoặc SĐT sai: trình duyệt báo lỗi, không gửi. Gửi JSON sai trực tiếp API cũng phải trả 400 và không thêm Lead.
5. Gửi payload có `website: "spam.example"`: trả 201 nhưng không có Lead/email mới. Gửi quá 5 lần từ cùng IP trong cửa sổ một giờ: trả 429 có `Retry-After`. Dùng IP/môi trường riêng để không bị ảnh hưởng bởi các bước trước.
6. Nhập `<img src=x onerror="alert(1)">` vào họ tên/chức vụ/tên DN: lời cảm ơn hiện nguyên văn, không xuất hiện ảnh hoặc alert; email là văn bản thuần.
7. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`. Đặt các biến dịch vụ và `LEAD_INTEGRATION_TEST=true` theo README rồi chạy `pnpm test` và `pnpm test:e2e --workers=2` để chạy cả luồng thật.

## Kết quả xác minh

- `pnpm lint && pnpm typecheck && pnpm test`: qua; **46 test** (17 web, 29 API, bao gồm 2 test tích hợp PostgreSQL/Redis/BullMQ/Mailpit thật), không có test bị bỏ qua trong lượt xác minh cuối.
- `pnpm test:e2e --workers=2` với `LEAD_INTEGRATION_TEST=true`: **8/8 qua**, bao gồm gửi form thật, tìm thấy email tương ứng trong Mailpit dưới một phút, kiểm tra XSS và các test T01 ở 360/768/1280px.
- `prisma validate`: qua. `git diff --check`: qua.
- Migration baseline và Lead đã áp dụng thành công trên CSDL trống local. Máy không có Docker executable; xác minh local dùng PostgreSQL 18 có sẵn, Redis 7.0.15 và Mailpit 1.27.0 portable ở cổng riêng. CI khai báo PostgreSQL 16, Redis 7, Mailpit 1.27 và bật test tích hợp; chưa có kết quả chạy CI từ xa trong phiên này.
