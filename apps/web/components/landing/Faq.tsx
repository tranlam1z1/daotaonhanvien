'use client';

import { useState } from 'react';
export function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  return (
    <section className="py-16 sm:py-24 bg-white border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full">
            Giải đáp thắc mắc
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-navy-900">
            Câu hỏi thường gặp từ các doanh nghiệp
          </h2>
        </div>

        <div className="space-y-4" id="faq-container">
          <div className="faq-item rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              id="faq-question-0"
              aria-controls="faq-answer-0"
              className="faq-toggle w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden"
              aria-expanded={openFaq === 0}
              onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}
            >
              <span className="font-bold text-navy-900 text-base sm:text-lg">
                1. Dữ liệu nội bộ của công ty tôi có bị công ty khác xem được
                không?
              </span>
              <svg
                aria-hidden="true"
                className={`faq-icon w-5 h-5 shrink-0 transition-transform duration-200 ${openFaq === 0 ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              id="faq-answer-0"
              aria-labelledby="faq-question-0"
              hidden={openFaq !== 0}
              className="faq-content px-6 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed"
            >
              <strong>Tuyệt đối không.</strong> Hệ thống áp dụng cơ chế cách ly
              dữ liệu đa doanh nghiệp ở cả tầng ứng dụng lẫn tầng cơ sở dữ liệu
              (PostgreSQL Row Level Security). Mỗi doanh nghiệp sở hữu mã định
              danh (Tenant ID) và kho lưu trữ tệp tách biệt hoàn toàn; ngay cả
              Quản trị nền tảng cũng không được phép xem nội dung tài liệu riêng
              hay kết quả học tập của doanh nghiệp bạn.
            </div>
          </div>

          <div className="faq-item rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              id="faq-question-1"
              aria-controls="faq-answer-1"
              className="faq-toggle w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden"
              aria-expanded={openFaq === 1}
              onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
            >
              <span className="font-bold text-navy-900 text-base sm:text-lg">
                2. Khi nhân viên nghỉ việc thì công ty tôi có bị mất phí duy trì
                tài khoản đó không?
              </span>
              <svg
                aria-hidden="true"
                className={`faq-icon w-5 h-5 shrink-0 transition-transform duration-200 ${openFaq === 1 ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              id="faq-answer-1"
              aria-labelledby="faq-question-1"
              hidden={openFaq !== 1}
              className="faq-content px-6 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed"
            >
              <strong>Không.</strong> Căn cứ tính phí của EduCore36 là số tài
              khoản nhân viên đang kích hoạt sử dụng thực tế. Khi nhân viên nghỉ
              việc hoàn tất quy trình bàn giao (và được Quản lý trực tiếp xác
              nhận), tài khoản sẽ tự động chuyển sang trạng thái vô hiệu hóa và
              ngừng tính phí. Toàn bộ hồ sơ bàn giao và lịch sử học tập vẫn được
              lưu trữ để tra cứu.
            </div>
          </div>

          <div className="faq-item rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              id="faq-question-2"
              aria-controls="faq-answer-2"
              className="faq-toggle w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden"
              aria-expanded={openFaq === 2}
              onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
            >
              <span className="font-bold text-navy-900 text-base sm:text-lg">
                3. Nhân viên kinh doanh, kho vận thường xuyên di chuyển có học
                trên điện thoại được không?
              </span>
              <svg
                aria-hidden="true"
                className={`faq-icon w-5 h-5 shrink-0 transition-transform duration-200 ${openFaq === 2 ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              id="faq-answer-2"
              aria-labelledby="faq-question-2"
              hidden={openFaq !== 2}
              className="faq-content px-6 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed"
            >
              <strong>Hoàn toàn được.</strong> Toàn bộ giao diện người học (xem
              video bài giảng, đọc tài liệu PDF, làm bài kiểm tra trắc nghiệm,
              khảo sát và tra cứu kho tri thức) được tối ưu chuẩn Web Responsive
              cho màn hình điện thoại từ 360px trở lên. Nhân viên chỉ cần mở
              trình duyệt web trên điện thoại là học được ngay mà không cần tải
              ứng dụng nặng máy.
            </div>
          </div>

          <div className="faq-item rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              id="faq-question-3"
              aria-controls="faq-answer-3"
              className="faq-toggle w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-hidden"
              aria-expanded={openFaq === 3}
              onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
            >
              <span className="font-bold text-navy-900 text-base sm:text-lg">
                4. Doanh nghiệp chưa từng làm đào tạo bài bản thì mất bao lâu để
                triển khai?
              </span>
              <svg
                aria-hidden="true"
                className={`faq-icon w-5 h-5 shrink-0 transition-transform duration-200 ${openFaq === 3 ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              id="faq-answer-3"
              aria-labelledby="faq-question-3"
              hidden={openFaq !== 3}
              className="faq-content px-6 pb-5 text-sm sm:text-base text-slate-600 leading-relaxed"
            >
              Chỉ mất từ <strong>2 đến 5 ngày làm việc</strong>. Nhờ tính năng
              nhập danh sách nhân sự từ file Excel có sẵn và thư viện Bộ mẫu
              chương trình đào tạo chuẩn, doanh nghiệp của bạn có thể kích hoạt
              ngay các khóa hội nhập cơ bản và đưa tài liệu Word/PDF sẵn có lên
              hệ thống mà không cần đội ngũ IT riêng.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
