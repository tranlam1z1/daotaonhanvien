import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input } from '../ui/controls';
import {
  organizationRequest,
  type CompanyConfig,
  type CompanyProfile,
} from './organization-data';

export function OrganizationForm({
  children,
  onSave,
  editable,
}: {
  children: ReactNode;
  onSave: (form: FormData) => Promise<void>;
  editable: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setNotice(undefined);
    try {
      await onSave(form);
      setNotice({ text: 'Đã lưu thay đổi.', error: false });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Chưa thể lưu thay đổi.',
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <fieldset disabled={pending || !editable} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
      {editable && (
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
      )}
      {notice && (
        <p
          role={notice.error ? 'alert' : 'status'}
          className={
            notice.error ? 'text-sm text-red-700' : 'text-sm text-teal-800'
          }
        >
          {notice.text}
        </p>
      )}
    </form>
  );
}

const profileFields = [
  { name: 'name', label: 'Tên doanh nghiệp', maxLength: 300, required: true },
  { name: 'taxCode', label: 'Mã số thuế', maxLength: 30 },
  { name: 'contactName', label: 'Người liên hệ', maxLength: 200 },
  {
    name: 'contactPhone',
    label: 'Số điện thoại liên hệ',
    maxLength: 30,
    type: 'tel',
  },
  { name: 'address', label: 'Địa chỉ', maxLength: 500 },
  {
    name: 'logo',
    label: 'Đường dẫn logo (HTTPS)',
    maxLength: 2048,
    type: 'url',
  },
] satisfies {
  name: keyof CompanyProfile;
  label: string;
  maxLength: number;
  required?: boolean;
  type?: string;
}[];

export function ProfileForm({
  profile,
  editable,
  onChange,
}: {
  profile: CompanyProfile;
  editable: boolean;
  onChange: (profile: CompanyProfile) => void;
}) {
  return (
    <>
      {profile.logo && (
        <img
          src={profile.logo}
          alt="Logo doanh nghiệp"
          referrerPolicy="no-referrer"
          className="mb-5 h-20 w-20 rounded-lg border border-slate-200 object-contain"
        />
      )}
      <OrganizationForm
        editable={editable}
        onSave={async (form) => {
          onChange(
            await organizationRequest('/profile', {
              method: 'PATCH',
              body: Object.fromEntries(form),
            }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {profileFields.map((field) => (
            <Input
              key={field.name}
              {...field}
              defaultValue={profile[field.name] ?? ''}
            />
          ))}
        </div>
      </OrganizationForm>
    </>
  );
}

function Toggle({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-navy-900">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="size-4 shrink-0 accent-brand-blue"
      />
      {label}
    </label>
  );
}

const criteria = [
  {
    flag: 'lessonRequired',
    value: 'lessonPercent',
    label: 'Yêu cầu hoàn thành bài học',
    inputLabel: 'Tỷ lệ bài học hoàn thành (%)',
    min: 0,
    max: 100,
  },
  {
    flag: 'finalScoreRequired',
    value: 'finalScorePercent',
    label: 'Yêu cầu điểm kiểm tra cuối khóa',
    inputLabel: 'Điểm tối thiểu (%)',
    min: 0,
    max: 100,
  },
  {
    flag: 'attemptLimitEnabled',
    value: 'maxAttempts',
    label: 'Giới hạn số lần làm bài',
    inputLabel: 'Số lần làm tối đa',
    min: 1,
    max: 2147483647,
  },
] as const;

export function ConfigForm({
  config,
  editable,
  onChange,
}: {
  config: CompanyConfig;
  editable: boolean;
  onChange: (config: CompanyConfig) => void;
}) {
  return (
    <OrganizationForm
      editable={editable}
      onSave={async (form) => {
        onChange(
          await organizationRequest('/config', {
            method: 'PATCH',
            body: {
              selfApproval: form.has('selfApproval'),
              reminderDays: Number(form.get('reminderDays')),
              handoverDays:
                form.get('handoverDays') === ''
                  ? null
                  : Number(form.get('handoverDays')),
              completion: {
                lessonRequired: form.has('lessonRequired'),
                lessonPercent: Number(form.get('lessonPercent')),
                finalScoreRequired: form.has('finalScoreRequired'),
                finalScorePercent: Number(form.get('finalScorePercent')),
                attemptLimitEnabled: form.has('attemptLimitEnabled'),
                maxAttempts: Number(form.get('maxAttempts')),
                practiceRequired: form.has('practiceRequired'),
              },
            },
          }),
        );
      }}
    >
      <Toggle
        name="selfApproval"
        label="Cho phép tự phê duyệt nội dung"
        checked={config.selfApproval}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="reminderDays"
          label="Số ngày nhắc trước hạn"
          type="number"
          min={0}
          max={2147483647}
          required
          defaultValue={config.reminderDays}
        />
        <div>
          <Input
            name="handoverDays"
            label="Số ngày bàn giao mặc định"
            type="number"
            min={0}
            max={2147483647}
            aria-describedby="handover-help"
            defaultValue={config.handoverDays ?? ''}
          />
          <p id="handover-help" className="mt-1 text-sm text-slate-600">
            Để trống để dùng ngày nghỉ việc làm hạn bàn giao.
          </p>
        </div>
      </div>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 font-semibold text-navy-900">
          Tiêu chí mặc định cho khóa học mới
        </legend>
        {criteria.map(({ flag, value, label, inputLabel, min, max }) => (
          <div
            key={flag}
            className="grid gap-1 sm:grid-cols-2 sm:items-end sm:gap-4"
          >
            <Toggle
              name={flag}
              label={label}
              checked={config.completion[flag]}
            />
            <Input
              name={value}
              label={inputLabel}
              type="number"
              min={min}
              max={max}
              required
              defaultValue={config.completion[value]}
            />
          </div>
        ))}
        <Toggle
          name="practiceRequired"
          label="Yêu cầu quản lý trực tiếp xác nhận thực hành"
          checked={config.completion.practiceRequired}
        />
      </fieldset>
    </OrganizationForm>
  );
}
