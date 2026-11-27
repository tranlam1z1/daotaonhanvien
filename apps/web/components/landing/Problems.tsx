export function Problems() {
  return (
    <section id="van-de-giai-phap" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full">
            Bài toán thực tế tại doanh nghiệp
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-navy-900">
            Chấm dứt vòng luẩn quẩn "Tuyển mới – Đào tạo lại – Nghỉ việc mất
            dấu"
          </h2>
          <p className="mt-3 text-base text-slate-600">
            So sánh trực diện sự khác biệt giữa cách quản lý thủ công rời rạc và
            vận hành chuẩn hóa trên EduCore36.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <svg
                    aria-hidden="true"
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-rose-600 tracking-wider">
                    Trước đây (Before)
                  </span>
                  <h3 className="text-xl font-bold text-slate-900">
                    Cách vận hành truyền thống rời rạc
                  </h3>
                </div>
              </div>

              <ul className="space-y-4">
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200/80">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      Tài liệu nằm rải rác trên Zalo, Drive cá nhân
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Quy trình bị phân tán tại từng phòng ban, nhân viên không
                      biết đâu là phiên bản mới nhất để áp dụng.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200/80">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      Đào tạo nhân viên mới bằng cách "truyền miệng"
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Mỗi lần có nhân sự mới gia nhập, quản lý và nhân sự cũ lại
                      mất hàng tuần hướng dẫn lặp đi lặp lại cùng một nội dung.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200/80">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      Nhân sự nghỉ việc mang theo toàn bộ kinh nghiệm
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Bàn giao sơ sài qua tin nhắn hoặc file Word rời rạc; người
                      tiếp nhận không xác nhận rõ ràng dẫn đến đứt gãy công
                      việc.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl bg-linear-to-br from-navy-900 to-navy-800 text-white p-6 sm:p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center shrink-0">
                  <svg
                    aria-hidden="true"
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-teal-300 tracking-wider">
                    Giải pháp (After)
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Vận hành chuẩn hóa với EduCore36
                  </h3>
                </div>
              </div>

              <ul className="space-y-4">
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-teal-400 shrink-0 mt-0.5"
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
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base">
                      Kho tri thức tập trung, có phê duyệt & phiên bản
                    </h4>
                    <p className="text-sm text-blue-100 mt-1">
                      Tài liệu được phân quyền chặt chẽ theo phòng ban/chức
                      danh, kiểm duyệt trước khi xuất bản và lưu lịch sử thay
                      đổi.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-teal-400 shrink-0 mt-0.5"
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
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base">
                      Tự động giao khóa học ngay khi nhận việc / đổi vị trí
                    </h4>
                    <p className="text-sm text-blue-100 mt-1">
                      Hệ thống tự động phân bổ lộ trình đào tạo kèm hạn hoàn
                      thành, bài kiểm tra trắc nghiệm và xác nhận thực hành.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-teal-400 shrink-0 mt-0.5"
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
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base">
                      Bắt buộc hoàn tất bàn giao trước khi khóa tài khoản
                    </h4>
                    <p className="text-sm text-blue-100 mt-1">
                      Người nhận và quản lý trực tiếp cùng xác nhận từng hạng
                      mục; biến kinh nghiệm người cũ thành tài liệu cho người
                      sau.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
