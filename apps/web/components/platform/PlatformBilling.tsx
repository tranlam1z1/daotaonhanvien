'use client';

import { useState } from 'react';
import { Button, EmptyState, Input, Table } from '../ui/controls';
import {
  NotesField,
  RequestState,
  SaveForm,
  SelectField,
} from './PlatformForms';
import {
  dateLabel,
  moneyLabel,
  platformRequest,
  usePlatformData,
  type Plan,
  type Subscription,
} from './platform-data';

function subscriptionStatus(subscription: Subscription) {
  if (subscription.status === 'CANCELLED') return 'Đã thay thế';
  const now = Date.now();
  if (
    subscription.status === 'EXPIRED' ||
    Date.parse(subscription.endsAt) < now
  )
    return 'Hết hạn';
  if (Date.parse(subscription.startsAt) > now) return 'Chưa bắt đầu';
  return 'Đang hiệu lực';
}

export function PlatformBilling({
  id,
  plans,
  onSaved,
}: {
  id: string;
  plans: Plan[];
  onSaved: (text: string) => void;
}) {
  const path = 'companies/' + id + '/subscriptions';
  const subscriptions = usePlatformData<Subscription[]>(path);
  const [editor, setEditor] = useState<
    { kind: 'assign' } | { kind: 'renew' | 'payment'; id: string }
  >();
  const current = subscriptions.data?.find((row) => row.status === 'ACTIVE');

  async function save(
    url: string,
    method: string,
    data: object,
    notice: string,
  ) {
    await platformRequest(url, method, data);
    setEditor(undefined);
    subscriptions.refresh();
    onSaved(notice);
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <h3 className="font-bold">Thuê bao và thanh toán</h3>
      <Button
        onClick={() => setEditor({ kind: 'assign' })}
        disabled={!plans.length}
      >
        {current ? 'Đổi gói thuê bao' : 'Gán gói thuê bao'}
      </Button>
      {!plans.length && (
        <p className="text-sm text-slate-600">
          Tạo một gói trong danh mục trước khi gán.
        </p>
      )}
      {editor?.kind === 'assign' && (
        <SaveForm
          label={current ? 'Xác nhận đổi gói' : 'Lưu thuê bao'}
          onCancel={() => setEditor(undefined)}
          onSave={(data) => save(path, 'POST', data, 'Đã lưu thuê bao.')}
        >
          {current && (
            <p className="text-sm text-slate-700">
              Thuê bao hiện tại sẽ chuyển sang lịch sử ngay khi lưu.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Gói thuê bao"
              name="planId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Chọn gói
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </SelectField>
            <Input label="Ngày bắt đầu" name="startsAt" type="date" required />
            <Input label="Ngày kết thúc" name="endsAt" type="date" required />
          </div>
        </SaveForm>
      )}
      {!subscriptions.data ? (
        <RequestState error={subscriptions.error} />
      ) : subscriptions.data.length ? (
        <ul className="space-y-3">
          {subscriptions.data.map((row) => (
            <li
              key={row.id}
              className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0 break-words">
                  <p className="font-semibold">
                    {row.plan.name} · {subscriptionStatus(row)}
                  </p>
                  <p className="text-sm text-slate-700">
                    {dateLabel(row.startsAt)} – {dateLabel(row.endsAt)}
                  </p>
                  <p className="text-sm text-slate-700">
                    Tài khoản tính phí đã ghi nhận: {row.billableAccounts}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status !== 'CANCELLED' &&
                    (!current || current.id === row.id) && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditor({ kind: 'renew', id: row.id })}
                      >
                        Gia hạn
                      </Button>
                    )}
                  <Button
                    variant="secondary"
                    onClick={() => setEditor({ kind: 'payment', id: row.id })}
                  >
                    Ghi nhận thanh toán
                  </Button>
                </div>
              </div>
              {editor?.kind === 'renew' && editor.id === row.id && (
                <SaveForm
                  label="Lưu gia hạn"
                  onCancel={() => setEditor(undefined)}
                  onSave={(data) =>
                    save(
                      path + '/' + row.id,
                      'PATCH',
                      data,
                      'Đã gia hạn thuê bao.',
                    )
                  }
                >
                  <Input
                    label="Ngày kết thúc mới"
                    name="endsAt"
                    type="date"
                    required
                  />
                </SaveForm>
              )}
              {editor?.kind === 'payment' && editor.id === row.id && (
                <SaveForm
                  label="Lưu thanh toán"
                  onCancel={() => setEditor(undefined)}
                  onSave={(data) =>
                    save(
                      path + '/' + row.id + '/payments',
                      'POST',
                      data,
                      'Đã ghi nhận thanh toán.',
                    )
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Số tiền (đồng)"
                      name="amount"
                      inputMode="decimal"
                      required
                      pattern="[0-9]{1,16}(?:\.[0-9]{1,2})?"
                    />
                    <Input
                      label="Ngày thanh toán"
                      name="paidAt"
                      type="date"
                      required
                    />
                  </div>
                  <NotesField label="Ghi chú thanh toán" name="notes" />
                </SaveForm>
              )}
              {row.payments.length ? (
                <Table
                  caption={'Thanh toán cho gói ' + row.plan.name}
                  headers={['Số tiền', 'Ngày thanh toán', 'Ghi chú']}
                >
                  {row.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap">
                        {moneyLabel(payment.amount)}
                      </td>
                      <td>{dateLabel(payment.paidAt)}</td>
                      <td className="min-w-24 whitespace-pre-wrap break-all">
                        {payment.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="text-sm text-slate-600">
                  Chưa ghi nhận thanh toán.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Chưa gán gói thuê bao" />
      )}
    </div>
  );
}
