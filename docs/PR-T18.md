# T18 — Lược đồ lượt học

## FR/AC đã đáp ứng

- **F06–F08, AC-05, D-09** — Một lượt học lưu khóa học và ID phiên bản đã giao. Khóa ngoại ghép kiểm tra phiên bản thuộc đúng khóa học, đúng doanh nghiệp. Trigger bảo vệ danh tính lượt và phiên bản khi cập nhật trạng thái.
- **AC-07, D-07, D-08** — Chỉ cho phép một lượt đang hiệu lực cho mỗi nhân viên và khóa học. Lượt giao lại có ID riêng và liên kết tới lượt cũ của chính nhân viên và khóa học đó.
- **AC-09, D-10** — Lưu hạn, tiến độ và thời điểm bắt đầu/hoàn thành để luồng học và báo cáo có thể xác định hoàn thành trễ.
- **D-20, NFR-01** — PostgreSQL buộc RLS và giới hạn thao tác theo tenant đã xác thực. T18 có kiểm tra đọc/ghi chéo tenant, trùng lượt và phiên bản sai khóa.

## Giả định triển khai

- Hạn và sự kiện lưu dạng timestamp. Giao diện định dạng theo giờ Việt Nam. T19 tính hạn thủ công đến cuối ngày người quản trị chọn.
- Lượt quá hạn vẫn tính là đang hiệu lực trong ràng buộc chống trùng. Lượt mới tạo khi giao lại liên kết lượt cũ để T23 kế thừa tiến độ phù hợp.

## Kiểm tra thủ công

1. Dùng PostgreSQL kiểm thử trống rồi chạy `pnpm db:migrate`.
2. Bật `TENANT_INTEGRATION_TEST=true` và chạy `pnpm --filter @educore36/api test --runTestsByPath src/learning/learning.integration.spec.ts`.
3. Qua màn hình Phân bổ đào tạo của T19, giao cùng khóa học cho một nhân viên hai lần với các hạn khác nhau. Mở danh sách và kiểm tra chỉ có một lượt đang hiệu lực với hạn muộn hơn.
