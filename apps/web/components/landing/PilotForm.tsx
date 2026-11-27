'use client';
import { useState, type FormEvent } from 'react';
import {
  parsePilotRegistration,
  type PilotRegistration,
} from '../../lib/pilot';
export function PilotForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<PilotRegistration | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const registration = parsePilotRegistration(
      new FormData(event.currentTarget),
    );
    if (!registration) {
      setError(
        'Vui lòng điền đầy đủ thông tin, kiểm tra số điện thoại Việt Nam và đồng ý cho phép xử lý dữ liệu cá nhân.',
      );
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registration),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Registration failed');
      setSubmitted(registration);
    } catch {
      setError(
        'Chưa thể gửi đăng ký. Anh/chị vui lòng thử lại sau hoặc liên hệ hotline 0904.36.36.88.',
      );
    } finally {
      setPending(false);
    }
  }
  if (submitted)
    return (
      <div
        id="form-success-box"
        role="status"
        className="text-center py-8 px-4 space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <svg
            aria-hidden="true"
            className="w-9 h-9"
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
        <h4 className="text-xl sm:text-2xl font-extrabold text-navy-900">
          Đăng ký thành công!
        </h4>
        <p
          id="success-summary"
          className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mx-auto"
        >
          Cảm ơn anh/chị <strong>{submitted.fullName}</strong> (
          {submitted.jobTitle} – <strong>{submitted.companyName}</strong>). Đội
          ngũ triển khai tại Thanh Hóa đã ghi nhận đăng ký suất Pilot và sẽ liên
          hệ qua số <strong>{submitted.phone}</strong> trong vòng 2 giờ làm
          việc.
        </p>
        <div className="pt-3">
          <button
            type="button"
            id="reset-form-btn"
            onClick={() => {
              setSubmitted(null);
              setError(null);
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 transition"
          >
            Đăng ký thêm doanh nghiệp khác
          </button>
        </div>
      </div>
    );
  return (
    <form
      id="pilot-form"
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit}
      aria-busy={pending}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Họ tên người liên hệ <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            placeholder="VD: Nguyễn Văn An"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition"
          />
        </div>
        <div>
          <label
            htmlFor="jobTitle"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Chức vụ <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="jobTitle"
            name="jobTitle"
            autoComplete="organization-title"
            required
            placeholder="VD: Giám đốc / Trưởng phòng HCNS"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="companyName"
          className="block text-sm font-semibold text-slate-700 mb-1.5"
        >
          Tên doanh nghiệp <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          id="companyName"
          name="companyName"
          autoComplete="organization"
          required
          placeholder="VD: Công ty TNHH Thương mại & Dịch vụ..."
          className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="companySize"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Quy mô nhân sự <span className="text-rose-500">*</span>
          </label>
          <select
            id="companySize"
            name="companySize"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition"
          >
            <option value="">-- Chọn quy mô --</option>
            <option value="under-30">Dưới 30 nhân sự</option>
            <option value="30-100">Từ 30 – 100 nhân sự</option>
            <option value="over-100">Trên 100 nhân sự</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Số điện thoại / Zalo <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            autoComplete="tel"
            required
            placeholder="VD: 0912 345 678"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition"
          />
        </div>
      </div>

      <label
        className="flex items-start gap-3 text-sm text-slate-700"
        htmlFor="consent"
      >
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-1 size-4 accent-brand-blue shrink-0"
        />
        <span>
          Tôi đồng ý cho phép xử lý dữ liệu cá nhân theo{' '}
          <a className="text-brand-blue underline" href="/chinh-sach-bao-mat">
            Chính sách bảo mật
          </a>
          .
        </span>
      </label>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Trang web của bạn</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {error && (
        <p
          id="form-error-msg"
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium"
        >
          {error}
        </p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="w-full py-4 px-6 rounded-xl text-base font-bold text-white bg-brand-orange hover:bg-orange-600 shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-wait transition-all flex items-center justify-center gap-2"
      >
        <span>
          {pending ? 'Đang gửi đăng ký…' : 'Gửi đăng ký tham gia Pilot ngay'}
        </span>
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
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </button>

      <p className="text-center text-xs text-slate-400">
        Cam kết bảo mật thông tin doanh nghiệp 100%. Không ràng buộc chi phí khi
        trải nghiệm Pilot.
      </p>
    </form>
  );
}
