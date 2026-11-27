# T23 — Việc học của tôi và tiến độ bài học

## FR/AC đã đáp ứng

- **FR-07.01, FR-07.07, AC-05, AC-09** — Danh sách sắp theo hạn, hiển thị trạng thái và tiến độ. Nhân viên xem đúng phiên bản được giao và có thể tiếp tục khóa đã quá hạn. Bài kiểm thử trình duyệt đặt chiều rộng 360 px.
- **FR-07.02–07.04, D-06, D-09** — Hiển thị bài văn bản, PDF, video trực tiếp và bài tri thức. Ghi nhớ bài đang học, vị trí video và đoạn đã xem, kiểm tra thứ tự ở máy chủ, kế thừa tiến độ của các bài giữ nguyên khi giao lại.
- **FR-07.05, FR-07.06** — Có lối vào kho tri thức và lịch sử lượt đã kết thúc với điểm kiểm tra cuối khóa, ngày hoàn thành và trạng thái trễ hạn từ T24/T25.
- **NFR-01, NFR-03** — API kiểm tra quyền học và chủ sở hữu lượt trong tenant. Đường dẫn tệp được cấp sau khi kiểm tra quyền mở bài.

## Giả định triển khai

- Theo dõi tiến độ khi video phát trong trình phát HTML5 qua tệp tải lên hoặc liên kết media trực tiếp. Trang video của nhà cung cấp mở qua liên kết nguồn. Tích hợp theo dõi trình phát của từng nhà cung cấp cần làm thêm khi chọn triển khai.
- Bài tri thức liên kết mở bản hiện hành theo phạm vi của người học. Bài kiểm tra hoạt động ngay trong khóa học. Chỉ kế thừa kết quả đạt của bài kiểm tra còn giữ nguyên đề và đáp ứng ngưỡng của phiên bản mới.

## Kiểm tra thủ công

1. Xuất bản khóa học tuần tự có hai bài, rồi giao cho một nhân viên trong phần Phân bổ đào tạo.
2. Đăng nhập bằng chính nhân viên, mở **Việc học của tôi** ở chiều rộng 360 px. Hoàn thành bài đầu và kiểm tra bài thứ hai mở ra. Tải lại màn hình và kiểm tra trạng thái vẫn còn.
3. Tạo lượt quá hạn, thử mở PDF hoặc xem video qua trình phát, tải lại bài và kiểm tra vị trí học.
4. Chạy `pnpm --filter @educore36/api test --runTestsByPath src/learning/learning.integration.spec.ts` với `TENANT_INTEGRATION_TEST=true` và PostgreSQL kiểm thử đã migrate. Chạy `pnpm test:e2e tests/e2e/learning.spec.ts` với `WORKSPACE_E2E=true` sau khi seed CSDL.
