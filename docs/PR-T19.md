# T19 — Phân bổ thủ công và quản lý lượt học

## Phạm vi

- Theo FR-06.03 và FR-06.05, ADM và PTĐT đúng phạm vi giao khóa học hoặc chương trình đã xuất bản cho một hay nhiều nhân viên hoặc cả phòng ban. Danh sách lọc theo khóa học, nhân viên và trạng thái.
- FR-06.04, D-07 đến D-10, AC-05 và AC-07 bao gồm hủy và gia hạn lượt đang hiệu lực, giao lại lượt Hoàn thành hoặc Chưa đạt, giữ bản khóa đã giao. Lượt giao lại nối với lượt trước và dùng phiên bản xuất bản mới nhất. T23 đối chiếu bài học để giữ tiến độ của các bài không đổi.
- Với AC-09, danh sách quản trị ghi nhận lượt Quá hạn ngay khi đọc sau hạn. Gia hạn lượt Quá hạn trả về Chưa bắt đầu hoặc Đang học theo thời điểm bắt đầu đã lưu.

## Giả định

- Nhóm nhân viên là danh sách được chọn cho lần phân bổ; toàn bộ thành viên nhận cùng hạn. Phân bổ phòng ban tính thành viên trực tiếp.
- Hạn ngày được lưu đến cuối ngày theo Asia/Ho_Chi_Minh. Phân bổ chương trình dựa trên danh sách khóa ở phiên bản chương trình đã xuất bản và phiên bản đã xuất bản mới nhất của từng khóa đủ điều kiện phân bổ.
- PTĐT có phạm vi phòng ban chỉ quản lý người nhận và phiên bản khóa nằm trong phạm vi. Lượt cũ được giữ lại khi hủy hoặc giao lại.

## Kiểm tra thủ công

1. Đăng nhập ADM, xuất bản khóa học rồi mở **Phân bổ đào tạo**. Chọn khóa học, nhân viên và hạn, sau đó lọc danh sách theo khóa và nhân viên.
2. Giao lại cùng khóa cho nhân viên với hạn muộn hơn trong biểu mẫu phân bổ. Kiểm tra danh sách giữ một lượt đang hiệu lực và lấy hạn muộn hơn.
3. Thực hiện **Gia hạn** hoặc **Hủy phân bổ** với lượt đang hiệu lực. Với lượt Chưa đạt hoặc Hoàn thành, dùng **Giao lại** và kiểm tra còn lịch sử lượt cũ.
4. Chạy suite Supertest tenant với `TENANT_INTEGRATION_TEST=true` và PostgreSQL kiểm thử đã migrate để xác nhận giao đồng thời, phiên bản, hạn, chương trình và cách ly tenant.
