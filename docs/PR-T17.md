# T17 — Sao chép từ bộ mẫu vào doanh nghiệp

## FR/AC

- **FR-05.08, BR-001, D-11** — ADM và PTĐT đúng phạm vi có thể sao chép chương trình, khóa học, module hoặc bài học từ Thư viện bộ mẫu. Bản sao dùng luồng lưu nội dung đào tạo của doanh nghiệp và giữ thứ tự của các mục được chọn.
- **AC-01** — Kiểm thử API xác nhận doanh nghiệp không đọc hoặc sửa được bản sao của doanh nghiệp khác. Kiểm thử cũng xác nhận phân quyền ADM, PTĐT, nhân viên và phòng ban đích. Sửa bản sao giữ nguyên mẫu phát hành và bản sao ở doanh nghiệp khác.
- **FR-05.09, AC-13** — Các mục được sao chép lưu mã mục mẫu, phiên bản gốc và cờ tùy chỉnh để luồng cập nhật theo từng mục có thể dùng sau này. So sánh và áp dụng bản cập nhật thuộc Giai đoạn 4.
- **FR-05.07, AC-03, tích hợp T16** — Chương trình và khóa học sao chép bắt đầu ở trạng thái Nháp và có lượt duyệt riêng. Khi tắt tự phê duyệt, API chặn người tạo xuất bản trực tiếp hoặc tự duyệt. Nhân viên chỉ đọc được nội dung sau khi duyệt. Khóa học chỉ đủ điều kiện phân bổ sau khi chính khóa học được duyệt. Phiên bản xuất bản giữ liên kết tới mục mẫu và phiên bản gốc.

## Giả định

- Giai đoạn 1 sử dụng phiên bản `onboarding-1` của bộ mẫu hội nhập. Dữ liệu kiểm thử dùng bài học văn bản để có thể sao chép giữa các doanh nghiệp mà không cần tham chiếu tệp hoặc dữ liệu nghiệp vụ của một doanh nghiệp.
- Khi sao chép một module hoặc một bài học, hệ thống tạo một khóa học nháp chứa đúng phần được chọn. Với bài học, hệ thống tạo thêm module chứa bài. Liên kết nguồn gắn với mục được chọn và các mục con đã sao chép.
- Thao tác lưu không thay đổi nội dung giữ nguyên cờ tùy chỉnh. Cờ đã bật được giữ qua các lần lưu sau. Thêm, xóa hoặc đổi thứ tự mục con đánh dấu phần cấu trúc chứa mục đó.
- PTĐT có phạm vi phòng ban chọn phòng ban trong phạm vi được giao. Khóa học mới dùng mặc định hoàn thành của doanh nghiệp đích.

## Kiểm tra thủ công

1. Chạy dịch vụ local, `pnpm db:migrate`, `pnpm db:seed` và `pnpm dev`. Đăng nhập ADM, mở **Đào tạo → Thư viện bộ mẫu → Mở thư viện**.
2. Chọn lần lượt một chương trình, một khóa học, một module và một bài học, rồi bấm **Sao chép thành bản nháp**. Mở từng bản sao, tải lại trang và đối chiếu tên, cấu trúc, thứ tự cùng phiên bản gốc `onboarding-1`.
3. Sửa một bài trong bản sao và lưu. Mở lại để kiểm tra nhãn **Đã tùy chỉnh**. Sao chép lại bài đó từ bộ mẫu và đối chiếu với bản mới. Dùng ADM ở doanh nghiệp thứ hai để xác nhận bản sao của doanh nghiệp thứ hai giữ nguyên và gọi API theo ID bản sao của doanh nghiệp thứ nhất trả `404`.
4. Đăng nhập PTĐT có phạm vi phòng ban, chọn phòng ban được giao rồi sao chép. Thử dùng phòng ban ngoài phạm vi trong yêu cầu `POST /training/templates/lesson/work-tools/copy` và kiểm tra API trả `403`.
5. Tắt tự phê duyệt trong cấu hình doanh nghiệp. Dùng ADM sao chép một chương trình vào phòng ban của người duyệt, rồi bấm **Gửi duyệt** cho chương trình và một khóa học thành phần. Dùng phiên NV gọi `GET /training/read/programs/{id}` và `GET /training/read/courses/{id}`, kiểm tra cả hai trả `404`. Dùng PD đúng phòng ban chọn **Duyệt và xuất bản** cho chương trình trước. Kiểm tra chương trình đã đọc được, còn khóa học vẫn trả `404` ở cả luồng đọc và `GET /training/assignable/courses/{id}` bằng phiên ADM. Duyệt riêng khóa học rồi kiểm tra luồng đọc và phân bổ cùng trả phiên bản vừa xuất bản.

## Xác minh

- **pnpm lint**, **pnpm typecheck** và **pnpm test** đạt với pnpm 10.32.1. Chạy mặc định ghi nhận 94 bài đạt và 135 bài tích hợp được bỏ qua theo cấu hình.
- **pnpm db:migrate** đạt trên PostgreSQL 16 trống với cả migration T16 và T17. Bật **TENANT_INTEGRATION_TEST=true** và chạy riêng ba bộ kiểm thử T16–T17 trên cơ sở dữ liệu này. Cả 16 bài đạt, gồm 12 bài T17 và 4 bài phê duyệt T16.
