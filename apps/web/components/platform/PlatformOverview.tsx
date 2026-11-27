'use client';

import { useEffect, useState } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';
import { panel } from '../training/TrainingFields';
import { Button } from '../ui/controls';

type Summary = {
  companies: number;
  activeAccounts: number;
  storageBytes: string;
  expiringSubscriptions: number;
};

type Entry = {
  id: string;
  action: string;
  objectType: string;
  objectId: string | null;
  occurredAt: string;
  user: { fullName: string } | null;
  tenant: { name: string } | null;
};

const actions: Record<string, string> = {
  CREATE_TENANT: 'Tạo doanh nghiệp',
  UPDATE_TENANT: 'Cập nhật doanh nghiệp',
  UPDATE_TENANT_STATUS: 'Đổi trạng thái doanh nghiệp',
  ASSIGN_ROLE: 'Gán vai trò',
  CREATE_PLAN: 'Tạo gói thuê bao',
  UPDATE_PLAN: 'Sửa gói thuê bao',
  ASSIGN_SUBSCRIPTION: 'Gán thuê bao',
  RENEW_SUBSCRIPTION: 'Gia hạn thuê bao',
  RECORD_PAYMENT: 'Ghi nhận thanh toán',
  UPDATE_LEAD: 'Cập nhật đăng ký pilot',
  PUBLISH_TRAINING_TEMPLATE: 'Phát hành bộ mẫu',
  LOGIN: 'Đăng nhập',
};

const date = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

async function load<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl + '/platform' + path, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json() as Promise<T>;
}

export function PlatformOverview() {
  const [summary, setSummary] = useState<Summary>();
  const [items, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      load<Summary>('/summary', abort.signal),
      load<{ items: Entry[]; next: string | null }>('/audit', abort.signal),
    ])
      .then(([nextSummary, audit]) => {
        setSummary(nextSummary);
        setItems(audit.items);
        setCursor(audit.next);
      })
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setBusy(true);
    setError('');
    try {
      const audit = await load<{ items: Entry[]; next: string | null }>(
        '/audit?before=' + cursor,
      );
      setItems((previous) => [...previous, ...audit.items]);
      setCursor(audit.next);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa thể tải nhật ký.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {busy && !summary && <p role="status">Đang tải báo cáo nền tảng…</p>}
      {summary && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Doanh nghiệp', number.format(summary.companies)],
            ['Tài khoản đang kích hoạt', number.format(summary.activeAccounts)],
            [
              'Dung lượng đã dùng',
              number.format(Number(summary.storageBytes) / 1024 ** 3) + ' GB',
            ],
            [
              'Thuê bao hết hạn trong 30 ngày',
              number.format(summary.expiringSubscriptions),
            ],
          ].map(([label, value]) => (
            <div key={label} className={panel}>
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="text-2xl font-semibold text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <section className={panel}>
        <h2 className="text-lg font-semibold text-navy-900">
          Nhật ký quản trị nền tảng
        </h2>
        {!busy && !error && !items.length && <p>Chưa ghi nhận thao tác.</p>}
        <ul className="divide-y divide-slate-200">
          {items.map((entry) => (
            <li key={entry.id} className="space-y-1 break-words py-3 text-sm">
              <p className="font-semibold">
                {actions[entry.action] ?? entry.action}
              </p>
              <p>
                {entry.user?.fullName} ·{' '}
                {date.format(new Date(entry.occurredAt))}
              </p>
              {entry.tenant && (
                <p className="text-slate-600">{entry.tenant.name}</p>
              )}
            </li>
          ))}
        </ul>
        {cursor && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void loadMore()}
          >
            Xem thêm
          </Button>
        )}
      </section>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
