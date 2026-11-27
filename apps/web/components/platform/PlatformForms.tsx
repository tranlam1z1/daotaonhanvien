'use client';

import type { ComponentProps, FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../ui/controls';
import { message } from './platform-data';

const fieldStyle =
  'block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-navy-900';

type FieldProps = { label: string; name: string };

export function SelectField({
  label,
  children,
  ...props
}: ComponentProps<'select'> & FieldProps) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      <select className={fieldStyle} {...props}>
        {children}
      </select>
    </label>
  );
}

export function NotesField({
  label,
  ...props
}: ComponentProps<'textarea'> & FieldProps) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      <textarea className={fieldStyle} rows={3} maxLength={4000} {...props} />
    </label>
  );
}

export function Options({ labels }: { labels: Record<string, string> }) {
  return Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

export function PlatformPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

export function RequestState({ error }: { error?: string }) {
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={error ? 'text-red-700' : 'text-slate-600'}
    >
      {error ?? 'Đang tải…'}
    </p>
  );
}

export function SaveForm({
  label,
  onSave,
  onCancel,
  children,
}: {
  label: string;
  onSave: (data: Record<string, FormDataEntryValue>) => Promise<void>;
  onCancel?: () => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await onSave(Object.fromEntries(new FormData(event.currentTarget)));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : label}
        </Button>
        {onCancel && (
          <Button variant="secondary" disabled={pending} onClick={onCancel}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}
