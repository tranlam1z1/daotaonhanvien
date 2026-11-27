import { PilotForm } from './PilotForm';
export function Pilot() {
  return (
    <section
      id="chuong-trinh-pilot"
      className="py-16 sm:py-24 bg-linear-to-b from-slate-50 to-blue-50/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 shadow-soft mb-14">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-teal">
              Mục tiêu cam kết sau 3 tháng triển khai Pilot
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-navy-900">
              Hiệu quả đo lường bằng con số thực tế
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-brand-blue">
                ≥ 80%
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5">
                Nhân viên mới hoàn thành hội nhập đúng hạn
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-brand-teal">
                100%
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5">
                Nhân sự nghỉ việc có hồ sơ bàn giao hoàn tất
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-brand-orange">
                ≥ 30
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5">
                Nội dung tri thức cốt lõi được chuẩn hóa & xuất bản
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                ≥ 4.0/5
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5">
                Điểm hài lòng trung bình khảo sát khóa học
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center sm:col-span-2 lg:col-span-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-navy-900">
                3 – 5
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1.5">
                Doanh nghiệp tiên phong tại Thanh Hóa đợt 1
              </p>
            </div>
          </div>
        </div>

        <div
          id="dang-ky-pilot"
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start scroll-mt-24"
        >
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 text-brand-orange text-xs font-bold">
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
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Dành riêng cho Doanh nghiệp tại Thanh Hóa</span>
            </div>

            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-navy-900 leading-tight">
              Chương trình Đồng hành Chuyển đổi số Tri thức – Đợt Pilot 1.0
            </h3>

            <p className="text-base text-slate-600 leading-relaxed">
              Chúng tôi tìm kiếm{' '}
              <strong>3–5 doanh nghiệp tiên phong tại Thanh Hóa</strong> để đồng
              hành triển khai thực tế và tối ưu hóa quy trình đào tạo nội bộ với
              đặc quyền hỗ trợ 1-1 từ đội ngũ phát triển sản phẩm.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center shrink-0 font-extrabold">
                  01
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 text-base">
                    Miễn phí 100% chi phí sử dụng trong 3 tháng Pilot
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Trải nghiệm đầy đủ toàn bộ 11 phân hệ quản trị tri thức, đào
                    tạo, thi trắc nghiệm và bàn giao nghỉ việc.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center shrink-0 font-extrabold">
                  02
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 text-base">
                    Hỗ trợ nhập dữ liệu nhân sự & cơ cấu phòng ban từ Excel
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Đội ngũ kỹ thuật hỗ trợ thiết lập không gian doanh nghiệp,
                    phân quyền vai trò và hướng dẫn vận hành trực tiếp.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center shrink-0 font-extrabold">
                  03
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 text-base">
                    Đồng hành biên soạn khung đào tạo mẫu ban đầu
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Tư vấn chuyển đổi tài liệu Word/PDF sẵn có của công ty thành
                    chương trình đào tạo hội nhập chuẩn hóa.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl">
              <div className="mb-6">
                <h4 className="text-xl sm:text-2xl font-extrabold text-navy-900">
                  Đăng ký nhận tư vấn & Suất Pilot
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  Điền thông tin bên dưới, chuyên viên tại Thanh Hóa sẽ liên hệ
                  demo trong vòng 2 giờ làm việc.
                </p>
              </div>

              <PilotForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
