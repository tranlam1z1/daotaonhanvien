# TASKS — EduCore36

Làm lần lượt theo thứ tự. Mỗi task là một PR. Mã trong ngoặc tham chiếu `docs/PRD-EDU-001_v1.1.md`.

Trạng thái: ☐ chưa làm · ◐ đang làm · ☑ xong

---

# Giai đoạn 0 — Nền móng và Landing page

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

## ☑ T02 — API nhận đăng ký pilot (F12)

**Làm:**
- Bảng `Lead` theo mục VII của PRD.
- `POST /public/leads`: validate (họ tên, chức vụ, tên DN, quy mô, SĐT Việt Nam, đồng ý = true), bỏ qua nếu honeypot có giá trị, giới hạn 5 lần/IP/giờ.
- Lưu Lead, đẩy job BullMQ gửi email cho địa chỉ trong biến `LEAD_NOTIFY_EMAIL` (FR-12.04).
- Nối form ở T01 vào API này.

**Hoàn thành khi:** AC-16 và AC-17 có test tự động; email xuất hiện trong Mailpit khi gửi form.

---

## ☑ T03 — Lược đồ nền tảng và cách ly tenant

**Làm:**
- Bảng: Tenant, Plan, Subscription, Payment, Department, Position, User, UserRole, AuditLog (mục VII).
- RLS policy cho các bảng có `tenant_id`; middleware/interceptor đặt `app.tenant_id` cho mỗi request (D-20).
- Seed: 1 QTNT, 2 doanh nghiệp mẫu, mỗi doanh nghiệp có ADM và vài nhân viên.
- Bộ test cách ly dùng chung để các task sau tái sử dụng.

**Hoàn thành khi:** test chứng minh truy vấn trực tiếp bằng Prisma trong ngữ cảnh tenant A không trả về dòng nào của tenant B, kể cả khi cố truyền id của B (AC-01).

---

## ☑ T04 — Xác thực (FR-03.05, NFR-02)

**Làm:**
- Đăng nhập bằng email hoặc số điện thoại + mật khẩu; phiên bằng cookie httpOnly; hết hạn sau 7 ngày không hoạt động.
- Khóa 15 phút sau 5 lần sai; quên mật khẩu qua email (link dùng một lần, hết hạn 60 phút); đổi mật khẩu; đăng xuất mọi thiết bị.
- Kích hoạt tài khoản qua email mời đặt mật khẩu.
- Trang web: `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau`.

**Hoàn thành khi:** có test cho khóa tài khoản, link hết hạn, tài khoản vô hiệu hóa không đăng nhập được, doanh nghiệp bị tạm ngừng không đăng nhập được.

---

## ☑ T05 — Phân quyền (mục III.2, NFR-03)

**Làm:**
- Guard/decorator khai báo quyền cho từng endpoint theo vai trò QTNT, ADM, PTĐT, PD, NV và phạm vi phòng ban.
- Hàm kiểm tra quyền theo ngữ cảnh: quản lý trực tiếp (theo `manager_id`) và người nhận bàn giao.
- Endpoint `GET /me` trả về vai trò và quyền để frontend dựng menu.

**Hoàn thành khi:** có bảng test theo ma trận phân quyền cho các endpoint đã có.

---

## ☑ T06 — Khung giao diện ứng dụng

**Làm:**
- Layout sau đăng nhập: sidebar theo vai trò, thanh trên có tên doanh nghiệp, chuông thông báo (chưa cần dữ liệu), menu tài khoản.
- Thu gọn sidebar trên di động; thư viện component dùng chung (button, input, table, modal, toast, empty state).
- Trang hồ sơ cá nhân và đổi mật khẩu.

**Hoàn thành khi:** đăng nhập bằng từng vai trò trong seed thấy đúng menu; dùng tốt ở 360px.

---

## ☑ T07 — Quản trị nền tảng cơ bản (FR-01.01–01.03, FR-12.06)

**Làm:**
- QTNT: danh sách/tạo/sửa/tạm ngừng doanh nghiệp; khi tạo thì tạo ADM đầu tiên và gửi email mời.
- Danh mục gói; gán gói, ngày bắt đầu/kết thúc; ghi nhận thanh toán thủ công.
- Danh sách đăng ký pilot: lọc, đổi trạng thái, ghi chú, người phụ trách; nút "Chuyển thành doanh nghiệp" điền sẵn form tạo doanh nghiệp.

**Hoàn thành khi:** QTNT không truy cập được dữ liệu nghiệp vụ của doanh nghiệp (chỉ số liệu tổng hợp).

---

## ☑ T08 — Quản trị doanh nghiệp (F02)

**Làm:** FR-02.01 đến FR-02.05: hồ sơ doanh nghiệp, cây phòng ban (thêm, sửa, di chuyển, ngừng sử dụng), chức danh, cấu hình (D-05, BR-012), thông tin thuê bao.

**Hoàn thành khi:** không xóa được phòng ban/chức danh đang dùng; cấu hình lưu và đọc lại đúng.

---

## ☑ T09 — Nhân viên (F03)

**Làm:**
- FR-03.01 đến FR-03.04: CRUD nhân viên, nhập Excel theo mẫu (báo lỗi từng dòng trước khi lưu), kích hoạt/vô hiệu hóa, gán vai trò và phạm vi.
- Chặn kích hoạt khi đạt giới hạn gói, cảnh báo khi ≥ 90% (D-18, AC-02).
- Luôn còn ít nhất một ADM; email và mã nhân viên duy nhất trong doanh nghiệp.

**Hoàn thành khi:** AC-02 có test; nhập file 200 dòng có 3 dòng lỗi thì báo đúng 3 dòng và không lưu dòng nào cho tới khi sửa.

---

# Giai đoạn 1 — Nội dung

Mục tiêu theo mục XI của PRD là tạo và xuất bản tri thức, chương trình và khóa học hoàn chỉnh. Với mọi API mới, kiểm thử cách ly tenant theo AC-01 và kiểm tra quyền tại backend theo mục III.2. Các tiêu chí dưới đây áp dụng cho phần nghiệp vụ được giao trong từng task.

## ☑ T10 — Lưu trữ tệp cho tri thức và bài học

**FR/AC:** FR-04.02 và FR-05.04 (phần tệp và video), AC-01. Tham chiếu D-17, D-20, NFR-01, NFR-09.

**Làm:**
- Tạo `FileObject`, lưu tệp trên S3-compatible (MinIO khi chạy local) theo tiền tố tenant. Chỉ cấp URL ký có thời hạn sau khi kiểm tra quyền truy cập tệp qua nội dung liên kết.
- Kiểm tra loại tệp theo danh sách PRD và giới hạn dung lượng cấu hình được. Mặc định tài liệu tối đa 50 MB/tệp, video tối đa 500 MB/tệp. Cập nhật dung lượng đã dùng của doanh nghiệp theo tệp lưu thành công và kiểm tra tổng dung lượng theo gói.

**Hoàn thành khi:** tải lên và tải xuống được các loại tệp được hỗ trợ. Kiểm thử loại tệp sai, tệp quá cỡ, tổng dung lượng vượt gói, tải lên đồng thời và URL hết hạn. Tenant A không thể lấy URL tải tệp của tenant B, kể cả khi biết ID tệp.

---

## ☑ T11 — Danh mục, thẻ và soạn thảo tri thức

**FR/AC:** FR-04.01, FR-04.02, FR-04.03, AC-01, AC-03 (bản Nháp), AC-17. Phụ thuộc T10.

**Làm:**
- Quản lý danh mục dạng cây và thẻ. Cho ADM và PTĐT trong phạm vi được cấp soạn Nháp gồm tiêu đề, tóm tắt, rich text, danh mục, thẻ, tệp đính kèm, video tải lên hoặc liên kết.
- Cấu hình phạm vi toàn doanh nghiệp, theo phòng ban hoặc chức danh. Lọc rich text theo NFR-04 và kiểm tra các tham chiếu cùng tenant.

**Hoàn thành khi:** tạo và sửa được Nháp có tệp hoặc video, lưu và mở lại đúng danh mục, thẻ và phạm vi. Có test chặn vòng lặp danh mục, gán tham chiếu của tenant khác, thao tác ngoài phạm vi của PTĐT và truy cập Nháp qua API dành cho người đọc. HTML/JavaScript độc hại không thực thi trong trình soạn thảo hoặc bản xem trước.

---

## ☑ T12 — Phê duyệt và phiên bản tri thức

**FR/AC:** FR-04.04, FR-04.05, AC-01, AC-03, AC-04 (tri thức). Tham chiếu BR-003, BR-007, BR-012, BR-013, D-02 đến D-04, NFR-06. Phụ thuộc T11.

**Làm:**
- Thêm danh sách chờ duyệt và bản xem trước. Người tạo gửi duyệt, rút lại hoặc gửi lại. ADM và PD đúng phạm vi duyệt hoặc từ chối. Duyệt thì xuất bản ngay. Từ chối trả về Nháp với lý do bắt buộc và gửi thông báo cho người tạo (phần sự kiện từ chối của FR-11.03).
- Dùng cấu hình tự phê duyệt của doanh nghiệp. Ghi AuditLog cho quyết định duyệt, gồm cả tự duyệt. Sửa bài đã xuất bản tạo Nháp mới, đồng thời giữ bản công khai hiện tại và lịch sử phiên bản.

**Hoàn thành khi:** kiểm thử toàn bộ chuyển trạng thái, phạm vi PD, tự duyệt khi bật và khi tắt. Người đọc đủ quyền thấy bài ngay sau khi duyệt. Khi từ chối, người tạo nhận thông báo và thấy lý do trên Nháp. Khi sửa bản xuất bản, người đọc tiếp tục thấy bản cũ cho đến khi bản mới được duyệt. Người có quyền xem lại được phiên bản cũ.

---

## ☑ T13 — Tra cứu và lưu trữ tri thức

**FR/AC:** FR-04.06, FR-04.07, AC-01, AC-03 (danh sách, tìm kiếm và chi tiết). Phụ thuộc T12.

**Làm:**
- Tra cứu theo từ khóa trong tiêu đề, tóm tắt và nội dung bài. Kết hợp bộ lọc danh mục, thẻ và phòng ban. Danh sách, chi tiết và tệp áp dụng phạm vi truy cập của bản đã xuất bản.
- Cho người có quyền lưu trữ và khôi phục nội dung theo mục VI.1. Giữ lịch sử và tham chiếu từ bài học.

**Hoàn thành khi:** truy vấn kết hợp từ khóa và bộ lọc trả đúng bài đã xuất bản thuộc phạm vi của người dùng. Kiểm thử gọi API trực tiếp theo ID với Nháp, bài chờ duyệt, bài lưu trữ và bài ngoài phạm vi. Lưu trữ làm bài biến mất khỏi tra cứu của người học, khôi phục đưa bài trở lại đúng phạm vi, lịch sử vẫn xem được. Nội dung đang được bài học tham chiếu không thể bị xóa vĩnh viễn.

---

## ☑ T14 — Trình dựng chương trình và khóa học

**FR/AC:** FR-05.01, FR-05.02, FR-05.03, FR-05.04, FR-05.10, AC-01, AC-17. Tham chiếu BR-009. Phụ thuộc T10 và T13.

**Làm:**
- Tạo và sửa chương trình với tên, mô tả, đối tượng, loại hội nhập hoặc chuyên môn và thời gian mục tiêu theo ngày hoặc giờ. Tạo khóa học và dùng chung một khóa học trong nhiều chương trình.
- Dựng module, bài học và lưu thứ tự kéo thả. Khai báo thời lượng dự kiến cho từng bài và hỗ trợ các loại văn bản, tệp tài liệu, video, liên kết bài tri thức, tham chiếu bài kiểm tra. Tái sử dụng kiểm tra quyền đọc tri thức và tệp. Phần soạn và làm bài kiểm tra thuộc F08.
- Sao chép khóa học trong cùng doanh nghiệp thành khóa học Nháp độc lập.

**Hoàn thành khi:** tạo được chương trình đủ thông tin và gắn cùng một khóa học vào hai chương trình. Kéo thả, tải lại và kiểm tra thứ tự được lưu. Lưu và đọc lại được cấu hình của từng loại bài học. Có test chặn tham chiếu trái quyền hoặc khác tenant, hiển thị an toàn nội dung nhập và chứng minh sửa khóa học sao chép không đổi khóa học gốc.

---

## ☑ T15 — Thời lượng và điều kiện hoàn thành khóa học

**FR/AC:** FR-05.05, FR-05.06, AC-01. Chuẩn bị cấu hình cho AC-08. Tham chiếu BR-005, D-05. Phụ thuộc T14.

**Làm:**
- Tính tổng thời lượng từng khóa học và chương trình từ thời lượng bài học. Cảnh báo khi tổng thời lượng vượt mục tiêu. Ghi rõ trong PR cách quy đổi ngày và giờ dùng để so sánh.
- Khởi tạo khóa học mới từ mặc định doanh nghiệp (T08). Cho chỉnh riêng tỷ lệ bài hoàn thành, điểm đạt bài kiểm tra cuối khóa, số lần làm tối đa và xác nhận thực hành của QLTT. Cho bật/tắt từng tiêu chí và chọn học tuần tự hoặc tự do.

**Hoàn thành khi:** tổng thời lượng cập nhật khi sửa thời lượng hoặc thay đổi bài học hay khóa học thành phần. Có test tại ngưỡng và trên ngưỡng mục tiêu cho cả ngày và giờ. Cấu hình mặc định được dùng khi tạo khóa mới, chỉnh riêng và lưu lại đúng theo từng khóa. Việc xét trạng thái Hoàn thành hoặc Chưa đạt của lượt học thuộc F08 (AC-08).

---

## ☑ T16 — Phê duyệt và phiên bản khóa học, chương trình

**FR/AC:** FR-05.07, AC-01, AC-03, AC-04 (đào tạo), AC-05. Tham chiếu BR-003, BR-013, D-02 đến D-04, D-09, NFR-06. Phụ thuộc T12 và T15.

**Làm:**
- Dùng quy trình phê duyệt của T12 cho đào tạo. Gửi duyệt khóa học cùng toàn bộ module và bài học. Chương trình có lượt duyệt riêng. Áp dụng kiểm tra quyền, lý do từ chối, thông báo cho người tạo và AuditLog như với tri thức.
- Giữ nguyên bản khóa học đang xuất bản khi chỉnh sửa Nháp. Cung cấp cho luồng phân bổ của F06 cách lấy phiên bản đã xuất bản mới nhất và cho F07 cách đọc lại đúng phiên bản theo ID. Giữ các phiên bản đã xuất bản để lượt học hiện có tiếp tục dùng bản đã được giao.

**Hoàn thành khi:** kiểm thử khóa học và chương trình được duyệt độc lập, bản chưa duyệt không xuất hiện ở luồng người đọc và khóa chưa xuất bản không đủ điều kiện phân bổ. Sau khi duyệt bản mới, luồng phân bổ mới lấy bản mới nhất, truy vấn theo ID phiên bản cũ vẫn trả nguyên nội dung đã giao. Test từ chối xác nhận người tạo nhận được thông báo và thấy lý do trên Nháp.

---

## ☑ T17 — Sao chép từ bộ mẫu vào doanh nghiệp

**FR/AC:** FR-05.08, AC-01. Chuẩn bị liên kết phiên bản và cờ tùy chỉnh cho FR-05.09, AC-13. Tham chiếu BR-001, D-11. Phụ thuộc T16.

**Làm:**
- Cho ADM và PTĐT đúng phạm vi sao chép mục mẫu đã phát hành ở cấp chương trình, khóa học, module hoặc bài học. Dùng dữ liệu mẫu kiểm thử để cung cấp nguồn đã phát hành trong Giai đoạn 1.
- Tạo bản Nháp thuộc doanh nghiệp. Lưu liên kết tới mục mẫu và phiên bản gốc, đánh dấu nội dung đã tùy chỉnh sau khi sửa.

**Hoàn thành khi:** kiểm thử sao chép ở cả bốn cấp, giữ đúng cấu trúc và thứ tự của phần được chọn. Sửa bản sao không đổi mẫu hoặc bản sao của doanh nghiệp khác. Liên kết nguồn, phiên bản gốc và cờ tùy chỉnh được lưu và đọc lại. Bản sao phải qua phê duyệt trước khi xuất bản.

---

# Giai đoạn 2 — Học tập

T18, T21 và T22 có thể bắt đầu song song. T19 và T23 dùng chung cấu trúc lượt học T18. T20 và phần giao thủ công của T19 có thể phát triển song song sau khi chốt hàm tạo lượt dùng chung.

## ☑ T18 — Lược đồ lượt học

**FR/AC:** F06–F08, AC-05, AC-07, D-07 đến D-10, D-20. Phụ thuộc T03, T16.

- `Enrollment` liên kết nhân viên, khóa học và đúng phiên bản đã giao. Lưu nguồn giao, chương trình hoặc quy tắc nếu có, hạn hoàn thành, trạng thái, tiến độ và thời điểm bắt đầu/hoàn thành.
- Vòng đời dùng `NOT_STARTED`, `IN_PROGRESS`, `OVERDUE`, `COMPLETED`, `FAILED`, `CANCELLED`. Ba trạng thái đầu là lượt đang hiệu lực. Tính hoàn thành trễ bằng cách so sánh thời điểm hoàn thành với hạn lượt học.
- Phân bổ lặp giữ lượt đang hiệu lực và lấy hạn muộn hơn. Giao lại từ lượt đã hoàn thành hoặc chưa đạt tạo lượt mới và giữ liên kết lượt cũ để T23 có thể kế thừa tiến độ của bài không đổi.
- **Hoàn thành khi** migration chạy trên CSDL trống, có RLS, khóa ngoại theo tenant bảo đảm đúng khóa và phiên bản, ràng buộc ngăn hai lượt đang hiệu lực và test cách ly tenant.

## ☑ T19 — Phân bổ thủ công và quản lý lượt học

**FR/AC:** FR-06.03–06.05, AC-05, AC-07, AC-09, D-07 đến D-10. Phụ thuộc T18.

- Giao khóa/chương trình đã xuất bản cho cá nhân, nhóm nhân viên được chọn hoặc phòng ban. Xem danh sách theo khóa, người và trạng thái. Hủy, gia hạn, giao lại theo quyền ADM/PTĐT.
- **Hoàn thành khi** khóa mới dùng phiên bản xuất bản mới nhất, chương trình giao các khóa thành phần cùng hạn, giao đồng thời không tạo trùng và gia hạn cập nhật trạng thái quá hạn đúng. Kế thừa tiến độ khi giao lại kiểm tra cùng T23.

## ☑ T20 — Quy tắc phân bổ tự động

**FR/AC:** FR-03.07, FR-06.01–06.02, AC-06–07, D-08. Phụ thuộc T18 và hàm tạo lượt dùng chung của T19.

- Tạo và sửa quy tắc theo phòng ban, chức danh, số ngày kể từ khi vào làm và hạn tính từ khi giao. Áp dụng khi tạo nhân viên, đổi phòng ban/chức danh hoặc khi quản trị chọn áp dụng cho nhân viên hiện có.
- **Hoàn thành khi** quy tắc giao đúng nhân viên và hạn, dùng chung hành vi chống trùng với phân bổ thủ công, giữ lượt khi nhân viên chuyển phòng ban.

## ☑ T21 — Ngân hàng câu hỏi và soạn đề

**FR/AC:** FR-08.01–08.03, D-05. Phụ thuộc T14, T15.

- Quản lý ba loại câu hỏi, đáp án, giải thích, khóa học/chủ đề và mẫu nhập Excel. Cấu hình đề cố định hoặc rút ngẫu nhiên, thời gian, ngưỡng đạt, số lượt, xáo trộn và hiển thị đáp án.
- **Hoàn thành khi** quản trị viên trong đúng phạm vi soạn được đề và gắn vào bài học kiểm tra. Có test nhập Excel, cấu hình hợp lệ, từ chối dữ liệu sai và cách ly tenant.

## ☑ T22 — Tìm kiếm trong tài liệu PDF và Word

**FR/AC:** FR-04.09, FR-04.06, FR-07.05, NFR-01. Phụ thuộc T10, T13. Có thể làm độc lập với luồng học.

- Mở rộng tìm kiếm của kho tri thức sang văn bản trong tệp PDF/Word đính kèm.
- **Hoàn thành khi** từ khóa chỉ có trong tài liệu tìm được bài tri thức đang xuất bản và đúng phạm vi. Giữ bộ lọc hiện có, kiểm tra cách ly tenant, phiên bản cũ và tệp không đọc được.

## ☑ T23 — Việc học của tôi và tiến độ bài học

**FR/AC:** FR-07.01–07.07, AC-05, AC-09, D-06, D-09, D-10. Phụ thuộc T18, T13 và dùng dữ liệu phân bổ của T19.

- Hiển thị lượt học và lịch sử, nội dung theo phiên bản đã giao, trạng thái, hạn và tiến độ. Hỗ trợ xem tài liệu/video, lưu vị trí, học tuần tự, mở kho tri thức theo quyền. Tích hợp bài kiểm tra qua T24.
- **Hoàn thành khi** nhân viên chỉ truy cập lượt của mình, tiếp tục được lượt quá hạn, khôi phục vị trí học, chỉ kế thừa tiến độ của bài không đổi khi giao lại và dùng được giao diện từ 360px.

## ☑ T24 — Làm bài kiểm tra và lưu lần làm

**FR/AC:** FR-08.04, D-05 đến D-07. Phụ thuộc T18, T21, T23.

- Cố định nội dung và cấu hình bài kiểm tra theo phiên bản khóa học đã giao, kể cả khi ngân hàng câu hỏi hoặc cấu hình đề được sửa. Chốt đề cho từng lần làm, lưu câu trả lời, chấm điểm, tự nộp hết giờ và kết nối kết quả với tiến độ học.
- **Hoàn thành khi** câu trả lời đã lưu vẫn còn khi kết nối lại, đồng hồ dựa trên thời gian máy chủ và lần làm hết giờ chỉ được chấm một lần.

## ☑ T25 — Xác nhận thực hành và xét hoàn thành

**FR/AC:** FR-08.05–08.06, AC-08–09, BR-005, D-05 đến D-07, D-10. Phụ thuộc T23, T24.

- Ghi kết quả thực hành trong phạm vi ADM/QLTT. Xét đủ các tiêu chí bật trên phiên bản đã giao và chuyển Chưa đạt khi hết lần thi mà chưa đạt.
- **Hoàn thành khi** kiểm tra được từng tổ hợp tiêu chí, hoàn thành trễ và luồng giao khóa → học → thi → hoàn thành.

## ☑ T26 — Khảo sát chất lượng khóa học

**FR/AC:** FR-08.07, P-01. Phụ thuộc T25 cho điều kiện gửi khảo sát. Có thể triển khai mẫu và biểu mẫu trước.

- Cho doanh nghiệp chỉnh mẫu mặc định và nhân viên đã hoàn thành khóa học gửi khảo sát tùy chọn.
- **Hoàn thành khi** quyền quản lý mẫu và gửi khảo sát đúng phạm vi, phản hồi gắn đúng lượt học và trạng thái hoàn thành không phụ thuộc khảo sát.

## Giai đoạn 3 — Bàn giao và vận hành

## ☑ T27 — Bàn giao tri thức

**FR/AC:** FR-03.06, FR-04.08, FR-10.01–10.08, AC-10–12, BR-006, BR-010, BR-015, D-13–16.

- Đánh dấu nghỉ việc, lập hoặc lập thay hồ sơ, đính kèm tệp, tiếp nhận từng hạng mục, yêu cầu bổ sung và xác nhận hoàn tất. Tạo bản nháp tri thức từ hạng mục kinh nghiệm đã tiếp nhận.
- **Kiểm tra thủ công** tại **Bàn giao**. Tạo hồ sơ với một hạng mục, đổi sang tài khoản người nhận để từ chối rồi tiếp nhận bản đã bổ sung. Quay lại bằng tài khoản quản lý trực tiếp hoặc ADM để xác nhận và kiểm tra tài khoản nghỉ việc đã bị vô hiệu hóa.
- Khi không cấu hình số ngày bàn giao, hệ thống lấy ngày nghỉ việc làm hạn. Quyền trong phiên được giới hạn vào ngày nghỉ việc hoặc sau hạn bàn giao, tùy thời điểm nào đến trước.

## ☑ T28 — Thông báo trong ứng dụng và email

**FR/AC:** FR-11.01–11.06, AC-04, AC-10.

- Xem chuông thông báo, đánh dấu đã đọc và cấu hình nhóm email tùy chọn. Email chỉ chứa lời báo có thông báo mới và liên kết đăng nhập. Chi tiết sự kiện nằm trong ứng dụng.
- **Kiểm tra thủ công** bằng cách tạo hồ sơ bàn giao, mở chuông bằng tài khoản người nhận và kiểm tra bản xem trước email trên Mailpit cục bộ nếu đã cấu hình SMTP.

## ☑ T29 — Tổng quan và báo cáo đào tạo

**FR/AC:** FR-09.01–09.08, AC-09, AC-14.

- Xem tiến độ, kết quả kiểm tra, khảo sát và trạng thái bàn giao theo quyền. Cùng truy vấn lọc được dùng cho màn hình và tệp Excel.
- **Kiểm tra thủ công** tại **Báo cáo đào tạo**. Lọc phòng ban, khóa học và thời gian, đối chiếu lượt học với danh sách phân bổ, rồi xuất Excel và đối chiếu các dòng trong trang tính **Tiến độ**.

## Giai đoạn 4 — Thương mại hóa

### ☑ T30 — Quản lý và phát hành bộ mẫu

**FR/AC:** FR-01.04, FR-01.05, FR-05.08, AC-01.

- QTNT soạn cây chương trình, khóa học, module và bài học văn bản, phân loại theo ngành nghề và nhóm vị trí, quản lý ngân hàng câu hỏi và phát hành kèm ghi chú thay đổi.
- **Kiểm tra thủ công** tại **Bộ mẫu**. Chọn bộ mẫu hội nhập, sửa một bài và phát hành. Dùng tài khoản ADM của doanh nghiệp đã sao chép bộ mẫu để kiểm tra chuông thông báo.

### ☑ T31 — So sánh và áp dụng cập nhật bộ mẫu

**FR/AC:** FR-05.09, AC-01, AC-13, BR-008, BR-014, D-12.

- **Kiểm tra thủ công** tại **Đào tạo → Cập nhật từ bộ mẫu**. Chọn khóa học có liên kết bộ mẫu, mở so sánh ở cấp module và chọn **Giữ** hoặc **Thay**. Kiểm tra module bên cạnh và bản đã phát hành. Với **Tạo bản sao**, kiểm tra bản sao ở cấp đã chọn và bản gốc vẫn còn.
- Mỗi lần áp dụng thay đổi vào khóa học tạo bản nháp qua quy trình duyệt đã có. Lựa chọn **Giữ** giữ cập nhật trong danh sách để xem lại.

### ☑ T32 — Thống kê và nhật ký nền tảng

**FR/AC:** FR-01.06, FR-01.07, AC-01.

- **Kiểm tra thủ công** tại **Báo cáo nền tảng** bằng tài khoản QTNT. Kiểm tra số doanh nghiệp, tài khoản, dung lượng, thuê bao hết hạn trong 30 ngày và sự kiện phát hành bộ mẫu.

## Phụ thuộc theo giai đoạn

- **Giai đoạn 3:** nối FR-04.08 với FR-10.07 để hạng mục bàn giao được đánh dấu chuyển thành Nháp tri thức. F11 mở rộng thông báo sau phần thông báo từ chối cần cho AC-04.
- **Giai đoạn 4:** FR-01.04 và FR-01.05 cung cấp bộ mẫu và quy trình phát hành. FR-05.09 dùng liên kết từ T17 để liệt kê, so sánh và áp dụng cập nhật theo khóa học, module hoặc bài học. Kiểm thử AC-13 phải xác nhận cập nhật một module chỉ thay đổi module đó, tạo Nháp cần duyệt và giữ mục tùy chỉnh khi chọn Giữ.
