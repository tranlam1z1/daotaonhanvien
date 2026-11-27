'use client';

import { useState } from 'react';
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/95 md:backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <a
            href="#"
            className="flex items-center gap-2.5 group focus:outline-hidden"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-navy-900 via-navy-800 to-brand-blue flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-xl tracking-tight text-navy-900">
                  EduCore<span className="text-brand-blue">36</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-brand-teal border border-teal-200">
                  Phiên bản Pilot 1.0
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:block">
                TriThuc36 • Quản trị tri thức & Đào tạo
              </span>
            </div>
          </a>

          <nav
            aria-label="Điều hướng chính"
            className="hidden xl:flex items-center gap-4 text-xs font-medium text-slate-600"
          >
            <a
              href="#van-de-giai-phap"
              className="hover:text-brand-blue transition-colors py-2"
            >
              Vấn đề & Giải pháp
            </a>
            <a
              href="#ba-tru-cot"
              className="hover:text-brand-blue transition-colors py-2"
            >
              3 Trụ cột
            </a>
            <a
              href="#trai-nghiem-vai-tro"
              className="hover:text-brand-blue transition-colors py-2"
            >
              Tính năng nổi bật
            </a>
            <a
              href="#diem-khac-biet"
              className="hover:text-brand-blue transition-colors py-2"
            >
              Bảng giá minh bạch
            </a>
            <a
              href="#chuong-trinh-pilot"
              className="hover:text-brand-blue transition-colors py-2"
            >
              Chương trình Pilot
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/dang-nhap"
              className="hidden sm:inline-flex text-sm font-semibold text-brand-blue px-2 py-2.5"
            >
              Đăng nhập
            </a>
            <a
              href="#dang-ky-pilot"
              className="inline-flex items-center justify-center px-3 py-2.5 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-brand-orange hover:bg-orange-600 shadow-xs transition-all"
            >
              Đăng ký dùng thử
            </a>

            <button
              id="mobile-menu-btn"
              aria-controls="mobile-menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              aria-label={
                menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'
              }
              className="xl:hidden p-2.5 rounded-xl text-slate-600 hover:text-navy-900 hover:bg-slate-100 focus:outline-hidden"
            >
              <svg
                aria-hidden="true"
                id="menu-icon-open"
                className={menuOpen ? 'hidden' : 'w-6 h-6'}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                aria-hidden="true"
                id="menu-icon-close"
                className={menuOpen ? 'w-6 h-6' : 'hidden'}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="xl:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-5 space-y-1 shadow-lg"
      >
        <a
          href="/dang-nhap"
          className="block px-3 py-2.5 font-semibold text-brand-blue"
        >
          Đăng nhập
        </a>
        <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-brand-teal bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            Phiên bản Pilot 1.0 • Thanh Hóa
          </span>
        </div>
        <a
          href="#van-de-giai-phap"
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-blue"
        >
          Vấn đề & Giải pháp
        </a>
        <a
          href="#ba-tru-cot"
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-blue"
        >
          3 Trụ cột cốt lõi
        </a>
        <a
          href="#trai-nghiem-vai-tro"
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-blue"
        >
          Tính năng nổi bật
        </a>
        <a
          href="#diem-khac-biet"
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-blue"
        >
          Bảng giá minh bạch
        </a>
        <a
          href="#chuong-trinh-pilot"
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-blue"
        >
          Chương trình Pilot
        </a>
      </div>
    </header>
  );
}
