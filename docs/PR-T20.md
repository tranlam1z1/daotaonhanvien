# T20 — Quy tắc phân bổ tự động

## Phạm vi

- Theo FR-06.01, FR-06.02, FR-03.07 và AC-06, ADM và PTĐT đúng phạm vi tạo, chỉnh sửa hoặc tắt quy tắc theo phòng ban, chức danh và số ngày từ ngày vào làm. Có lựa chọn áp dụng cho nhân viên hiện có.
- Tạo nhân viên, nhập nhân viên và thay đổi phòng ban hoặc chức danh đều chạy quy tắc phù hợp trong cùng giao dịch. T20 dùng cơ chế tạo lượt học và xử lý trùng từ T19. Nhân viên đổi phòng ban giữ nguyên các lượt đã được giao.
- Quy tắc và lượt học liên kết cùng tenant, dùng RLS và chặn truy cập qua ID nước ngoài.

## Giả định

- Các điều kiện được kết hợp theo AND, số ngày tính theo ngày lịch tại Việt Nam và tính cả ngày vào làm. Hạn tự động được tính từ thời điểm giao.
- Quy tắc có thể phân bổ cho tài khoản đang chờ kích hoạt để lượt đã sẵn sàng khi nhân viên đăng nhập. Sau khi một lượt kết thúc, người quản lý dùng **Giao lại** chủ động để tạo lượt mới.
- Quy tắc do PTĐT có phạm vi phòng ban tạo phải có phòng ban nhận và giữ phạm vi nội dung khi được chạy tự động. Khi nội dung chương trình thay đổi sang phạm vi ngoài quyền đã lưu, quy tắc bỏ qua lượt phân bổ đó.

## Kiểm tra thủ công

1. Xuất bản khóa học hoặc chương trình, mở **Phân bổ đào tạo** và tạo quy tắc cho một phòng ban để giao sau ba ngày.
2. Tạo nhân viên trong phòng ban và kiểm tra có lượt tự động ngay với đúng hạn. Chuyển nhân viên khác vào phòng ban để kiểm tra quy tắc chạy lại rồi chuyển ra và kiểm tra lượt đã giao còn tồn tại.
3. Chỉnh sửa quy tắc với **Áp dụng cho nhân viên hiện có**, kiểm tra các nhân viên phù hợp nhận nội dung và không phát sinh hai lượt hiệu lực.
4. Chạy suite Supertest tenant với `TENANT_INTEGRATION_TEST=true` và PostgreSQL kiểm thử đã migrate.
