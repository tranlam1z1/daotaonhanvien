import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | EduCore36',
  description:
    'Khung chính sách xử lý và bảo vệ dữ liệu cá nhân khi đăng ký chương trình Pilot EduCore36.',
  alternates: { canonical: '/chinh-sach-bao-mat' },
  openGraph: {
    title: 'Chính sách bảo mật | EduCore36',
    url: '/chinh-sach-bao-mat',
  },
};

const sections = [
  [
    'Đơn vị xử lý dữ liệu và thông tin liên hệ',
    'Cần bổ sung tên pháp lý, địa chỉ và đầu mối phụ trách bảo vệ dữ liệu cá nhân.',
  ],
  [
    'Dữ liệu thu thập',
    'Thông tin đăng ký gồm họ tên, chức vụ, tên doanh nghiệp, quy mô nhân sự, số điện thoại/Zalo và sự đồng ý xử lý dữ liệu cá nhân.',
  ],
  [
    'Mục đích và phạm vi xử lý',
    'Thông tin đăng ký phục vụ liên hệ tư vấn và sắp xếp chương trình Pilot. Cần bổ sung căn cứ xử lý và phạm vi sử dụng cụ thể.',
  ],
  [
    'Lưu trữ, bảo vệ và chia sẻ dữ liệu',
    'Cần bổ sung thời hạn lưu trữ, biện pháp bảo vệ, bên tiếp nhận dữ liệu và điều kiện chia sẻ.',
  ],
  [
    'Quyền của người đăng ký',
    'Cần bổ sung cách yêu cầu truy cập, chỉnh sửa, xóa dữ liệu, rút lại sự đồng ý và thời hạn giải quyết.',
  ],
  [
    'Hiệu lực và thay đổi chính sách',
    'Cần bổ sung ngày hiệu lực và phương thức thông báo khi chính sách thay đổi.',
  ],
];

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
      <a href="/" className="text-brand-blue underline">
        ← Về trang chủ EduCore36
      </a>
      <h1 className="text-3xl font-extrabold text-navy-900 mt-8">
        Chính sách bảo mật
      </h1>
      <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-slate-700">
        Bản khung đang được hoàn thiện cho chương trình Pilot. Nội dung cần được
        bổ sung và xác nhận trước khi tiếp nhận đăng ký thực tế.
      </p>
      {sections.map(([title, text]) => (
        <section className="mt-8" key={title}>
          <h2 className="text-xl font-bold text-navy-900">{title}</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">{text}</p>
        </section>
      ))}
    </main>
  );
}
