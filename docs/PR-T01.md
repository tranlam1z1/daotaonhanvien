# T01 — Landing page EduCore36

Chuyển bản thiết kế HTML thành trang Next.js `/`, tách các component Header, Hero, Problems, Pillars, Roles, Differentiators, Pilot/PilotForm, Faq và Footer. Giữ nội dung, màu và bố cục gốc; dùng Tailwind build và font Be Vietnam Pro lưu tại repo (giấy phép OFL đi kèm), không tải CDN lúc truy cập.

## FR/AC đã đáp ứng trong phạm vi T01

- **FR-12.01:** Các section theo thiết kế; menu di động, ba tab vai trò và FAQ hoạt động bằng React. Ghi chú rõ dữ liệu giao diện mẫu theo ngoại lệ F12.
- **FR-12.02:** Liên kết Đăng nhập trên điều hướng desktop và menu di động dẫn đến `/dang-nhap`.
- **FR-12.03 (phía trình duyệt):** Các trường bắt buộc, quy mô nhân sự, số điện thoại Việt Nam và checkbox đồng ý xử lý dữ liệu kèm liên kết chính sách. Kiểm tra phía máy chủ thuộc T02.
- **FR-12.05 (phía trình duyệt):** Honeypot `website` ẩn, ngoài thứ tự tab; không dùng CAPTCHA. Giới hạn IP và bỏ qua honeypot phía máy chủ thuộc T02.
- **FR-12.07:** title, description, canonical, Open Graph kèm ảnh PNG, sitemap.xml, robots.txt và trang chính sách bảo mật dạng khung.
- **AC-17 (landing):** Nội dung người dùng được React render dạng text; test gửi chuỗi `<img ... onerror=...>` và xác minh không tạo thẻ hoặc thực thi mã. Màn hình quản trị không thuộc T01.
- **AC-18:** Kiểm tra responsive 360/768/1280px và Lighthouse mobile trên build production; kết quả ghi ở phần xác minh.

## Giả định và ranh giới

- Hợp đồng tạm của `POST /api/public/leads` dùng JSON camelCase: `fullName`, `jobTitle`, `companyName`, `companySize` (`under-30`, `30-100`, `over-100`), `phone`, `consent: true`, `website`. T02 sẽ triển khai backend và nối endpoint thực tế. T01 không thêm API, bảng Lead, email hay rate limit.
- Chỉ hiển thị thành công sau HTTP 2xx; HTTP lỗi, mất mạng hoặc quá 10 giây hiển thị lỗi thân thiện và giữ dữ liệu để gửi lại. Các bài E2E mock phản hồi thành công/lỗi; khi backend chưa có, form thực tế sẽ báo lỗi thay vì ghi nhận giả.
- Số điện thoại chấp nhận di động Việt Nam 10 chữ số và cố định đầu 02 gồm 11 chữ số, hỗ trợ +84 và dấu phân cách phổ biến. Máy chủ phải kiểm tra độc lập ở T02.
- `/dang-nhap` thuộc T04; T01 chỉ thêm liên kết theo yêu cầu.
- `SITE_URL` mặc định là `http://localhost:3000`; đặt tên miền thật trong `apps/web/.env.local` trước build triển khai. Không tự xác nhận tên miền, hotline hoặc các cam kết tiếp thị trong thiết kế.
- Giữ nội dung tiếp thị gốc; thông tin liên hệ, các cam kết và khung chính sách cần chủ sản phẩm xác nhận/hoàn thiện trước khi công bố, theo ngoại lệ F12. T01 không triển khai hoặc xuất bản website.
- Thanh điều hướng desktop chuyển sang menu di động dưới 1280px để đủ chỗ cho nút Đăng nhập; thu nhỏ logo và CTA trên màn hình nhỏ để không tràn ngang. Giữ grid/breakpoint nội dung của thiết kế. Tối ưu AC-18 bằng font WOFF2 chia tập ký tự, server component cho preview, Suspense theo section và content-visibility. Nền lưới 40px dùng CSS thay SVG; backdrop blur chỉ bật từ 768px để giảm chi phí đồ họa trên di động.
- `RTK.md` được tham chiếu đầu phiên nhưng không có trong workspace; áp dụng `AGENTS.md` hiện có.

## Cách kiểm tra thủ công

1. Theo README cài dependency; chạy `pnpm dev`, mở http://localhost:3000 ở 360px, 768px và 1280px. Đối chiếu `docs/design/landing-educore36.html`; kiểm tra không tràn ngang, logo/font/màu và đủ các section.
2. Mở menu trên di động, chọn liên kết và xác minh menu đóng; kiểm tra Đăng nhập dẫn `/dang-nhap`. Chuyển cả ba tab bằng chuột và phím mũi tên/Home/End; mở/đóng từng FAQ.
3. Gửi form thiếu dữ liệu, số điện thoại sai hoặc chưa đồng ý: phải báo lỗi và không gửi request. Kiểm tra honeypot không hiện và không nhận focus khi Tab.
4. Điền hợp lệ và đồng ý rồi gửi: khi T02 chưa triển khai, thấy lỗi thân thiện, dữ liệu vẫn còn. Kiểm tra Network có POST `/api/public/leads`, consent và honeypot trong JSON. Nút gửi bị khóa trong lúc chờ.
5. Chạy `pnpm test:e2e --workers=2` để kiểm tra success có mock: chuỗi HTML hiện nguyên văn, không tạo thẻ hoặc chạy JavaScript; nút đăng ký thêm đặt lại form và consent.
6. Mở `/chinh-sach-bao-mat`, `/sitemap.xml`, `/robots.txt` và `/opengraph-image.png`; kiểm tra HTML head có title, description, canonical và Open Graph. Trước build trên tên miền thật, đặt SITE_URL rồi kiểm tra lại URL tuyệt đối.
7. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @educore36/web build`. Đo Lighthouse trên server production bằng Chrome mobile, xem hướng dẫn và kết quả xác minh bên dưới.

## Kết quả xác minh

- `pnpm lint`, `pnpm typecheck`, `pnpm test`: qua; 17 test web và 1 test HTTP API.
- Build production qua; trang chủ, trang chính sách, ảnh Open Graph, robots và sitemap được prerender tĩnh.
- **7/7 E2E trên production qua**: 360/768/1280px, menu, tab (cả bàn phím), FAQ, consent, lỗi HTTP/mạng, pending/reset, XSS và SEO. Đã kiểm tra ảnh chụp ở ba kích thước.
- Lighthouse **13.6.0**, Chrome **159**, mobile 412×823, simulated Slow 4G, CPU **4x**: **Performance 87 / SEO 100**, LCP **1.1 s**, TBT **500 ms**, CLS **0**.
- Cấu hình Chrome: `--headless=new --disable-gpu` (software renderer cho môi trường Windows này). Không giảm CPU multiplier hoặc bỏ throttling mạng. Chưa đo trên tên miền/hạ tầng triển khai thực tế.
- Tóm tắt đo: [verification/T01-lighthouse.json](verification/T01-lighthouse.json). Báo cáo đầy đủ tại `test-results/t01-lighthouse-software.report.html` và `.json` (artifact local, được gitignore).

### Đo lại Lighthouse (PowerShell)

Build bằng `pnpm --filter @educore36/web build`, chạy `pnpm --filter @educore36/web exec next start --port 3000` ở terminal riêng. Máy cần Chrome; có thể đặt biến môi trường `CHROME_PATH` trỏ tới Chromium đã cài bởi Playwright.

```powershell
pnpm dlx lighthouse@13.6.0 http://localhost:3000 '--only-categories=performance,seo' --output=json --output=html --output-path=./test-results/t01-lighthouse-software --chrome-flags="--headless=new --disable-gpu"
```
