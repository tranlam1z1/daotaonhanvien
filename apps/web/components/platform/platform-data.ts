'use client';

import { useEffect, useState } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';

export const companyStatus = { ACTIVE: 'Hoạt động', SUSPENDED: 'Tạm ngừng' };
export const leadStatus = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  DEMOED: 'Đã demo',
  PILOT: 'Tham gia pilot',
  NOT_SUITABLE: 'Không phù hợp',
};
export const planCycles = { MONTHLY: 'Theo tháng', YEARLY: 'Theo năm' };

export type Company = {
  id: string;
  name: string;
  loginCode: string;
  taxCode: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: keyof typeof companyStatus;
  canInvite: boolean;
};
export type Plan = {
  id: string;
  name: string;
  maxAccounts: number;
  storageGb: number;
  price: `${number}`;
  cycle: keyof typeof planCycles;
};
export type Lead = {
  id: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  companySize: string;
  phone: string;
  status: keyof typeof leadStatus;
  notes: string | null;
  assigneeId: string | null;
  tenantId: string | null;
  submittedAt: string;
};
export type Staff = { id: string; fullName: string };
export type Subscription = {
  id: string;
  startsAt: string;
  endsAt: string;
  billableAccounts: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  plan: Pick<Plan, 'id' | 'name'>;
  payments: {
    id: string;
    amount: `${number}`;
    paidAt: string;
    notes: string | null;
  }[];
};

export async function platformRequest<T>(
  path: string,
  method = 'GET',
  data?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(apiUrl + '/platform/' + path, {
    method,
    credentials: 'include',
    headers: data && { 'Content-Type': 'application/json' },
    body: data && JSON.stringify(data),
    signal,
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json();
}

export function usePlatformData<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    const request = new AbortController();
    void platformRequest<T>(path, 'GET', undefined, request.signal).then(
      (data) => {
        if (!request.signal.aborted) setResult({ path, data });
      },
      (error: unknown) => {
        if (!request.signal.aborted) setResult({ path, error: message(error) });
      },
    );
    return () => request.abort();
  }, [path, version]);
  return {
    ...(result?.path === path ? result : {}),
    refresh: () => setVersion((value) => value + 1),
  };
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi khi xử lý yêu cầu.';
}

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

export const moneyLabel = (value: `${number}`) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 2,
  }).format(value);
