export function Hero() {
  return (
    <section className="relative bg-linear-to-b from-navy-900 via-navy-900 to-navy-800 text-white pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
      <div
        aria-hidden="true"
        className="hero-grid absolute inset-0 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 text-xs sm:text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
              <span>
                Giải pháp SaaS chuyên biệt cho doanh nghiệp tại Thanh Hóa
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight leading-[1.2] text-white">
              Đừng để chất xám doanh nghiệp rời đi cùng{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-amber-300">
                nhân sự nghỉ việc
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Chuẩn hóa tài liệu nội bộ, tự động hóa đào tạo hội nhập theo vị
              trí và kiểm soát 100% quy trình bàn giao tri thức chỉ trên một nền
              tảng duy nhất.
            </p>

            <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
              <a
                href="#dang-ky-pilot"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold text-white bg-brand-orange hover:bg-orange-600 shadow-lg shadow-orange-600/25 transition-all"
              >
                <span>Đăng ký tham gia Pilot miễn phí</span>
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
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
              <a
                href="#trai-nghiem-vai-tro"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/20 md:backdrop-blur-xs transition-all"
              >
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-blue-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>Khám phá giao diện</span>
              </a>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-teal-400 shrink-0"
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
                <span>Sẵn bộ mẫu đào tạo chuẩn</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-teal-400 shrink-0"
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
                <span>Không cần cài đặt ERP phức tạp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-teal-400 shrink-0"
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
                <span>Hỗ trợ trực tiếp tại Thanh Hóa</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 sm:p-6 shadow-2xl md:backdrop-blur-md">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    app.educore36.vn • Không gian Doanh nghiệp
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Dữ liệu cách ly RLS
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-white text-slate-800 p-4 shadow-md">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-brand-blue flex items-center justify-center shrink-0">
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider">
                          Phân bổ tự động (BR-004)
                        </p>
                        <h3 className="text-sm font-bold text-navy-900">
                          Lộ trình Hội nhập Nhân viên Kinh doanh
                        </h3>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-brand-blue">
                      85%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-2">
                    <div
                      className="bg-linear-to-r from-brand-blue to-teal-500 h-2.5 rounded-full"
                      style={{ width: '85%' }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Hoàn thành: 6/7 bài học • Điểm kiểm tra: 90/100</span>
                    <span className="text-emerald-600 font-semibold">
                      Đúng hạn
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-white text-slate-800 p-4 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 text-brand-teal"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Quy trình phê duyệt Kho tri thức
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Phiên bản v2.1
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="py-2 px-2 rounded-lg bg-slate-100 text-slate-500 font-medium border border-slate-200">
                      1. Bản Nháp
                    </div>
                    <div className="py-2 px-2 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                      2. Chờ duyệt
                    </div>
                    <div className="py-2 px-2 rounded-lg bg-emerald-600 text-white font-bold shadow-xs">
                      3. Đã xuất bản ✓
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-linear-to-r from-slate-800 to-navy-900 border border-slate-700 p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-orange-300 flex items-center gap-1.5">
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
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                      Kiểm soát Bàn giao Nghỉ việc (BR-006)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      100% Kế thừa
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2.5">
                    Nhân sự: <strong className="text-white">Lê Văn Minh</strong>{' '}
                    (Phòng Kế toán) • 5/5 hạng mục đã tiếp nhận
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/80 text-[11px]">
                    <span className="text-emerald-400 font-semibold">
                      ● Quản lý trực tiếp đã xác nhận
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-medium">
                      Tự động khóa TK & Ngưng tính phí
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 text-xs text-slate-300">
        Giao diện và số liệu trên đây chỉ mang tính minh họa.
      </p>
    </section>
  );
}
