export function Pillars() {
  return (
    <section
      id="ba-tru-cot"
      className="py-16 sm:py-24 bg-slate-50 border-y border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-teal bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-full">
            Kiến trúc nghiệp vụ khép kín
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-navy-900">
            3 Trụ cột bảo toàn và nhân bản tri thức doanh nghiệp
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Quản lý trọn vẹn vòng đời tri thức từ lúc tạo lập, đào tạo đội ngũ
            cho đến khi bàn giao kế thừa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-7 shadow-card border border-slate-200/80 hover:border-blue-300 hover:shadow-soft transition-all flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-brand-blue flex items-center justify-center mb-6">
              <svg
                aria-hidden="true"
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div className="text-xs font-bold text-brand-blue uppercase tracking-wider mb-1">
              Trụ cột 01
            </div>
            <h3 className="text-xl font-bold text-navy-900 mb-3">
              Quản trị tri thức tập trung
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 flex-grow">
              Số hóa toàn bộ quy trình, biểu mẫu, tài liệu hướng dẫn (PDF, Word,
              Video) vào một kho lưu trữ duy nhất với cấu trúc cây danh mục khoa
              học.
            </p>
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue"></span>
                <span>Phân quyền truy cập theo phòng ban, chức danh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue"></span>
                <span>Quy trình phê duyệt chặt chẽ (Nháp → Xuất bản)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue"></span>
                <span>Quản lý phiên bản, không gián đoạn người đọc</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-card border border-slate-200/80 hover:border-teal-300 hover:shadow-soft transition-all flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center mb-6">
              <svg
                aria-hidden="true"
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 14l9-5-9-5-9 5 9 5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                />
              </svg>
            </div>
            <div className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-1">
              Trụ cột 02
            </div>
            <h3 className="text-xl font-bold text-navy-900 mb-3">
              Đào tạo theo vị trí
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 flex-grow">
              Cung cấp đúng kiến thức cho đúng người vào đúng thời điểm. Thiết
              kế lộ trình bài bản với cảnh báo tự động khi vượt quá thời lượng
              mục tiêu.
            </p>
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal"></span>
                <span>Cấu trúc 4 cấp: Chương trình → Khóa → Module → Bài</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal"></span>
                <span>Tự động giao bài khi tạo nhân viên mới / đổi vị trí</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal"></span>
                <span>Thi trắc nghiệm ngẫu nhiên & xác nhận thực hành</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 shadow-card border border-slate-200/80 hover:border-orange-300 hover:shadow-soft transition-all flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center mb-6">
              <svg
                aria-hidden="true"
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div className="text-xs font-bold text-brand-orange uppercase tracking-wider mb-1">
              Trụ cột 03
            </div>
            <h3 className="text-xl font-bold text-navy-900 mb-3">
              Bàn giao & Kế thừa tri thức
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 flex-grow">
              Khóa chặt lỗ hổng thất thoát chất xám khi nhân sự biến động. Mọi
              nhân viên nghỉ việc đều phải hoàn tất hồ sơ bàn giao minh bạch.
            </p>
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                <span>Khởi tạo hồ sơ bàn giao ngay khi báo nghỉ việc</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                <span>Người nhận & Quản lý trực tiếp cùng xác nhận</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                <span>Chuyển mục "Kinh nghiệm" thành tài liệu nháp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
