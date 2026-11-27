# PRD-EDU-001 – Nền tảng quản trị tri thức và đào tạo nội bộ doanh nghiệp

*Tài liệu yêu cầu sản phẩm – Phiên bản 1.1 (MVP)*

| **Thông tin**       | **Giá trị**                                                                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------|
| Mã tài liệu         | PRD-EDU-001                                                                                                        |
| Tên sản phẩm        | Nền tảng quản trị tri thức và đào tạo nội bộ doanh nghiệp (tên thương mại dự kiến: EduCore36 / TriThuc36)          |
| Phiên bản           | 1.1 – PRD cho MVP, bổ sung landing page                                                                            |
| Ngày cập nhật       | 27/11/2026                                                                                                         |
| Định hướng          | Sản phẩm thương mại SaaS, đa doanh nghiệp                                                                          |
| Thị trường mục tiêu | Doanh nghiệp tại Thanh Hóa                                                                                         |
| Trạng thái          | Baseline để phát triển MVP. Các quyết định mặc định (mã D-xx) dùng để bắt đầu làm, cần xác nhận trong vòng review. |

## Lịch sử phiên bản

| **Phiên bản** | **Ngày**   | **Nội dung thay đổi**                                                                                                                                                                                                             |
|---------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0.4           | 27/10/2026 | Tổng hợp yêu cầu nghiệp vụ đã chốt, BR-001 đến BR-016                                                                                                                                                                             |
| 0.5           | 27/11/2026 | Bổ sung đối chiếu chức năng với MISA AMIS và các đề xuất P-01 đến P-07                                                                                                                                                            |
| 1.0           | 27/11/2026 | PRD hoàn chỉnh cho MVP: phạm vi, ma trận phân quyền, quyết định mặc định cho các vấn đề còn mở, đặc tả chức năng, luồng trạng thái, mô hình dữ liệu, yêu cầu phi chức năng, công nghệ, kế hoạch triển khai và tiêu chí nghiệm thu |
| 1.1           | 27/11/2026 | Bổ sung phân hệ F12 – Landing page và đăng ký pilot theo bản thiết kế EduCore36; thêm thực thể Lead, màn hình S13, tiêu chí AC-16 đến AC-18                                                                                       |

## Quy ước đọc tài liệu

- **BR-xxx:** Business Rule đã chốt ở v0.4. Không thay đổi nếu chưa có quyết định mới.

- **D-xx:** Quyết định mặc định cho MVP, dùng để phát triển ngay. Có thể điều chỉnh sau review; khi được xác nhận sẽ chuyển thành BR.

- **FR-xx.yy:** Yêu cầu chức năng thuộc phân hệ Fxx.

- **NFR-xx:** Yêu cầu phi chức năng.

- **AC-xx:** Tiêu chí nghiệm thu.

- **Mức ưu tiên:** MVP = bắt buộc có trong bản phát hành đầu; GĐ2 = giai đoạn sau MVP.

**Mục lục**

I. Tổng quan sản phẩm

II\. Phạm vi sản phẩm

III\. Vai trò và phân quyền

IV\. Business Rules

V. Đặc tả chức năng

VI\. Luồng nghiệp vụ và trạng thái

VII\. Mô hình dữ liệu

VIII\. Yêu cầu phi chức năng

IX\. Kiến trúc và công nghệ đề xuất

X. Danh sách màn hình

XI\. Kế hoạch triển khai MVP

XII\. Tiêu chí nghiệm thu chính

XIII\. Vấn đề cần xác nhận

Phụ lục A. Đối chiếu với MISA AMIS

Phụ lục B. Thuật ngữ

# I. Tổng quan sản phẩm

## 1. Bối cảnh nghiệp vụ

Trong quá trình hoạt động, doanh nghiệp tích lũy nhiều dữ liệu, tài liệu, quy trình làm việc và kinh nghiệm nghiệp vụ. Những tri thức này thường nằm phân tán tại các phòng ban hoặc phụ thuộc vào từng nhân viên. Khi nhân viên mới gia nhập, doanh nghiệp phải hướng dẫn lại kiến thức chung và nghiệp vụ theo vị trí. Khi nhân viên nghỉ việc, kiến thức và kinh nghiệm có nguy cơ bị thất lạc nếu không được bàn giao và chuẩn hóa.

## 2. Mục tiêu sản phẩm

1.  Tập trung và lưu giữ tri thức đã tích lũy trong quá trình hoạt động.

2.  Chuẩn hóa tài liệu, quy trình và kiến thức nghiệp vụ.

3.  Đào tạo hội nhập cho nhân viên mới.

4.  Đào tạo chuyên môn theo phòng ban, chức danh và nhiệm vụ.

5.  Tổ chức kiến thức thành chương trình, khóa học, module và bài học.

6.  Phân bổ khối lượng kiến thức phù hợp với thời gian đào tạo.

7.  Theo dõi, đánh giá kết quả học tập của nhân viên.

8.  Bắt buộc bàn giao công việc, tri thức khi nhân viên nghỉ việc.

9.  Kế thừa kiến thức đã được chuẩn hóa để đào tạo nhân viên tiếp theo.

## 3. Mục tiêu thương mại

Phát triển một nền tảng dùng chung, triển khai cho nhiều doanh nghiệp trên địa bàn tỉnh Thanh Hóa. Mỗi doanh nghiệp tự thiết lập dữ liệu và chương trình đào tạo phù hợp với đặc thù hoạt động mà không cần phát triển phần mềm riêng.

## 4. Ba trụ cột nghiệp vụ

| **Trụ cột**         | **Nội dung**                                                                 |
|---------------------|------------------------------------------------------------------------------|
| Quản trị tri thức   | Tập trung, chuẩn hóa, phê duyệt và cập nhật kiến thức doanh nghiệp           |
| Đào tạo theo vị trí | Cung cấp đúng kiến thức cho đúng người, theo dõi tiến độ và đánh giá kết quả |
| Kế thừa tri thức    | Bàn giao, tiếp nhận và duy trì kiến thức khi nhân sự thay đổi                |

## 5. Chỉ số thành công (đề xuất, đo sau 3 tháng pilot)

| **Chỉ số**                                                    | **Mục tiêu**       |
|---------------------------------------------------------------|--------------------|
| Số doanh nghiệp pilot sử dụng thực tế                         | ≥ 3 doanh nghiệp   |
| Tỷ lệ nhân viên mới hoàn thành chương trình hội nhập đúng hạn | ≥ 80%              |
| Tỷ lệ nhân viên nghỉ việc có hồ sơ bàn giao hoàn tất          | 100% (theo BR-006) |
| Số nội dung tri thức đã xuất bản trên mỗi doanh nghiệp        | ≥ 30 nội dung      |
| Điểm hài lòng trung bình khảo sát khóa học                    | ≥ 4/5              |

# II. Phạm vi sản phẩm

## 1. Mô hình sản phẩm đã chốt

Mô hình B – Có bộ mẫu chuẩn, doanh nghiệp được tùy chỉnh (BR-001). Nền tảng dùng chung cho nhiều doanh nghiệp; dữ liệu từng doanh nghiệp được quản lý độc lập. Nhà cung cấp xây dựng và phát hành bộ mẫu đào tạo; doanh nghiệp được tạo mới, bổ sung, chỉnh sửa và chủ động áp dụng bản cập nhật (BR-008, BR-014). Thu phí thuê bao theo số tài khoản nhân viên đang kích hoạt (BR-011, BR-016).

## 2. Phạm vi MVP

| **Mã** | **Phân hệ**                   | **Nội dung trong MVP**                                                                   | **Ưu tiên** |
|--------|-------------------------------|------------------------------------------------------------------------------------------|-------------|
| F01    | Quản trị nền tảng             | Doanh nghiệp khách hàng, gói thuê bao, bộ mẫu và phát hành phiên bản                     | MVP         |
| F02    | Quản trị doanh nghiệp         | Hồ sơ doanh nghiệp, phòng ban, chức danh, cấu hình                                       | MVP         |
| F03    | Nhân viên và phân quyền       | Tài khoản, nhập Excel, vai trò, kích hoạt, nghỉ việc                                     | MVP         |
| F04    | Kho tri thức                  | Nội dung tri thức, phạm vi truy cập, phê duyệt, phiên bản, tìm kiếm                      | MVP         |
| F05    | Quản lý đào tạo               | Chương trình, khóa học, module, bài học, điều kiện hoàn thành                            | MVP         |
| F06    | Phân bổ đào tạo               | Quy tắc tự động, phân bổ thủ công, hạn hoàn thành, giao lại                              | MVP         |
| F07    | Học tập nhân viên             | Việc học của tôi, xem bài học, tiến độ, tra cứu tri thức                                 | MVP         |
| F08    | Kiểm tra, đánh giá            | Ngân hàng câu hỏi, bài kiểm tra, xác nhận thực hành, khảo sát chất lượng khóa học (P-01) | MVP         |
| F09    | Báo cáo                       | Tổng quan, tiến độ, kết quả, bàn giao, xuất Excel                                        | MVP         |
| F10    | Bàn giao tri thức             | Hồ sơ bàn giao, tiếp nhận, xác nhận, lập thay, chuyển thành tri thức                     | MVP         |
| F11    | Thông báo                     | Thông báo trong ứng dụng và email theo sự kiện                                           | MVP         |
| F12    | Landing page và đăng ký pilot | Trang giới thiệu công khai, form đăng ký pilot, quản lý danh sách đăng ký                | MVP         |

## 3. Giai đoạn 2 (sau MVP)

| **Mã** | **Chức năng**                                                 | **Phân hệ** |
|--------|---------------------------------------------------------------|-------------|
| P-02   | Kế hoạch đào tạo theo kỳ (năm, quý), theo dõi tỷ lệ thực hiện | F05, F09    |
| P-03   | Đề xuất nhu cầu đào tạo từ nhân viên hoặc quản lý             | F05         |
| P-04   | Buổi đào tạo trực tiếp: lịch học, địa điểm, điểm danh         | F05, F07    |
| P-05   | Nhân viên tự đăng ký khóa học tự chọn                         | F06         |
| P-06   | Chi phí đào tạo theo khóa học                                 | F09         |
| P-07   | Cam kết làm việc sau đào tạo do doanh nghiệp tài trợ          | F03, F09    |
| —      | Ứng dụng di động gốc (MVP dùng web responsive)                | —           |
| —      | Cổng thanh toán trực tuyến (MVP ghi nhận thanh toán thủ công) | F01         |

## 4. Ngoài phạm vi

- Tính năng AI (sinh nội dung, trợ lý hỏi đáp, gợi ý lộ trình).

- Tích hợp ERP, HRM, phần mềm kế toán hoặc đồng bộ nhân sự tự động.

- Quản lý khung năng lực.

- Cấp chứng chỉ hoàn thành.

- Đăng nhập một lần (SSO), đăng nhập bằng mạng xã hội.

- Giao diện đa ngôn ngữ (MVP chỉ tiếng Việt).

# III. Vai trò và phân quyền

## 1. Vai trò

| **Vai trò**                    | **Trách nhiệm**                                                                                                                                                       |
|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Quản trị nền tảng (QTNT)       | Thuộc nhà cung cấp. Quản lý doanh nghiệp khách hàng, gói thuê bao, bộ mẫu đào tạo. Không xem nội dung đào tạo, kết quả học tập của doanh nghiệp.                      |
| Admin doanh nghiệp (ADM)       | Quản trị toàn bộ dữ liệu của doanh nghiệp; tạo, sửa, phê duyệt nội dung; phân quyền                                                                                   |
| Người phụ trách đào tạo (PTĐT) | Tạo, sửa nội dung theo phạm vi được cấp; phân bổ đào tạo; xem báo cáo đào tạo                                                                                         |
| Người phê duyệt (PD)           | Lãnh đạo/quản lý được phân quyền phê duyệt nội dung (BR-007)                                                                                                          |
| Quản lý trực tiếp (QLTT)       | Xác định qua trường “quản lý trực tiếp” của nhân viên. Xem tiến độ cấp dưới, xác nhận thực hành, xác nhận hoàn tất bàn giao, lập hồ sơ bàn giao thay (BR-010, BR-015) |
| Nhân viên (NV)                 | Học tập, làm bài kiểm tra, khảo sát, tra cứu tri thức, lập hồ sơ bàn giao khi nghỉ việc                                                                               |
| Người nhận bàn giao (NNBG)     | Vai trò theo ngữ cảnh: nhân viên được chỉ định nhận hạng mục bàn giao, kiểm tra và xác nhận tiếp nhận                                                                 |

Một người có thể có nhiều vai trò. Mọi tài khoản trong doanh nghiệp đều có vai trò NV. QLTT và NNBG là vai trò theo ngữ cảnh, không cần gán.

## 2. Ma trận phân quyền (D-01)

Ký hiệu: ✓ = có quyền; P = trong phạm vi phòng ban/nội dung được cấp; C = chỉ cấp dưới trực tiếp; R = chỉ xem; — = không có quyền.

| **Chức năng**                                       | **QTNT**     | **ADM**      | **PTĐT** | **PD** | **QLTT**     | **NV**       |
|-----------------------------------------------------|--------------|--------------|----------|--------|--------------|--------------|
| Quản lý doanh nghiệp, gói, bộ mẫu                   | ✓            | —            | —        | —      | —            | —            |
| Hồ sơ doanh nghiệp, phòng ban, chức danh, cấu hình  | —            | ✓            | R        | R      | R            | —            |
| Quản lý nhân viên, kích hoạt tài khoản, gán vai trò | —            | ✓            | —        | —      | —            | —            |
| Tạo, sửa nội dung tri thức và đào tạo               | —            | ✓            | P        | —      | —            | —            |
| Phê duyệt nội dung                                  | —            | ✓            | —        | P      | —            | —            |
| Áp dụng cập nhật bộ mẫu                             | —            | ✓            | P        | —      | —            | —            |
| Quy tắc phân bổ, phân bổ thủ công                   | —            | ✓            | P        | —      | —            | —            |
| Ngân hàng câu hỏi, bài kiểm tra, khảo sát           | —            | ✓            | P        | —      | —            | —            |
| Học tập, làm bài, khảo sát                          | —            | ✓            | ✓        | ✓      | ✓            | ✓            |
| Tra cứu kho tri thức đã xuất bản                    | —            | ✓            | ✓        | ✓      | ✓            | Theo phạm vi |
| Xác nhận thực hành                                  | —            | ✓            | —        | —      | C            | —            |
| Báo cáo đào tạo                                     | R (tổng hợp) | ✓            | P        | —      | C            | Của mình     |
| Đánh dấu nghỉ việc, khởi tạo bàn giao               | —            | ✓            | —        | —      | C            | —            |
| Lập hồ sơ bàn giao                                  | —            | ✓ (lập thay) | —        | —      | C (lập thay) | Của mình     |
| Xác nhận hoàn tất bàn giao                          | —            | ✓            | —        | —      | C            | —            |

*Phạm vi P của PTĐT và PD được cấu hình theo danh sách phòng ban khi gán vai trò; để trống nghĩa là toàn doanh nghiệp.*

# IV. Business Rules

## 1. Business Rules đã chốt (từ v0.4)

| **Mã** | **Quy tắc nghiệp vụ**                                                                                          |
|--------|----------------------------------------------------------------------------------------------------------------|
| BR-001 | Có bộ mẫu đào tạo chuẩn; doanh nghiệp được tùy chỉnh, bổ sung và tạo mới                                       |
| BR-002 | Admin và người phụ trách đào tạo được phân quyền có quyền tạo, sửa nội dung                                    |
| BR-003 | Tất cả nội dung đào tạo phải được phê duyệt trước khi xuất bản                                                 |
| BR-004 | Phân bổ đào tạo kết hợp tự động và thủ công                                                                    |
| BR-005 | Điều kiện hoàn thành cấu hình riêng theo khóa học                                                              |
| BR-006 | Mọi nhân viên phải thực hiện quy trình bàn giao khi nghỉ việc                                                  |
| BR-007 | Admin và lãnh đạo/quản lý được phân quyền có quyền phê duyệt                                                   |
| BR-008 | Doanh nghiệp chủ động xem xét và áp dụng bản cập nhật bộ mẫu                                                   |
| BR-009 | Cấu trúc đào tạo: Chương trình → Khóa học → Module → Bài học                                                   |
| BR-010 | Người nhận và quản lý trực tiếp cùng xác nhận hoàn tất bàn giao                                                |
| BR-011 | Thu phí thuê bao theo số lượng nhân viên                                                                       |
| BR-012 | Doanh nghiệp cấu hình quyền tự phê duyệt nội dung của người tạo                                                |
| BR-013 | Nội dung tự động xuất bản ngay sau khi phê duyệt                                                               |
| BR-014 | Có thể áp dụng cập nhật mẫu theo khóa học, module hoặc bài học                                                 |
| BR-015 | Quản lý trực tiếp hoặc người được phân quyền được lập hồ sơ bàn giao thay khi nhân viên không thể tự thực hiện |
| BR-016 | Căn cứ tính phí là số tài khoản nhân viên đang kích hoạt sử dụng phần mềm                                      |

## 2. Quyết định mặc định cho MVP (cần xác nhận)

Các quyết định dưới đây giải quyết những vấn đề còn mở ở v0.4 để đội phát triển bắt đầu làm. Thiết kế cần đặt các giá trị số (ngưỡng, thời hạn) ở dạng cấu hình để thay đổi mà không phải sửa mã.

| **Mã** | **Nhóm**   | **Quyết định**                                                                                                                                                                                                                                                                      |
|--------|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| D-01   | Phân quyền | Áp dụng ma trận phân quyền tại mục III.2                                                                                                                                                                                                                                            |
| D-02   | Phê duyệt  | Nội dung bị từ chối quay về trạng thái Nháp kèm lý do bắt buộc; người tạo sửa và gửi duyệt lại. Không giới hạn số lần gửi lại.                                                                                                                                                      |
| D-03   | Phê duyệt  | Sửa nội dung đã xuất bản sẽ tạo phiên bản mới ở trạng thái Nháp. Phiên bản cũ tiếp tục hiển thị cho người học đến khi phiên bản mới được duyệt và xuất bản.                                                                                                                         |
| D-04   | Phê duyệt  | Khi bật quyền tự phê duyệt (BR-012), người có quyền phê duyệt bấm “Xuất bản” là nội dung được duyệt và xuất bản ngay; vẫn ghi nhật ký người duyệt.                                                                                                                                  |
| D-05   | Hoàn thành | Tiêu chí hoàn thành khóa học gồm: (1) tỷ lệ bài học hoàn thành, mặc định 100%; (2) điểm tối thiểu bài kiểm tra cuối khóa, mặc định 70%; (3) số lần làm tối đa, mặc định 3; (4) xác nhận thực hành của QLTT, mặc định tắt. Mỗi khóa học bật/tắt và điều chỉnh từng tiêu chí.         |
| D-06   | Hoàn thành | Bài học dạng văn bản/tệp hoàn thành khi người học bấm “Đã học xong”; bài học video hoàn thành khi xem ≥ 80% thời lượng; bài kiểm tra hoàn thành khi đạt điểm tối thiểu.                                                                                                             |
| D-07   | Đào tạo    | Khi hết số lần làm bài mà chưa đạt, lượt học chuyển trạng thái Chưa đạt; PTĐT/ADM có thể giao lại khóa học (tạo lượt mới, giữ lịch sử lượt cũ).                                                                                                                                     |
| D-08   | Đào tạo    | Một nhân viên chỉ có một lượt đang hiệu lực cho mỗi khóa học. Nếu tự động và thủ công cùng phân bổ, hệ thống giữ lượt có sẵn và lấy hạn hoàn thành muộn hơn.                                                                                                                        |
| D-09   | Đào tạo    | Khi khóa học xuất bản phiên bản mới, người đang học tiếp tục phiên bản đã được giao; lượt phân bổ mới dùng phiên bản mới nhất. Tiến độ các bài học không đổi được giữ khi giao lại.                                                                                                 |
| D-10   | Đào tạo    | Quá hạn hoàn thành: lượt học chuyển trạng thái Quá hạn nhưng người học vẫn được học tiếp; báo cáo ghi nhận hoàn thành trễ.                                                                                                                                                          |
| D-11   | Bộ mẫu     | Doanh nghiệp sao chép nội dung từ bộ mẫu thành bản của mình, hệ thống lưu liên kết tới mục mẫu và phiên bản gốc. Nội dung đã bị doanh nghiệp sửa được đánh dấu “đã tùy chỉnh”.                                                                                                      |
| D-12   | Bộ mẫu     | Khi có bản cập nhật: mục chưa tùy chỉnh được đề xuất cập nhật trực tiếp; mục đã tùy chỉnh hiển thị so sánh và doanh nghiệp chọn Giữ bản hiện tại / Thay bằng bản mẫu mới / Tạo bản sao mới. Mọi thay đổi do áp dụng bản cập nhật tạo phiên bản Nháp và phải qua phê duyệt (BR-003). |
| D-13   | Bàn giao   | Hồ sơ bàn giao gồm nhiều hạng mục; mỗi hạng mục có một người nhận. Một hồ sơ có thể có nhiều người nhận.                                                                                                                                                                            |
| D-14   | Bàn giao   | Người nhận có thể từ chối hạng mục kèm lý do; hạng mục quay về người lập hồ sơ để bổ sung hoặc đổi người nhận.                                                                                                                                                                      |
| D-15   | Bàn giao   | Nhân viên không có công việc cần bàn giao vẫn phải nộp hồ sơ với lựa chọn “Không có hạng mục bàn giao” kèm giải trình; chỉ cần QLTT xác nhận.                                                                                                                                       |
| D-16   | Bàn giao   | Hạn hoàn tất bàn giao mặc định là ngày nghỉ việc. Sau hạn, tài khoản nhân viên chuyển sang chế độ chỉ bàn giao; QLTT/ADM hoàn tất hoặc lập thay. Tài khoản bị vô hiệu hóa (thôi tính phí) khi hồ sơ hoàn tất.                                                                       |
| D-17   | Thuê bao   | Gói thuê bao theo bậc số tài khoản kích hoạt tối đa và dung lượng lưu trữ. Số tài khoản tính phí trong kỳ là số tài khoản kích hoạt cao nhất trong kỳ.                                                                                                                              |
| D-18   | Thuê bao   | Khi đạt giới hạn gói, hệ thống không cho kích hoạt thêm tài khoản và thông báo ADM, QTNT. Cảnh báo khi dùng ≥ 90% số tài khoản hoặc dung lượng.                                                                                                                                     |
| D-19   | Thuê bao   | Hết hạn thuê bao: 15 ngày ân hạn chỉ xem; sau đó tạm ngừng truy cập; dữ liệu giữ 90 ngày rồi xóa nếu không gia hạn. MVP ghi nhận thanh toán thủ công.                                                                                                                               |
| D-20   | Hệ thống   | Cách ly dữ liệu theo doanh nghiệp bằng mã doanh nghiệp (tenant_id) trên mọi bảng nghiệp vụ, có kiểm soát ở tầng cơ sở dữ liệu (Row Level Security) và tầng ứng dụng.                                                                                                                |

# V. Đặc tả chức năng

## F01. Quản trị nền tảng

**Mục tiêu:** Nhà cung cấp quản lý doanh nghiệp khách hàng, gói thuê bao và bộ mẫu đào tạo.

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                                                     | **Ưu tiên** |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-01.01 | Tạo, sửa, tạm ngừng, kích hoạt lại doanh nghiệp khách hàng (tên, mã số thuế, địa chỉ, người liên hệ, tên miền phụ hoặc mã đăng nhập). Khi tạo, hệ thống khởi tạo tài khoản ADM đầu tiên và gửi email mời. | MVP         |
| FR-01.02 | Quản lý danh mục gói thuê bao: tên gói, số tài khoản kích hoạt tối đa, dung lượng lưu trữ, giá, chu kỳ (tháng/năm).                                                                                       | MVP         |
| FR-01.03 | Gán gói cho doanh nghiệp, ngày bắt đầu, ngày kết thúc, gia hạn, nâng/hạ gói; ghi nhận thanh toán thủ công (số tiền, ngày, ghi chú).                                                                       | MVP         |
| FR-01.04 | Quản lý bộ mẫu đào tạo theo cấu trúc Chương trình → Khóa học → Module → Bài học, kèm ngân hàng câu hỏi mẫu; phân loại theo ngành nghề và nhóm vị trí.                                                     | MVP         |
| FR-01.05 | Phát hành phiên bản bộ mẫu kèm ghi chú thay đổi; hệ thống gửi thông báo cho các doanh nghiệp đang dùng mục mẫu liên quan.                                                                                 | MVP         |
| FR-01.06 | Thống kê nền tảng: số doanh nghiệp, số tài khoản kích hoạt, dung lượng sử dụng, thuê bao sắp hết hạn.                                                                                                     | MVP         |
| FR-01.07 | Nhật ký thao tác của QTNT.                                                                                                                                                                                | MVP         |

### Quy tắc và ngoại lệ

- QTNT không xem được nội dung riêng, kết quả học tập, hồ sơ bàn giao của doanh nghiệp; chỉ xem số liệu tổng hợp phục vụ tính phí.

- Tạm ngừng doanh nghiệp: mọi tài khoản của doanh nghiệp không đăng nhập được; dữ liệu được giữ nguyên.

## F02. Quản trị doanh nghiệp

**Mục tiêu:** Admin doanh nghiệp thiết lập thông tin nền tảng cho tổ chức.

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                           | **Ưu tiên** |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-02.01 | Cập nhật hồ sơ doanh nghiệp: tên, logo, địa chỉ, mã số thuế, người liên hệ.                                                                                     | MVP         |
| FR-02.02 | Quản lý cơ cấu phòng ban dạng cây (thêm, sửa, ngừng sử dụng, di chuyển).                                                                                        | MVP         |
| FR-02.03 | Quản lý danh mục chức danh.                                                                                                                                     | MVP         |
| FR-02.04 | Cấu hình doanh nghiệp: bật/tắt tự phê duyệt (BR-012); tiêu chí hoàn thành mặc định cho khóa học mới (D-05); số ngày nhắc trước hạn; thời hạn bàn giao mặc định. | MVP         |
| FR-02.05 | Xem thông tin thuê bao: gói, ngày hết hạn, số tài khoản đang kích hoạt/tối đa, dung lượng đã dùng.                                                              | MVP         |

### Quy tắc và ngoại lệ

- Không xóa phòng ban hoặc chức danh đang có nhân viên hoặc quy tắc phân bổ; chỉ được chuyển sang ngừng sử dụng.

## F03. Nhân viên và phân quyền

**Mục tiêu:** Quản lý tài khoản nhân viên, vai trò và vòng đời tài khoản.

| **Mã**   | **Yêu cầu chức năng**                                                                                                    | **Ưu tiên** |
|----------|--------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-03.01 | Thêm, sửa nhân viên: mã nhân viên, họ tên, email, số điện thoại, phòng ban, chức danh, quản lý trực tiếp, ngày vào làm.  | MVP         |
| FR-03.02 | Nhập danh sách nhân viên từ Excel theo mẫu; kiểm tra lỗi từng dòng và báo cáo dòng lỗi trước khi lưu.                    | MVP         |
| FR-03.03 | Kích hoạt, vô hiệu hóa tài khoản; kiểm tra giới hạn gói khi kích hoạt (D-18). Gửi email mời đặt mật khẩu khi kích hoạt.  | MVP         |
| FR-03.04 | Gán vai trò ADM, PTĐT, PD cho nhân viên; cấu hình phạm vi phòng ban cho PTĐT và PD.                                      | MVP         |
| FR-03.05 | Đăng nhập bằng email hoặc số điện thoại và mật khẩu; quên mật khẩu qua email; đổi mật khẩu; đăng xuất khỏi mọi thiết bị. | MVP         |
| FR-03.06 | Đánh dấu nghỉ việc với ngày nghỉ dự kiến; hệ thống khởi tạo hồ sơ bàn giao (F10).                                        | MVP         |
| FR-03.07 | Khi đổi phòng ban hoặc chức danh, hệ thống chạy lại quy tắc phân bổ tự động (F06).                                       | MVP         |

### Quy tắc và ngoại lệ

- Email và mã nhân viên là duy nhất trong một doanh nghiệp.

- Không vô hiệu hóa được nhân viên đang có hồ sơ bàn giao chưa hoàn tất (BR-006), trừ ADM với lý do bắt buộc.

- Doanh nghiệp luôn phải có ít nhất một ADM đang kích hoạt.

## F04. Kho tri thức

**Mục tiêu:** Tập trung, chuẩn hóa và phê duyệt tri thức của doanh nghiệp.

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                  | **Ưu tiên** |
|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-04.01 | Quản lý danh mục tri thức dạng cây và thẻ (tag).                                                                                                                       | MVP         |
| FR-04.02 | Tạo nội dung tri thức: tiêu đề, tóm tắt, nội dung soạn thảo định dạng (rich text), tệp đính kèm (PDF, Word, Excel, PowerPoint, hình ảnh), video tải lên hoặc liên kết. | MVP         |
| FR-04.03 | Thiết lập phạm vi truy cập: toàn doanh nghiệp, theo phòng ban hoặc theo chức danh.                                                                                     | MVP         |
| FR-04.04 | Quy trình phê duyệt: Nháp → Chờ duyệt → Đã xuất bản hoặc Bị từ chối (BR-003, BR-013, D-02, D-04).                                                                      | MVP         |
| FR-04.05 | Quản lý phiên bản và lịch sử thay đổi; xem lại phiên bản cũ (D-03).                                                                                                    | MVP         |
| FR-04.06 | Tìm kiếm theo từ khóa trong tiêu đề, tóm tắt, nội dung; lọc theo danh mục, thẻ, phòng ban.                                                                             | MVP         |
| FR-04.07 | Ngừng sử dụng (lưu trữ) nội dung; nội dung lưu trữ không hiển thị cho người học nhưng vẫn giữ lịch sử.                                                                 | MVP         |
| FR-04.08 | Tiếp nhận nội dung từ hồ sơ bàn giao (F10) dưới dạng bản Nháp.                                                                                                         | MVP         |
| FR-04.09 | Tìm kiếm trong nội dung tệp PDF, Word.                                                                                                                                 | GĐ2         |

### Quy tắc và ngoại lệ

- Người học chỉ thấy nội dung Đã xuất bản trong phạm vi truy cập của mình.

- Không xóa vĩnh viễn nội dung đang được bài học tham chiếu; chỉ cho phép lưu trữ.

## F05. Quản lý đào tạo

**Mục tiêu:** Tổ chức kiến thức thành chương trình, khóa học, module và bài học phù hợp thời gian đào tạo.

| **Mã**   | **Yêu cầu chức năng**                                                                                                               | **Ưu tiên** |
|----------|-------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-05.01 | Tạo, sửa chương trình đào tạo: tên, mô tả, đối tượng, loại (hội nhập/chuyên môn), thời gian đào tạo mục tiêu (số ngày hoặc số giờ). | MVP         |
| FR-05.02 | Tạo khóa học trong chương trình; một khóa học có thể dùng chung cho nhiều chương trình.                                             | MVP         |
| FR-05.03 | Tạo module và bài học; sắp xếp thứ tự bằng kéo thả.                                                                                 | MVP         |
| FR-05.04 | Loại bài học: văn bản, tệp tài liệu, video, liên kết nội dung kho tri thức, bài kiểm tra. Mỗi bài học có thời lượng dự kiến.        | MVP         |
| FR-05.05 | Tự tính tổng thời lượng khóa học và chương trình; cảnh báo khi vượt thời gian đào tạo mục tiêu.                                     | MVP         |
| FR-05.06 | Cấu hình điều kiện hoàn thành khóa học (BR-005, D-05) và chế độ học tuần tự hoặc tự do.                                             | MVP         |
| FR-05.07 | Gửi duyệt và xuất bản khóa học (BR-003); chỉ khóa học Đã xuất bản mới được phân bổ.                                                 | MVP         |
| FR-05.08 | Sao chép nội dung từ bộ mẫu ở cấp chương trình, khóa học, module hoặc bài học (D-11).                                               | MVP         |
| FR-05.09 | Xem danh sách cập nhật bộ mẫu, so sánh và áp dụng theo khóa học, module hoặc bài học (BR-008, BR-014, D-12).                        | MVP         |
| FR-05.10 | Sao chép khóa học trong doanh nghiệp để tạo khóa học mới.                                                                           | MVP         |

### Quy tắc và ngoại lệ

- Đơn vị phê duyệt là khóa học: gửi duyệt khóa học bao gồm toàn bộ module, bài học bên trong. Chương trình được duyệt riêng.

- Phiên bản khóa học tuân theo D-03 và D-09.

## F06. Phân bổ đào tạo

**Mục tiêu:** Giao đúng nội dung cho đúng người, kết hợp tự động và thủ công (BR-004).

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                                         | **Ưu tiên** |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-06.01 | Tạo quy tắc phân bổ tự động: điều kiện (phòng ban, chức danh, nhân viên mới trong N ngày kể từ ngày vào làm), nội dung (chương trình hoặc khóa học), hạn hoàn thành (số ngày kể từ khi giao). | MVP         |
| FR-06.02 | Quy tắc tự động áp dụng khi: tạo nhân viên mới, đổi phòng ban/chức danh, tạo hoặc sửa quy tắc (có lựa chọn áp dụng cho nhân viên hiện có).                                                    | MVP         |
| FR-06.03 | Phân bổ thủ công cho nhân viên, nhóm nhân viên hoặc phòng ban, kèm hạn hoàn thành.                                                                                                            | MVP         |
| FR-06.04 | Hủy phân bổ, gia hạn, giao lại khóa học (D-07, D-08).                                                                                                                                         | MVP         |
| FR-06.05 | Xem danh sách phân bổ theo khóa học, nhân viên, trạng thái.                                                                                                                                   | MVP         |

### Quy tắc và ngoại lệ

- Giao chương trình tương đương giao tất cả khóa học trong chương trình, cùng hạn hoàn thành của chương trình.

- Không tự động hủy phân bổ khi nhân viên đổi phòng ban; PTĐT quyết định hủy thủ công.

## F07. Học tập nhân viên

**Mục tiêu:** Nhân viên học đúng nội dung, theo dõi được tiến độ của mình.

| **Mã**   | **Yêu cầu chức năng**                                                                                                   | **Ưu tiên** |
|----------|-------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-07.01 | Trang “Việc học của tôi”: danh sách khóa học được giao, hạn hoàn thành, tiến độ, trạng thái; sắp xếp theo hạn gần nhất. | MVP         |
| FR-07.02 | Xem bài học theo loại nội dung; trình xem PDF và video ngay trong trình duyệt.                                          | MVP         |
| FR-07.03 | Ghi nhận hoàn thành bài học theo D-06; lưu vị trí học dở và vị trí video.                                               | MVP         |
| FR-07.04 | Chế độ tuần tự: chỉ mở bài tiếp theo khi bài trước hoàn thành.                                                          | MVP         |
| FR-07.05 | Tra cứu kho tri thức theo phạm vi truy cập.                                                                             | MVP         |
| FR-07.06 | Lịch sử học tập: các khóa đã hoàn thành, điểm, ngày hoàn thành.                                                         | MVP         |
| FR-07.07 | Giao diện responsive dùng tốt trên điện thoại (từ 360px).                                                               | MVP         |

## F08. Kiểm tra, đánh giá

**Mục tiêu:** Đánh giá kết quả học tập và chất lượng khóa học.

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                                                                                                                           | **Ưu tiên** |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-08.01 | Ngân hàng câu hỏi theo khóa học hoặc chủ đề; loại câu hỏi: một đáp án, nhiều đáp án, đúng/sai; giải thích đáp án.                                                                                                                                                               | MVP         |
| FR-08.02 | Nhập câu hỏi từ Excel theo mẫu.                                                                                                                                                                                                                                                 | MVP         |
| FR-08.03 | Cấu hình bài kiểm tra: câu hỏi cố định hoặc rút ngẫu nhiên theo số lượng, thời gian làm bài, điểm đạt, số lần làm tối đa, xáo trộn câu hỏi/đáp án, hiển thị đáp án sau khi nộp hay không.                                                                                       | MVP         |
| FR-08.04 | Làm bài, tự động nộp khi hết giờ, chấm điểm tự động, lưu từng lần làm.                                                                                                                                                                                                          | MVP         |
| FR-08.05 | Xác nhận thực hành: QLTT xác nhận đạt/chưa đạt kèm nhận xét cho khóa học có bật tiêu chí này.                                                                                                                                                                                   | MVP         |
| FR-08.06 | Xác định hoàn thành khóa học tự động khi đủ các tiêu chí đã cấu hình (BR-005).                                                                                                                                                                                                  | MVP         |
| FR-08.07 | Khảo sát chất lượng khóa học (P-01): sau khi hoàn thành khóa học, người học đánh giá theo thang 1–5 về nội dung, mức độ áp dụng, độ dài, và góp ý tự do. Mẫu khảo sát mặc định do doanh nghiệp chỉnh sửa được; khảo sát không bắt buộc và không ảnh hưởng điều kiện hoàn thành. | MVP         |

### Quy tắc và ngoại lệ

- Đề kiểm tra rút ngẫu nhiên được cố định cho từng lần làm, lưu lại để xem lại.

- Khi đang làm bài mà mất kết nối, thời gian vẫn tính; câu trả lời đã chọn được lưu liên tục.

## F09. Báo cáo

**Mục tiêu:** Cung cấp số liệu tiến độ, kết quả đào tạo và bàn giao.

| **Mã**   | **Yêu cầu chức năng**                                                                                                           | **Ưu tiên** |
|----------|---------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-09.01 | Trang tổng quan ADM/PTĐT: số nhân viên đang học, tỷ lệ hoàn thành, số lượt quá hạn, nội dung chờ duyệt, hồ sơ bàn giao đang mở. | MVP         |
| FR-09.02 | Báo cáo tiến độ theo khóa học/chương trình: số được giao, đang học, hoàn thành, quá hạn, chưa đạt.                              | MVP         |
| FR-09.03 | Báo cáo theo phòng ban và theo nhân viên; chi tiết từng lượt học.                                                               | MVP         |
| FR-09.04 | Báo cáo kết quả kiểm tra: điểm trung bình, tỷ lệ đạt, câu hỏi có tỷ lệ sai cao.                                                 | MVP         |
| FR-09.05 | Báo cáo khảo sát chất lượng khóa học.                                                                                           | MVP         |
| FR-09.06 | Báo cáo bàn giao: hồ sơ đang mở, quá hạn, hoàn tất.                                                                             | MVP         |
| FR-09.07 | QLTT xem tiến độ học và trạng thái bàn giao của cấp dưới trực tiếp.                                                             | MVP         |
| FR-09.08 | Lọc theo thời gian, phòng ban, khóa học; xuất Excel.                                                                            | MVP         |

## F10. Bàn giao tri thức

**Mục tiêu:** Bảo đảm mọi nhân viên nghỉ việc bàn giao công việc và tri thức (BR-006).

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                                   | **Ưu tiên** |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-10.01 | Khởi tạo hồ sơ bàn giao khi nhân viên được đánh dấu nghỉ việc; thông báo nhân viên và QLTT.                                                                                             | MVP         |
| FR-10.02 | Lập hồ sơ: danh sách hạng mục (công việc đang thực hiện, tài liệu, tài khoản/công cụ, đầu mối liên hệ, kinh nghiệm và lưu ý), mô tả, tệp đính kèm, người nhận cho từng hạng mục (D-13). | MVP         |
| FR-10.03 | Lựa chọn “Không có hạng mục bàn giao” kèm giải trình (D-15).                                                                                                                            | MVP         |
| FR-10.04 | Người nhận tiếp nhận hoặc từ chối từng hạng mục kèm lý do (D-14).                                                                                                                       | MVP         |
| FR-10.05 | QLTT xác nhận hoàn tất khi mọi hạng mục đã được tiếp nhận (BR-010).                                                                                                                     | MVP         |
| FR-10.06 | QLTT hoặc ADM lập hồ sơ thay khi nhân viên không thể tự thực hiện, bắt buộc ghi lý do (BR-015, D-16).                                                                                   | MVP         |
| FR-10.07 | Đánh dấu hạng mục “kinh nghiệm” để chuyển thành nội dung Nháp trong kho tri thức (F04).                                                                                                 | MVP         |
| FR-10.08 | Khi hồ sơ hoàn tất, tài khoản nhân viên nghỉ việc được vô hiệu hóa; hồ sơ được lưu và tra cứu được.                                                                                     | MVP         |

### Quy tắc và ngoại lệ

- Nhân viên nghỉ việc trong thời gian bàn giao vẫn dùng được chức năng bàn giao; các chức năng khác giữ nguyên đến ngày nghỉ việc.

- Hồ sơ đã hoàn tất không sửa được; bổ sung sau đó được ghi thành phụ lục có thời gian và người ghi.

## F11. Thông báo

**Mục tiêu:** Thông báo kịp thời các sự kiện nghiệp vụ và đào tạo.

| **Mã**   | **Yêu cầu chức năng**                                                                                                | **Ưu tiên** |
|----------|----------------------------------------------------------------------------------------------------------------------|-------------|
| FR-11.01 | Thông báo trong ứng dụng (biểu tượng chuông, danh sách, đánh dấu đã đọc) và email.                                   | MVP         |
| FR-11.02 | Sự kiện đào tạo: được giao khóa học, sắp đến hạn (mặc định 3 ngày trước), quá hạn, chưa đạt, chờ xác nhận thực hành. | MVP         |
| FR-11.03 | Sự kiện nội dung: có nội dung chờ duyệt, nội dung bị từ chối, nội dung đã xuất bản, bộ mẫu có phiên bản mới.         | MVP         |
| FR-11.04 | Sự kiện bàn giao: khởi tạo hồ sơ, được chỉ định nhận, hạng mục bị từ chối, chờ QLTT xác nhận, hoàn tất, quá hạn.     | MVP         |
| FR-11.05 | Sự kiện thuê bao: sắp hết hạn (30 và 7 ngày), dùng ≥ 90% tài khoản hoặc dung lượng.                                  | MVP         |
| FR-11.06 | Người dùng tắt nhận email theo nhóm sự kiện (trừ sự kiện bắt buộc: bàn giao, quá hạn).                               | MVP         |
| FR-11.07 | Thông báo qua Zalo OA.                                                                                               | GĐ2         |

## F12. Landing page và đăng ký pilot

**Mục tiêu:** Giới thiệu sản phẩm tới doanh nghiệp tại Thanh Hóa, thu thập đăng ký tham gia pilot và chuyển đăng ký thành khách hàng.

| **Mã**   | **Yêu cầu chức năng**                                                                                                                                                                                                                                                                                                                                   | **Ưu tiên** |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| FR-12.01 | Trang giới thiệu công khai tại tên miền chính, theo bản thiết kế EduCore36 (tệp HTML đính kèm dự án) gồm: thanh điều hướng, hero, vấn đề và giải pháp, 3 trụ cột, giao diện theo vai trò (tab Admin / Quản lý / Nhân viên), điểm khác biệt và chính sách tính phí, chương trình pilot và chỉ số mục tiêu, form đăng ký, câu hỏi thường gặp, chân trang. | MVP         |
| FR-12.02 | Bổ sung nút “Đăng nhập” trên thanh điều hướng, dẫn tới ứng dụng.                                                                                                                                                                                                                                                                                        | MVP         |
| FR-12.03 | Form đăng ký pilot: họ tên, chức vụ, tên doanh nghiệp, quy mô nhân sự, số điện thoại/Zalo, ô đồng ý cho phép xử lý dữ liệu cá nhân kèm liên kết chính sách bảo mật. Kiểm tra dữ liệu ở cả trình duyệt và máy chủ.                                                                                                                                       | MVP         |
| FR-12.04 | Lưu đăng ký vào hệ thống (thực thể Lead) và gửi email thông báo cho QTNT ngay khi có đăng ký mới.                                                                                                                                                                                                                                                       | MVP         |
| FR-12.05 | Chống spam: giới hạn số lần gửi theo IP, trường ẩn (honeypot); không dùng CAPTCHA gây khó cho người dùng ở MVP.                                                                                                                                                                                                                                         | MVP         |
| FR-12.06 | QTNT quản lý danh sách đăng ký: lọc, trạng thái (Mới, Đã liên hệ, Đã demo, Tham gia pilot, Không phù hợp), ghi chú, người phụ trách; chuyển đăng ký thành doanh nghiệp khách hàng với thông tin điền sẵn (FR-01.01).                                                                                                                                    | MVP         |
| FR-12.07 | SEO cơ bản: title, meta description, thẻ Open Graph để chia sẻ Zalo/Facebook, sitemap.xml, robots.txt; trang Chính sách bảo mật.                                                                                                                                                                                                                        | MVP         |
| FR-12.08 | Đo lường truy cập và số lượt gửi form (công cụ phân tích web).                                                                                                                                                                                                                                                                                          | GĐ2         |

### Quy tắc và ngoại lệ

- Số liệu trên các ảnh giao diện mẫu (84%, 64/100, tên nhân sự…) là minh họa, cần ghi chú hoặc dùng dữ liệu giả rõ ràng.

- Các cam kết công bố trên trang (miễn phí 3 tháng pilot, liên hệ trong 2 giờ làm việc, triển khai 2–5 ngày, tiết kiệm 70% công sức soạn bài) phải được xác nhận trước khi đưa lên mạng.

- Dữ liệu người dùng nhập vào form chỉ được hiển thị lại dưới dạng văn bản (textContent), không chèn trực tiếp vào HTML.

- Bản production dùng Tailwind đã build và nén, không dùng Tailwind CDN.

- Thông tin liên hệ (hotline, email, địa chỉ) và tên miền trên trang phải là thông tin thật trước khi công bố.

# VI. Luồng nghiệp vụ và trạng thái

## 1. Trạng thái nội dung (tri thức, khóa học, chương trình)

| **Từ trạng thái** | **Hành động**                                                 | **Sang trạng thái**                                             |
|-------------------|---------------------------------------------------------------|-----------------------------------------------------------------|
| Nháp              | Người tạo gửi duyệt                                           | Chờ duyệt                                                       |
| Nháp              | Người có quyền duyệt bấm Xuất bản khi bật tự phê duyệt (D-04) | Đã xuất bản                                                     |
| Chờ duyệt         | Người phê duyệt duyệt                                         | Đã xuất bản (BR-013)                                            |
| Chờ duyệt         | Người phê duyệt từ chối, nhập lý do                           | Nháp, kèm lý do (D-02)                                          |
| Chờ duyệt         | Người tạo rút lại                                             | Nháp                                                            |
| Đã xuất bản       | Sửa nội dung                                                  | Tạo phiên bản mới ở trạng thái Nháp; bản cũ vẫn xuất bản (D-03) |
| Đã xuất bản       | Ngừng sử dụng                                                 | Lưu trữ                                                         |
| Lưu trữ           | Khôi phục                                                     | Đã xuất bản                                                     |

## 2. Trạng thái lượt học

| **Từ trạng thái**               | **Sự kiện**                    | **Sang trạng thái**          |
|---------------------------------|--------------------------------|------------------------------|
| (mới)                           | Phân bổ tự động hoặc thủ công  | Chưa bắt đầu                 |
| Chưa bắt đầu                    | Mở bài học đầu tiên            | Đang học                     |
| Đang học                        | Đủ điều kiện hoàn thành        | Hoàn thành                   |
| Đang học                        | Hết số lần làm bài mà chưa đạt | Chưa đạt (D-07)              |
| Chưa bắt đầu / Đang học         | Quá hạn hoàn thành             | Quá hạn, vẫn học tiếp (D-10) |
| Quá hạn                         | Đủ điều kiện hoàn thành        | Hoàn thành (ghi nhận trễ)    |
| Bất kỳ trạng thái chưa kết thúc | PTĐT/ADM hủy                   | Đã hủy                       |
| Chưa đạt / Hoàn thành           | PTĐT/ADM giao lại              | Tạo lượt mới: Chưa bắt đầu   |

## 3. Trạng thái hồ sơ bàn giao

| **Từ trạng thái**      | **Hành động**                                           | **Sang trạng thái**                              |
|------------------------|---------------------------------------------------------|--------------------------------------------------|
| (mới)                  | Đánh dấu nghỉ việc                                      | Đang lập                                         |
| Đang lập               | Người lập gửi hồ sơ                                     | Chờ tiếp nhận                                    |
| Chờ tiếp nhận          | Tất cả hạng mục được tiếp nhận (hoặc không có hạng mục) | Chờ QLTT xác nhận                                |
| Chờ tiếp nhận          | Có hạng mục bị từ chối                                  | Cần bổ sung (D-14)                               |
| Cần bổ sung            | Người lập sửa và gửi lại                                | Chờ tiếp nhận                                    |
| Chờ QLTT xác nhận      | QLTT xác nhận                                           | Hoàn tất (BR-010); vô hiệu hóa tài khoản         |
| Chờ QLTT xác nhận      | QLTT yêu cầu bổ sung                                    | Cần bổ sung                                      |
| Đang lập / Cần bổ sung | Quá hạn, QLTT/ADM lập thay                              | Tiếp tục luồng, ghi nhận người lập thay (BR-015) |

## 4. Luồng áp dụng cập nhật bộ mẫu

1.  QTNT phát hành phiên bản mới của mục mẫu kèm ghi chú thay đổi (FR-01.05).

2.  Hệ thống xác định doanh nghiệp có nội dung sao chép từ mục mẫu đó và gửi thông báo cho ADM/PTĐT.

3.  Người phụ trách mở danh sách cập nhật, xem so sánh giữa bản hiện tại và bản mẫu mới.

4.  Chọn phạm vi áp dụng: khóa học, module hoặc bài học (BR-014); với mục đã tùy chỉnh chọn Giữ / Thay / Tạo bản sao (D-12).

5.  Hệ thống tạo phiên bản Nháp; nội dung đi qua quy trình phê duyệt (BR-003) và xuất bản theo D-09.

6.  Bản cập nhật bị bỏ qua vẫn nằm trong danh sách để xem lại sau, cho đến khi có phiên bản mới hơn.

## 5. Luồng hội nhập nhân viên mới (điển hình)

1.  ADM thêm nhân viên mới (FR-03.01) và kích hoạt tài khoản.

2.  Quy tắc tự động giao chương trình hội nhập chung và khóa học theo chức danh (FR-06.01).

3.  Nhân viên nhận email, đặt mật khẩu, vào “Việc học của tôi”.

4.  Nhân viên học bài, làm kiểm tra; QLTT xác nhận thực hành nếu khóa yêu cầu.

5.  Hệ thống ghi nhận hoàn thành, mời khảo sát; PTĐT theo dõi trên báo cáo.

# VII. Mô hình dữ liệu

Mọi bảng nghiệp vụ (trừ bảng của nền tảng) có cột tenant_id, created_at, created_by, updated_at, updated_by. Khóa chính dạng UUID. Xóa mềm (deleted_at) cho dữ liệu nghiệp vụ.

| **Thực thể**            | **Thuộc tính chính**                                                                                                                                                                                            |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tenant (Doanh nghiệp)   | id, tên, mã số thuế, địa chỉ, logo, mã đăng nhập, trạng thái, cấu hình (JSON)                                                                                                                                   |
| Plan (Gói)              | id, tên, số tài khoản tối đa, dung lượng (GB), giá, chu kỳ                                                                                                                                                      |
| Subscription            | id, tenant_id, plan_id, ngày bắt đầu, ngày kết thúc, trạng thái, số tài khoản tính phí trong kỳ                                                                                                                 |
| Payment                 | id, subscription_id, số tiền, ngày thanh toán, ghi chú, người ghi nhận                                                                                                                                          |
| Department              | id, tenant_id, tên, parent_id, trạng thái                                                                                                                                                                       |
| Position (Chức danh)    | id, tenant_id, tên, trạng thái                                                                                                                                                                                  |
| User                    | id, tenant_id (rỗng với QTNT), mã NV, họ tên, email, SĐT, mật khẩu băm, department_id, position_id, manager_id, ngày vào làm, ngày nghỉ việc, trạng thái (chưa kích hoạt/kích hoạt/chế độ bàn giao/vô hiệu hóa) |
| UserRole                | user_id, vai trò, phạm vi phòng ban (danh sách department_id)                                                                                                                                                   |
| KnowledgeCategory       | id, tenant_id, tên, parent_id                                                                                                                                                                                   |
| KnowledgeItem           | id, tenant_id, category_id, trạng thái, phiên bản hiện hành, phạm vi truy cập, thẻ                                                                                                                              |
| KnowledgeVersion        | id, item_id, số phiên bản, tiêu đề, tóm tắt, nội dung, tệp đính kèm, trạng thái, người duyệt, ngày duyệt, lý do từ chối                                                                                         |
| Program                 | id, tenant_id, tên, loại, thời gian mục tiêu, trạng thái, phiên bản                                                                                                                                             |
| ProgramCourse           | program_id, course_id, thứ tự                                                                                                                                                                                   |
| Course / CourseVersion  | id, tenant_id, tên, mô tả, chế độ học, điều kiện hoàn thành (JSON), phiên bản, trạng thái, liên kết mẫu                                                                                                         |
| Module                  | id, course_version_id, tên, thứ tự                                                                                                                                                                              |
| Lesson                  | id, module_id, tên, loại, nội dung/tệp/knowledge_item_id/quiz_id, thời lượng dự kiến, thứ tự, liên kết mẫu                                                                                                      |
| TemplateLink            | id, tenant_id, loại đối tượng, đối tượng doanh nghiệp, mục mẫu, phiên bản mẫu gốc, cờ đã tùy chỉnh                                                                                                              |
| Template\* (bộ mẫu)     | Cấu trúc tương tự Program/Course/Module/Lesson/Question ở cấp nền tảng, có phiên bản và ghi chú phát hành                                                                                                       |
| Question                | id, tenant_id, phạm vi (khóa học/chủ đề), loại, nội dung, đáp án (JSON), giải thích                                                                                                                             |
| Quiz                    | id, tenant_id, cấu hình câu hỏi, thời gian, điểm đạt, số lần tối đa, tùy chọn hiển thị                                                                                                                          |
| QuizAttempt             | id, quiz_id, user_id, enrollment_id, đề (JSON), câu trả lời, điểm, bắt đầu, nộp                                                                                                                                 |
| AssignmentRule          | id, tenant_id, điều kiện (JSON), program_id/course_id, số ngày hạn, trạng thái                                                                                                                                  |
| Enrollment (Lượt học)   | id, tenant_id, user_id, course_version_id, program_id, nguồn (tự động/thủ công), rule_id, hạn, trạng thái, tiến độ %, ngày hoàn thành                                                                           |
| LessonProgress          | enrollment_id, lesson_id, trạng thái, vị trí học dở, ngày hoàn thành                                                                                                                                            |
| PracticeConfirmation    | enrollment_id, người xác nhận, kết quả, nhận xét, ngày                                                                                                                                                          |
| Survey / SurveyResponse | mẫu khảo sát của doanh nghiệp; câu trả lời theo enrollment                                                                                                                                                      |
| Handover                | id, tenant_id, user_id, ngày nghỉ việc, hạn, trạng thái, không có hạng mục (cờ), giải trình, người lập, lập thay (cờ, lý do), QLTT xác nhận, ngày hoàn tất                                                      |
| HandoverItem            | id, handover_id, loại, tiêu đề, mô tả, tệp, receiver_id, trạng thái, lý do từ chối, chuyển thành tri thức (cờ)                                                                                                  |
| Notification            | id, tenant_id, user_id, loại sự kiện, tiêu đề, liên kết, đã đọc, đã gửi email                                                                                                                                   |
| FileObject              | id, tenant_id, tên, loại, dung lượng, khóa lưu trữ                                                                                                                                                              |
| Lead (Đăng ký pilot)    | id, họ tên, chức vụ, tên doanh nghiệp, quy mô, số điện thoại, đồng ý xử lý dữ liệu, trạng thái, ghi chú, người phụ trách, tenant_id sau khi chuyển đổi, IP, thời gian gửi                                       |
| AuditLog                | id, tenant_id, user_id, hành động, đối tượng, dữ liệu trước/sau, thời gian, IP                                                                                                                                  |

# VIII. Yêu cầu phi chức năng

| **Mã** | **Nhóm**           | **Yêu cầu**                                                                                                                                                                               |
|--------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| NFR-01 | Cách ly dữ liệu    | Theo D-20. Kiểm thử tự động bảo đảm người dùng doanh nghiệp A không đọc/ghi được dữ liệu doanh nghiệp B qua mọi API. Tệp lưu theo tiền tố tenant, truy cập bằng đường dẫn ký có thời hạn. |
| NFR-02 | Xác thực           | Mật khẩu băm bằng Argon2 hoặc bcrypt; tối thiểu 8 ký tự gồm chữ và số; khóa tạm 15 phút sau 5 lần sai; phiên đăng nhập hết hạn sau 7 ngày không hoạt động.                                |
| NFR-03 | Phân quyền         | Kiểm tra quyền ở backend cho mọi API theo ma trận mục III.2; giao diện chỉ ẩn/hiện để thuận tiện.                                                                                         |
| NFR-04 | Bảo mật truyền tải | Bắt buộc HTTPS; chống CSRF, XSS (lọc nội dung rich text), SQL injection; giới hạn tần suất gọi API đăng nhập.                                                                             |
| NFR-05 | Dữ liệu cá nhân    | Tuân thủ quy định hiện hành của Việt Nam về bảo vệ dữ liệu cá nhân; thu thập tối thiểu; có chức năng xuất và xóa dữ liệu doanh nghiệp khi chấm dứt hợp đồng.                              |
| NFR-06 | Nhật ký            | Ghi AuditLog cho đăng nhập, phân quyền, phê duyệt, kích hoạt/vô hiệu hóa tài khoản, bàn giao, thay đổi thuê bao. Lưu tối thiểu 12 tháng.                                                  |
| NFR-07 | Hiệu năng          | Trang tải lần đầu ≤ 3 giây trên 4G; 95% API phản hồi ≤ 1 giây; chịu 500 người dùng đồng thời ở giai đoạn đầu.                                                                             |
| NFR-08 | Quy mô             | Thiết kế cho 50 doanh nghiệp, 5.000 tài khoản kích hoạt ở năm đầu; mở rộng ngang được tầng ứng dụng.                                                                                      |
| NFR-09 | Tệp                | Video tối đa 500 MB/tệp, tài liệu tối đa 50 MB/tệp (cấu hình được); dung lượng tổng theo gói (D-17).                                                                                      |
| NFR-10 | Sao lưu            | Sao lưu cơ sở dữ liệu hằng ngày, giữ 30 ngày; sao lưu kho tệp hằng tuần; thử khôi phục định kỳ mỗi quý. RPO ≤ 24 giờ, RTO ≤ 8 giờ.                                                        |
| NFR-11 | Khả dụng           | Mục tiêu 99% thời gian/tháng, không tính bảo trì có thông báo trước.                                                                                                                      |
| NFR-12 | Tương thích        | Chrome, Edge, Firefox, Safari (2 phiên bản gần nhất); màn hình từ 360px; giao diện tiếng Việt, múi giờ GMT+7, định dạng ngày dd/MM/yyyy.                                                  |
| NFR-13 | Khả năng truy cập  | Điều hướng được bằng bàn phím, có nhãn cho trường nhập liệu, độ tương phản đạt mức WCAG 2.1 AA cho văn bản chính.                                                                         |
| NFR-14 | Vận hành           | Ghi log ứng dụng tập trung, cảnh báo lỗi; môi trường dev, staging, production tách biệt; triển khai bằng Docker.                                                                          |

# IX. Kiến trúc và công nghệ đề xuất

Đây là đề xuất để bắt đầu phát triển; có thể điều chỉnh theo năng lực đội ngũ và hạ tầng sẵn có.

| **Thành phần**       | **Đề xuất**                                                                                                           |
|----------------------|-----------------------------------------------------------------------------------------------------------------------|
| Frontend             | Next.js (React, TypeScript), Tailwind CSS; web responsive, có thể bổ sung PWA ở GĐ2                                   |
| Backend              | NestJS (Node.js, TypeScript), REST API, tài liệu OpenAPI                                                              |
| Cơ sở dữ liệu        | PostgreSQL, cột tenant_id và Row Level Security (D-20); ORM Prisma hoặc TypeORM, migration có phiên bản               |
| Hàng đợi, tác vụ nền | Redis + BullMQ: gửi email, chạy quy tắc phân bổ, nhắc hạn, quét quá hạn hằng ngày                                     |
| Lưu trữ tệp          | Object storage tương thích S3 (MinIO tự vận hành hoặc dịch vụ trong nước), URL ký có thời hạn                         |
| Video                | MVP phát trực tiếp tệp MP4; GĐ2 cân nhắc chuyển mã HLS                                                                |
| Email                | SMTP hoặc dịch vụ gửi email giao dịch                                                                                 |
| Triển khai           | Docker Compose trên VPS/cloud trong nước; reverse proxy Nginx; CI/CD chạy test trước khi triển khai                   |
| Kiểm thử             | Unit test cho quy tắc nghiệp vụ, test tích hợp API (bao gồm test cách ly tenant), E2E cho luồng chính bằng Playwright |

# X. Danh sách màn hình

| **Mã** | **Nhóm**              | **Màn hình**                                                                                                                                                              |
|--------|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| S01    | Chung                 | Đăng nhập; Quên/đặt lại mật khẩu; Hồ sơ cá nhân và đổi mật khẩu; Trung tâm thông báo                                                                                      |
| S02    | Quản trị nền tảng     | Tổng quan nền tảng; Danh sách/chi tiết doanh nghiệp; Gói thuê bao; Thuê bao và thanh toán; Bộ mẫu (cây nội dung, soạn thảo, phát hành phiên bản); Danh sách đăng ký pilot |
| S03    | Quản trị doanh nghiệp | Hồ sơ doanh nghiệp; Phòng ban; Chức danh; Cấu hình; Thông tin thuê bao                                                                                                    |
| S04    | Nhân viên             | Danh sách nhân viên; Thêm/sửa; Nhập Excel; Phân quyền; Đánh dấu nghỉ việc                                                                                                 |
| S05    | Kho tri thức          | Danh mục và danh sách; Soạn thảo nội dung; Chi tiết và lịch sử phiên bản; Tìm kiếm                                                                                        |
| S06    | Đào tạo               | Danh sách chương trình; Chi tiết chương trình; Trình dựng khóa học (module, bài học, kéo thả); Cấu hình hoàn thành; Thư viện bộ mẫu; Cập nhật bộ mẫu và so sánh           |
| S07    | Phê duyệt             | Danh sách chờ duyệt; Xem trước và duyệt/từ chối                                                                                                                           |
| S08    | Phân bổ               | Quy tắc tự động; Phân bổ thủ công; Danh sách lượt học                                                                                                                     |
| S09    | Kiểm tra              | Ngân hàng câu hỏi; Nhập câu hỏi Excel; Cấu hình bài kiểm tra; Mẫu khảo sát; Xác nhận thực hành (QLTT)                                                                     |
| S10    | Người học             | Việc học của tôi; Trang khóa học; Trình xem bài học; Làm bài kiểm tra; Kết quả; Khảo sát; Lịch sử học tập                                                                 |
| S11    | Báo cáo               | Tổng quan; Tiến độ; Theo phòng ban/nhân viên; Kết quả kiểm tra; Khảo sát; Bàn giao; Cấp dưới của tôi (QLTT)                                                               |
| S13    | Công khai             | Landing page EduCore36; Chính sách bảo mật; Thông báo gửi đăng ký thành công                                                                                              |
| S12    | Bàn giao              | Danh sách hồ sơ; Lập hồ sơ; Tiếp nhận hạng mục (NNBG); Xác nhận hoàn tất (QLTT)                                                                                           |

# XI. Kế hoạch triển khai MVP

| **Giai đoạn**              | **Phạm vi**                                                                                                                                                                   | **Kết quả bàn giao**                                                                                                |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| GĐ0 – Nền móng             | Khởi tạo dự án, CI/CD, mô hình tenant, xác thực, phân quyền, F02, F03 cơ bản, tạo doanh nghiệp thủ công từ F01; đưa landing page F12 lên mạng sớm để tuyển doanh nghiệp pilot | Đăng nhập, quản lý phòng ban/chức danh/nhân viên, test cách ly tenant chạy tự động; landing page nhận đăng ký pilot |
| GĐ1 – Nội dung             | F04 kho tri thức, F05 quản lý đào tạo, quy trình phê duyệt và phiên bản, lưu trữ tệp                                                                                          | Tạo và xuất bản tri thức, khóa học hoàn chỉnh                                                                       |
| GĐ2 – Học tập              | F06 phân bổ, F07 học tập, F08 kiểm tra và khảo sát                                                                                                                            | Nhân viên được giao và hoàn thành khóa học có bài kiểm tra                                                          |
| GĐ3 – Bàn giao và vận hành | F10 bàn giao, F11 thông báo, F09 báo cáo                                                                                                                                      | Luồng nghỉ việc đầy đủ, email nhắc hạn, báo cáo xuất Excel                                                          |
| GĐ4 – Thương mại hóa       | F01 đầy đủ: gói, thuê bao, bộ mẫu và phát hành phiên bản, áp dụng cập nhật                                                                                                    | Vận hành đa doanh nghiệp, bộ mẫu ban đầu                                                                            |
| GĐ5 – Kiểm thử và pilot    | Kiểm thử chấp nhận theo mục XII, sửa lỗi, nhập dữ liệu pilot, hướng dẫn sử dụng                                                                                               | Phát hành cho 3–5 doanh nghiệp pilot                                                                                |

## Gợi ý phân công cho đội agent phát triển

| **Agent**          | **Trách nhiệm chính**                                                   |
|--------------------|-------------------------------------------------------------------------|
| backend-architect  | Lược đồ dữ liệu, RLS, API, tác vụ nền, quy tắc nghiệp vụ D-xx           |
| ui-ux-designer     | Luồng màn hình S01–S12, hệ thống thành phần giao diện, responsive       |
| frontend-developer | Triển khai màn hình, trạng thái, gọi API, trình xem bài học             |
| test-engineer      | Test cách ly tenant, test quy tắc hoàn thành/bàn giao, E2E theo mục XII |
| code-reviewer      | Review bảo mật, phân quyền, chất lượng mã trước khi hợp nhất            |

# XII. Tiêu chí nghiệm thu chính

| **Mã** | **Tiêu chí**                                                                                                                                                                                    |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| AC-01  | Người dùng doanh nghiệp A không xem, sửa được bất kỳ dữ liệu nào của doanh nghiệp B, kể cả khi đổi mã trong URL hoặc gọi API trực tiếp.                                                         |
| AC-02  | Khi đạt số tài khoản tối đa của gói, thao tác kích hoạt tài khoản mới bị chặn và hiển thị thông báo; ADM và QTNT nhận thông báo.                                                                |
| AC-03  | Nội dung chưa được duyệt không hiển thị với người học. Sau khi duyệt, nội dung hiển thị ngay mà không cần thao tác thêm.                                                                        |
| AC-04  | Từ chối nội dung bắt buộc nhập lý do; người tạo nhận thông báo và thấy lý do trên bản Nháp.                                                                                                     |
| AC-05  | Sửa khóa học đã xuất bản không làm thay đổi nội dung người học đang thấy cho đến khi phiên bản mới được duyệt.                                                                                  |
| AC-06  | Nhân viên mới thuộc phòng ban có quy tắc tự động được giao đúng khóa học và hạn hoàn thành ngay khi tạo tài khoản.                                                                              |
| AC-07  | Không tạo được hai lượt học đang hiệu lực cho cùng nhân viên và khóa học.                                                                                                                       |
| AC-08  | Khóa học chỉ chuyển Hoàn thành khi đáp ứng toàn bộ tiêu chí đã bật; hết số lần làm bài mà chưa đạt thì chuyển Chưa đạt.                                                                         |
| AC-09  | Lượt học quá hạn chuyển trạng thái Quá hạn, người học vẫn học được, báo cáo ghi nhận hoàn thành trễ.                                                                                            |
| AC-10  | Đánh dấu nghỉ việc tạo hồ sơ bàn giao và thông báo cho nhân viên, QLTT; tài khoản chỉ bị vô hiệu hóa sau khi QLTT xác nhận hoàn tất.                                                            |
| AC-11  | Hồ sơ chỉ hoàn tất khi mọi hạng mục được người nhận tiếp nhận và QLTT xác nhận; hạng mục bị từ chối quay về người lập kèm lý do.                                                                |
| AC-12  | QLTT lập hồ sơ thay được ghi nhận rõ người lập thay và lý do trong hồ sơ, nhật ký.                                                                                                              |
| AC-13  | Áp dụng cập nhật bộ mẫu cho một module chỉ thay đổi module đó, tạo bản Nháp cần phê duyệt; mục đã tùy chỉnh không bị ghi đè nếu doanh nghiệp chọn Giữ.                                          |
| AC-14  | Báo cáo tiến độ khớp số liệu với danh sách lượt học khi lọc cùng điều kiện; xuất Excel đúng dữ liệu đang lọc.                                                                                   |
| AC-16  | Gửi form đăng ký hợp lệ thì đăng ký được lưu, QTNT nhận email trong vòng 1 phút; thiếu trường bắt buộc, chưa tích ô đồng ý hoặc số điện thoại sai định dạng thì không gửi được và hiển thị lỗi. |
| AC-17  | Nhập mã HTML/JavaScript vào các trường của form không làm thực thi mã trên trang hoặc trong màn hình quản trị.                                                                                  |
| AC-18  | Landing page đạt điểm Lighthouse ≥ 85 cho Performance và SEO trên di động; hiển thị đúng từ 360px.                                                                                              |
| AC-15  | Toàn bộ luồng người học (xem bài, làm kiểm tra, khảo sát) dùng được trên điện thoại màn hình 360px.                                                                                             |

# XIII. Vấn đề cần xác nhận

Các mục dưới đây không chặn việc bắt đầu phát triển GĐ0–GĐ1, nhưng cần chốt trước các giai đoạn liên quan.

| **\#** | **Nội dung**                                                                                               | **Cần trước**                             |
|--------|------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| 1      | Xác nhận hoặc điều chỉnh các quyết định D-01 đến D-20; quyết định được xác nhận chuyển thành BR            | Từng giai đoạn liên quan                  |
| 2      | Bảng giá và các bậc gói thuê bao cụ thể                                                                    | GĐ4                                       |
| 3      | Ngành nghề và nội dung của bộ mẫu ban đầu; ai biên soạn                                                    | GĐ4                                       |
| 4      | Đơn vị hạ tầng (VPS/cloud) và tên miền chính thức                                                          | GĐ0 (môi trường staging)                  |
| 5      | Chốt tên thương mại EduCore36 / TriThuc36 và tên miền educore36.vn đang dùng trên landing page             | GĐ0 (trước khi đưa landing page lên mạng) |
| 6      | Danh sách doanh nghiệp pilot và người đầu mối                                                              | GĐ5                                       |
| 7      | Thứ tự ưu tiên các chức năng GĐ2 (P-02 đến P-07)                                                           | Sau MVP                                   |
| 8      | Thông tin liên hệ thật (hotline, email, địa chỉ) và điều kiện chương trình pilot công bố trên landing page | GĐ0                                       |

# Phụ lục A. Đối chiếu với MISA AMIS

Tóm tắt từ PRD v0.5. Nguồn: tài liệu hướng dẫn phân hệ Đào tạo của AMIS HRM trên help.amis.vn (bản cũ) và mô tả AMIS eLearning của bên thứ ba; cần xác nhận lại qua demo trước khi dùng cho tài liệu thương mại.

| **Chức năng của AMIS**             | **Tương ứng trong PRD**      | **Xử lý trong v1.0**           |
|------------------------------------|------------------------------|--------------------------------|
| Tổng hợp nhu cầu đào tạo           | Chưa có                      | GĐ2 (P-03)                     |
| Lập kế hoạch đào tạo               | Chưa có                      | GĐ2 (P-02)                     |
| Khai báo khóa và buổi đào tạo      | F05 (BR-009)                 | MVP; buổi trực tiếp GĐ2 (P-04) |
| Thêm nhân viên vào khóa            | F06 tự động và thủ công      | MVP                            |
| Thông báo khóa, nhận đăng ký       | F11; đăng ký tự chọn chưa có | MVP; đăng ký GĐ2 (P-05)        |
| Theo dõi các khoản chi             | Chưa có                      | GĐ2 (P-06)                     |
| Xác nhận tham gia                  | F07 tiến độ trực tuyến       | MVP; điểm danh GĐ2 (P-04)      |
| Theo dõi thực hiện kế hoạch        | F09                          | MVP một phần                   |
| Đánh giá chất lượng đào tạo        | FR-08.07 khảo sát (P-01)     | MVP                            |
| Cam kết sau đào tạo                | Chưa có                      | GĐ2 (P-07)                     |
| Báo cáo đào tạo                    | F09                          | MVP                            |
| Bài học video, tài liệu, slide     | F04, F05                     | MVP                            |
| Bài tập, trắc nghiệm               | F08                          | MVP                            |
| Theo dõi thời lượng học và kết quả | F07, F08                     | MVP                            |
| Đồng bộ với HRM, CRM               | Ngoài phạm vi                | Không làm                      |

Điểm khác biệt của sản phẩm so với AMIS: bàn giao và kế thừa tri thức khi nghỉ việc; bộ mẫu đào tạo có phiên bản và áp dụng chọn lọc; phê duyệt nội dung trước khi xuất bản; kho tri thức tập trung; phân bổ tự động theo vị trí; dùng độc lập, không phụ thuộc hệ sinh thái phần mềm khác.

# Phụ lục B. Thuật ngữ

| **Thuật ngữ**         | **Giải thích**                                                                   |
|-----------------------|----------------------------------------------------------------------------------|
| Tenant                | Một doanh nghiệp khách hàng trên nền tảng, có dữ liệu tách biệt                  |
| Bộ mẫu                | Nội dung đào tạo chuẩn do nhà cung cấp xây dựng và phát hành theo phiên bản      |
| Lượt học (Enrollment) | Một lần giao một khóa học cho một nhân viên, có hạn và trạng thái riêng          |
| Tài khoản kích hoạt   | Tài khoản nhân viên đang được phép sử dụng phần mềm, là căn cứ tính phí (BR-016) |
| Chế độ bàn giao       | Trạng thái tài khoản nhân viên nghỉ việc chỉ còn dùng chức năng bàn giao         |
| MVP                   | Phiên bản sản phẩm tối thiểu đưa vào sử dụng thực tế ở giai đoạn pilot           |
