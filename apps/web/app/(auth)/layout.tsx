import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-soft sm:p-9">
        <Link href="/" className="inline-block text-xl font-bold text-navy-900">
          EduCore<span className="text-brand-blue">36</span>
        </Link>
        {children}
      </section>
    </main>
  );
}
