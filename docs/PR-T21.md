# T21 — Ngân hàng câu hỏi và soạn đề kiểm tra

## FR đã đáp ứng

- **FR-08.01** — Nhóm câu hỏi theo khóa học hoặc chủ đề trong phạm vi doanh nghiệp/phòng ban. Hỗ trợ một đáp án, nhiều đáp án, đúng/sai và giải thích.
- **FR-08.02** — Cung cấp mẫu Excel có hướng dẫn. Nhập theo nhóm đã chọn, báo lỗi theo dòng và lưu cả lô khi mọi dòng hợp lệ.
- **FR-08.03** — Soạn đề với thứ tự câu hỏi cố định hoặc số câu được rút từ tập đã chọn. Lưu thời gian làm, điểm đạt, số lần làm tối đa, xáo trộn câu hỏi/phương án và cách hiển thị đáp án sau khi nộp.
- **NFR-01, NFR-03** — API phân quyền theo `assessments.manage`. RLS và khóa ngoại theo tenant bảo vệ câu hỏi và danh sách câu hỏi của đề.

## Giả định

- Người soạn chọn riêng tập ứng viên cho mỗi đề ngẫu nhiên. Câu hỏi và bài kiểm tra dùng cùng phạm vi phòng ban hoặc toàn doanh nghiệp. Giữ phạm vi sau khi tạo để tham chiếu trong bài học dùng được.
- Mẫu Excel dùng tệp `.xlsx`. Mỗi lần nhập chọn một nhóm và dùng các chỉ số đáp án bắt đầu từ 1. Giá trị mặc định điểm đạt và số lần làm lấy từ cấu hình doanh nghiệp.
- Bản ghi bài kiểm tra cũ vẫn tải được và hiển thị Chưa cấu hình đề cho đến khi được lưu từ màn hình soạn đề.

## Kiểm tra thủ công

1. Đăng nhập với quyền quản lý kiểm tra. Vào **Kiểm tra và khảo sát**, tạo câu theo khóa học và theo chủ đề bằng ba loại câu hỏi.
2. Tải mẫu tại **Nhập Excel**, nhập câu hợp lệ và thử một dòng sai đáp án. Kiểm tra lỗi đúng dòng và số câu đã nhập khi sửa hợp lệ.
3. Tạo đề cố định, đổi thứ tự một câu, lưu và mở lại. Đổi sang rút ngẫu nhiên, đặt số câu và bật các tùy chọn.
4. Sang **Đào tạo**, thêm bài học loại Bài kiểm tra với đề vừa tạo trong cùng phạm vi.
5. Chạy test tích hợp `assessments.integration.spec.ts` với `TENANT_INTEGRATION_TEST=true` và CSDL kiểm thử đã chạy migration.
