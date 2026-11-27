import type { ComponentProps, ReactNode } from 'react';

const primary = 'bg-brand-blue text-white hover:bg-blue-700';
const secondary =
  'border border-slate-300 bg-white text-navy-900 hover:bg-slate-100';

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      {...props}
      type={type}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${variant === 'primary' ? primary : secondary} ${className}`}
    />
  );
}

export function Input({
  label,
  name,
  id = name,
  ...props
}: ComponentProps<'input'> & { label: string; name: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={name}
        className="block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-navy-900 focus:border-brand-blue"
      />
    </div>
  );
}

export function Table({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: readonly string[];
  children: ReactNode;
}) {
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full text-left text-sm [&_td]:px-4 [&_td]:py-3">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-100 text-navy-900">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      {children && <p className="mt-2 text-sm text-slate-600">{children}</p>}
    </div>
  );
}

export function Toast({
  children,
  error,
  onDismiss,
}: {
  children: ReactNode;
  error?: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-x-3 bottom-4 z-40 ml-auto flex max-w-sm items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p
        role={error ? 'alert' : 'status'}
        className={`grow text-sm ${error ? 'text-red-700' : 'text-teal-900'}`}
      >
        {children}
      </p>
      <Button variant="secondary" onClick={onDismiss}>
        Đóng
      </Button>
    </div>
  );
}
