import { Fragment } from 'react';
import { RoleTabs } from './RoleTabs';
export function Roles() {
  return (
    <section id="trai-nghiem-vai-tro" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full">
            Giao diện thực tế theo phân quyền
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-navy-900">
            Thiết kế tinh gọn cho từng vai trò trong doanh nghiệp
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Bấm chọn từng vai trò bên dưới để trải nghiệm góc nhìn và công cụ
            chuyên biệt trên hệ thống.
          </p>
        </div>

        <RoleTabs
          labels={[
            <Fragment key="admin">
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span>Giám đốc / Admin</span>
            </Fragment>,
            <Fragment key="manager">
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Quản lý trực tiếp / Đào tạo</span>
            </Fragment>,
            <Fragment key="employee">
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span>Nhân viên học tập</span>
            </Fragment>,
          ]}
          panels={[
            <div
              key="admin"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-brand-blue text-xs font-bold">
                  Góc nhìn Lãnh đạo & Quản trị hệ thống
                </div>
                <h3 className="text-2xl font-extrabold text-navy-900">
                  Nắm bắt toàn cảnh chất lượng nhân sự và tối ưu chi phí vận
                  hành
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Không cần hỏi báo cáo thủ công từ từng phòng ban. Dashboard
                  tổng quan hiển thị theo thời gian thực tỷ lệ hoàn thành đào
                  tạo, hồ sơ bàn giao và trạng thái gói thuê bao.
                </p>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Báo cáo trực quan:</strong> Theo dõi tỷ lệ hoàn
                      thành 84%, cảnh báo lượt học quá hạn và xuất Excel 1 chạm.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Sơ đồ tổ chức linh hoạt:</strong> Quản lý cây
                      phòng ban, chức danh và nhập hàng loạt nhân viên từ file
                      Excel.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Tự động ngưng tính phí:</strong> Ngay khi nhân sự
                      nghỉ việc hoàn tất bàn giao, hệ thống tự động vô hiệu hóa
                      tài khoản.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-navy-900 text-base">
                        Tổng quan Đào tạo & Tri thức Doanh nghiệp
                      </h4>
                      <p className="text-xs text-slate-500">
                        Cập nhật tự động • Tháng 11/2026
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                      Xuất báo cáo Excel
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                      <p className="text-xs text-slate-500 font-medium">
                        Tỷ lệ hoàn thành
                      </p>
                      <p className="text-2xl font-extrabold text-brand-blue mt-1">
                        84%
                      </p>
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        +12% so với tháng trước
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100">
                      <p className="text-xs text-slate-500 font-medium">
                        Tài liệu xuất bản
                      </p>
                      <p className="text-2xl font-extrabold text-brand-teal mt-1">
                        48
                      </p>
                      <span className="text-[11px] text-slate-500">
                        100% đã phê duyệt
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-100">
                      <p className="text-xs text-slate-500 font-medium">
                        Bàn giao đang mở
                      </p>
                      <p className="text-2xl font-extrabold text-brand-orange mt-1">
                        02
                      </p>
                      <span className="text-[11px] text-orange-700 font-medium">
                        Đang chờ QLTT duyệt
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">
                        Tài khoản tính phí
                      </p>
                      <p className="text-2xl font-extrabold text-navy-900 mt-1">
                        64
                        <span className="text-sm font-normal text-slate-400">
                          /100
                        </span>
                      </p>
                      <span className="text-[11px] text-slate-500">
                        Đã khóa 3 TK nghỉ việc
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Tiến độ hoàn thành theo phòng ban
                    </p>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">
                          Phòng Kinh doanh & CSKH (28 nhân sự)
                        </span>
                        <span className="text-brand-blue">91%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full">
                        <div
                          className="bg-brand-blue h-2 rounded-full"
                          style={{ width: '91%' }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">
                          Khối Vận hành & Kho vận (22 nhân sự)
                        </span>
                        <span className="text-brand-teal">82%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full">
                        <div
                          className="bg-brand-teal h-2 rounded-full"
                          style={{ width: '82%' }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700">
                          Phòng Kế toán & Hành chính (14 nhân sự)
                        </span>
                        <span className="text-emerald-600">100%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            <div
              key="manager"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-brand-teal text-xs font-bold">
                  Góc nhìn Quản lý trực tiếp & Phụ trách đào tạo
                </div>
                <h3 className="text-2xl font-extrabold text-navy-900">
                  Kế thừa bộ mẫu có sẵn, kèm cặp thực hành và duyệt bàn giao
                  chặt chẽ
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Tiết kiệm 70% công sức soạn bài nhờ thư viện bộ mẫu chuẩn.
                  Quản lý trực tiếp theo dõi sát sao năng lực thực tế của cấp
                  dưới thay vì chỉ học lý thuyết suông.
                </p>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-100 text-brand-teal flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Kế thừa & Tùy chỉnh bộ mẫu:</strong> Sao chép khóa
                      học mẫu, kéo thả sắp xếp module và áp dụng cập nhật chọn
                      lọc.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-100 text-brand-teal flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Xác nhận thực hành thực tế:</strong> Nhân viên chỉ
                      được tính hoàn thành khóa học khi Quản lý trực tiếp đánh
                      giá "Đạt" tay nghề.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-100 text-brand-teal flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Kiểm soát bàn giao cấp dưới:</strong> Kiểm tra
                      từng hạng mục bàn giao, yêu cầu bổ sung hoặc lập thay nếu
                      nhân sự nghỉ đột xuất.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="font-bold text-navy-900 text-base">
                      Tác vụ cần Quản lý xử lý (3)
                    </h4>
                    <span className="px-2.5 py-1 rounded-full bg-orange-100 text-brand-orange text-xs font-bold">
                      Ưu tiên cao
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-brand-blue uppercase">
                        Chờ xác nhận thực hành (FR-08.05)
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm mt-0.5">
                        Nguyễn Thị Lan – Quy trình tư vấn & chốt đơn B2B
                      </h5>
                      <p className="text-xs text-slate-500 mt-1">
                        Đã hoàn thành 100% bài học • Điểm trắc nghiệm: 85/100
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">
                        Xác nhận Đạt
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-brand-orange uppercase">
                        Xác nhận hoàn tất bàn giao (BR-010)
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm mt-0.5">
                        Hồ sơ nghỉ việc: Trần Quốc Bảo (Trưởng nhóm Kho)
                      </h5>
                      <p className="text-xs text-slate-500 mt-1">
                        4/4 hạng mục đã được người nhận tiếp nhận • Có 1 mục
                        kinh nghiệm lưu kho tri thức
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-bold">
                        Duyệt hoàn tất
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-brand-teal uppercase">
                        Cập nhật Bộ mẫu chuẩn v1.4
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm mt-0.5">
                        Khóa mẫu: Kỹ năng An toàn lao động & PCCC cơ bản
                      </h5>
                      <p className="text-xs text-slate-600 mt-1">
                        Nhà cung cấp vừa bổ sung 2 bài học mới • Tùy chọn: Giữ
                        bản cũ / Cập nhật
                      </p>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-brand-blue text-xs font-bold shrink-0">
                      So sánh & Áp dụng
                    </span>
                  </div>
                </div>
              </div>
            </div>,
            <div
              key="employee"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-brand-orange text-xs font-bold">
                  Góc nhìn Nhân viên (Tương thích Mobile từ 360px)
                </div>
                <h3 className="text-2xl font-extrabold text-navy-900">
                  Học tập mọi lúc trên điện thoại, tra cứu quy trình trong 5
                  giây
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Giao diện "Việc học của tôi" thân thiện, không cần cài app
                  phức tạp. Nhân viên mới biết chính xác mình cần học gì hôm
                  nay, hạn hoàn thành bao giờ.
                </p>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-100 text-brand-orange flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Lộ trình rõ ràng & Lưu tiến độ:</strong> Xem
                      video, đọc tài liệu PDF ngay trên trình duyệt, tự động lưu
                      vị trí đang học dở.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-100 text-brand-orange flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Nhắc hạn tự động:</strong> Hệ thống tự động thông
                      báo qua ứng dụng và email trước 3 ngày đến hạn hoàn thành.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-100 text-brand-orange flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">
                      <strong>Thi trắc nghiệm & Khảo sát:</strong> Chấm điểm tự
                      động ngay sau khi nộp bài và đóng góp ý kiến cải thiện
                      khóa học.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-7 flex justify-center">
                <div className="w-full max-w-md bg-white rounded-3xl border-4 border-slate-800 shadow-2xl p-5">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Xin chào, Phạm Minh Anh
                      </p>
                      <h4 className="font-extrabold text-navy-900 text-base">
                        Việc học của tôi
                      </h4>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-bold text-xs">
                      MA
                    </span>
                  </div>

                  <div className="rounded-2xl bg-linear-to-br from-navy-900 to-brand-blue text-white p-4 mb-4">
                    <div className="flex items-center justify-between text-[11px] text-blue-200 mb-1.5">
                      <span>Bắt buộc • Hội nhập</span>
                      <span className="px-2 py-0.5 rounded bg-orange-500 text-white font-bold">
                        Còn 2 ngày
                      </span>
                    </div>
                    <h5 className="font-bold text-sm sm:text-base mb-3">
                      Văn hóa doanh nghiệp & Nội quy làm việc
                    </h5>
                    <div className="w-full bg-white/20 h-2 rounded-full mb-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full"
                        style={{ width: '75%' }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Tiến độ: 3/4 bài học</span>
                      <span className="font-bold underline">Học tiếp →</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Bài kiểm tra cuối khóa
                        </p>
                        <p className="text-[11px] text-slate-500">
                          15 câu trắc nghiệm • Điểm đạt: ≥ 70%
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-bold">
                        Làm bài
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Tra cứu Kho tri thức nội bộ
                        </p>
                        <p className="text-[11px] text-slate-500">
                          24 quy trình thuộc Phòng Kinh doanh
                        </p>
                      </div>
                      <span className="text-xs font-bold text-brand-blue">
                        Mở kho →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
          ]}
        />
      </div>
    </section>
  );
}
