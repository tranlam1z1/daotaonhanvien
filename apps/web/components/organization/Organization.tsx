'use client';

import { useEffect, useState } from 'react';
import { dateLabel } from '../platform/platform-data';
import { Button, EmptyState } from '../ui/controls';
import { OrganizationCatalog } from './OrganizationCatalog';
import { ConfigForm, ProfileForm } from './OrganizationForms';
import {
  organizationRequest,
  type OrganizationData,
} from './organization-data';

const sections = [
  { id: 'ho-so-doanh-nghiep', label: 'Hồ sơ doanh nghiệp' },
  { id: 'phong-ban', label: 'Phòng ban' },
  { id: 'chuc-danh', label: 'Chức danh' },
  { id: 'cau-hinh', label: 'Cấu hình' },
  { id: 'thue-bao', label: 'Thông tin thuê bao' },
] as const;

function Subscription({
  subscription,
}: {
  subscription: OrganizationData['subscription'];
}) {
  const { plan, activeAccounts, storageUsedBytes } = subscription;
  const gb = Number(storageUsedBytes) / 1_000_000_000;
  const storage =
    gb > 0 && gb < 0.01
      ? new Intl.NumberFormat('vi-VN', { style: 'unit', unit: 'byte' }).format(
          Number(storageUsedBytes),
        )
      : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(
          gb,
        ) + ' GB';
  const fields = [
    ['Gói thuê bao', plan?.plan.name ?? 'Chưa có gói thuê bao'],
    ['Ngày hết hạn', plan ? dateLabel(plan.endsAt) : '—'],
    [
      'Tài khoản đang kích hoạt / tối đa',
      plan ? activeAccounts + ' / ' + plan.plan.maxAccounts : activeAccounts,
    ],
    [
      'Dung lượng đã dùng',
      plan ? storage + ' / ' + plan.plan.storageGb + ' GB' : storage,
    ],
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 p-4">
          <dt className="text-sm text-slate-600">{label}</dt>
          <dd className="mt-1 break-words font-semibold text-navy-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Organization({ editable }: { editable: boolean }) {
  const [data, setData] = useState<OrganizationData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    organizationRequest<OrganizationData>('', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  function update<K extends keyof OrganizationData>(
    key: K,
    value: OrganizationData[K],
  ) {
    setData((previous) => previous && { ...previous, [key]: value });
  }

  if (!data) {
    if (!error) return <p role="status">Đang tải thông tin doanh nghiệp…</p>;
    return (
      <div className="space-y-4">
        <EmptyState title="Chưa tải được thông tin doanh nghiệp" />
        <Button
          onClick={() => {
            setError(false);
            setAttempt(attempt + 1);
          }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  const content = [
    <ProfileForm
      profile={data.profile}
      editable={editable}
      onChange={(profile) => update('profile', profile)}
    />,
    <OrganizationCatalog
      catalog="departments"
      items={data.departments}
      editable={editable}
      onChange={(items) => update('departments', items)}
    />,
    <OrganizationCatalog
      catalog="positions"
      items={data.positions}
      editable={editable}
      onChange={(items) => update('positions', items)}
    />,
    <ConfigForm
      config={data.config}
      editable={editable}
      onChange={(config) => update('config', config)}
    />,
    <Subscription subscription={data.subscription} />,
  ];

  return (
    <>
      <nav
        aria-label="Mục quản trị doanh nghiệp"
        className="flex flex-wrap gap-2"
      >
        {sections.map(({ id, label }) => (
          <a
            key={id}
            href={'#' + id}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            {label}
          </a>
        ))}
      </nav>
      {sections.map(({ id, label }, index) => (
        <section
          key={id}
          id={id}
          aria-labelledby={id + '-title'}
          className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <h2
            id={id + '-title'}
            className="mb-4 text-lg font-bold text-navy-900"
          >
            {label}
          </h2>
          {content[index]}
        </section>
      ))}
    </>
  );
}
