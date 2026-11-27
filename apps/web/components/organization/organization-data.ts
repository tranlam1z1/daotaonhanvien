import { accountError, apiUrl } from '../../lib/account-api';

export type CompanyProfile = {
  name: string;
  logo: string | null;
  address: string | null;
  taxCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
};

export type CompanyConfig = {
  selfApproval: boolean;
  reminderDays: number;
  handoverDays: number | null;
  completion: {
    lessonRequired: boolean;
    lessonPercent: number;
    finalScoreRequired: boolean;
    finalScorePercent: number;
    attemptLimitEnabled: boolean;
    maxAttempts: number;
    practiceRequired: boolean;
  };
};

export type CatalogItem = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  parentId?: string | null;
};

export type OrganizationData = {
  profile: CompanyProfile;
  config: CompanyConfig;
  departments: CatalogItem[];
  positions: CatalogItem[];
  subscription: {
    plan: {
      endsAt: string;
      plan: { name: string; maxAccounts: number; storageGb: number };
    } | null;
    activeAccounts: number;
    storageUsedBytes: string;
  };
};

export async function organizationRequest<T>(
  route = '',
  options?:
    { method: 'PATCH' | 'POST'; body: object } | { signal: AbortSignal },
): Promise<T> {
  const mutation = options && 'method' in options ? options : undefined;
  const response = await fetch(apiUrl + '/organization' + route, {
    method: mutation?.method,
    headers: mutation && { 'Content-Type': 'application/json' },
    body: mutation && JSON.stringify(mutation.body),
    signal: options && 'signal' in options ? options.signal : undefined,
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json();
}
