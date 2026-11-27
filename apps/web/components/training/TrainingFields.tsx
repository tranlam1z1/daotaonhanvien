import type { ComponentProps, ReactNode } from 'react';
import { inputStyle } from '../knowledge/knowledge-data';
import { Button } from '../ui/controls';
import type { Editor, TemplateSource } from './training-data';

export const panel =
  'min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5';

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-navy-900">
      {label}
      {children}
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: ComponentProps<'select'> & { label: string }) {
  return (
    <Field label={label}>
      <select className={inputStyle} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function TextArea({
  label,
  ...props
}: ComponentProps<'textarea'> & { label: string }) {
  return (
    <Field label={label}>
      <textarea className={inputStyle} rows={3} {...props} />
    </Field>
  );
}

export function Scope({
  catalog,
  value,
  disabled,
  onChange,
}: {
  catalog: Editor;
  value: string | null;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  const inactive = value && !catalog.departments.some(({ id }) => id === value);
  return (
    <Select
      label="Phạm vi soạn thảo"
      value={value ?? ''}
      required={!catalog.tenantWide}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="" disabled={!catalog.tenantWide}>
        {catalog.tenantWide ? 'Toàn doanh nghiệp' : 'Chọn phòng ban'}
      </option>
      {inactive && <option value={value}>Phòng ban ngừng hoạt động</option>}
      {catalog.departments.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </Select>
  );
}

export function SubmitActions({
  label,
  onCancel,
}: {
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit">{label}</Button>
      <Button variant="secondary" onClick={onCancel}>
        Đóng biểu mẫu
      </Button>
    </div>
  );
}

export function TemplateSourceLabel({
  source,
}: {
  source?: TemplateSource | null;
}) {
  if (!source) return null;
  return (
    <p className="break-words text-sm text-slate-600">
      {source.customized ? 'Đã tùy chỉnh' : 'Từ bộ mẫu'} · Phiên bản gốc{' '}
      {source.sourceVersion}
    </p>
  );
}
