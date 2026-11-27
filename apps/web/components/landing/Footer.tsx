export function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-400 pt-14 pb-10 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-800/80">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-blue flex items-center justify-center text-white">
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="font-extrabold text-xl text-white">
                EduCore<span className="text-brand-blue">36</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              Nền tảng quản trị tri thức và đào tạo nội bộ doanh nghiệp
              (PRD-EDU-001). Giải pháp SaaS giúp chuẩn hóa quy trình, đào tạo tự
              động và kế thừa tri thức bền vững cho cộng đồng doanh nghiệp Thanh
              Hóa.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Liên kết nhanh
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/chinh-sach-bao-mat"
                  className="hover:text-white transition"
                >
                  Chính sách bảo mật
                </a>
              </li>
              <li>
                <a
                  href="#van-de-giai-phap"
                  className="hover:text-white transition"
                >
                  Vấn đề & Giải pháp
                </a>
              </li>
              <li>
                <a href="#ba-tru-cot" className="hover:text-white transition">
                  3 Trụ cột nghiệp vụ
                </a>
              </li>
              <li>
                <a
                  href="#trai-nghiem-vai-tro"
                  className="hover:text-white transition"
                >
                  Giao diện theo vai trò
                </a>
              </li>
              <li>
                <a
                  href="#diem-khac-biet"
                  className="hover:text-white transition"
                >
                  Chính sách tính phí
                </a>
              </li>
              <li>
                <a
                  href="#dang-ky-pilot"
                  className="hover:text-orange-400 text-orange-300 font-medium transition"
                >
                  Đăng ký Pilot Thanh Hóa
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Văn phòng Tư vấn & Triển khai
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-brand-blue shrink-0 mt-0.5"
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
                <span>
                  Phường Hạc Thành, Thành phố Thanh Hóa, Tỉnh Thanh Hóa
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-brand-teal shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>
                  Hotline / Zalo Tư vấn:{' '}
                  <strong className="text-white">0904.36.36.88</strong>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-brand-orange shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>pilot@educore36.vn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © 2026 EduCore36 (TriThuc36). Phát triển dành cho Doanh nghiệp Việt
            Nam.
          </p>
          <p>Phiên bản tài liệu đặc tả: PRD-EDU-001 v1.0 (MVP Pilot)</p>
        </div>
      </div>
    </footer>
  );
}
