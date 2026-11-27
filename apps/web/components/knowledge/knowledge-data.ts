import { accountError, apiUrl } from '../../lib/account-api';

export type Label = { id: string; name: string };
export type Category = Label & { parentId: string | null };
export type Audience = 'TENANT' | 'DEPARTMENTS' | 'POSITIONS';
export type DraftRow = {
  id: string;
  itemId: string;
  title: string;
  audience: Audience;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  revision: number;
  reviewToken: string | null;
  rejectionReason: string | null;
  canSubmit: boolean;
  canWithdraw: boolean;
  canPublish: boolean;
  canApprove: boolean;
};
export type Attachment = {
  video: boolean;
  file: Label & { contentType: string };
};
export type PublishedArticle = {
  itemId: string;
  title: string;
  summary: string;
};
export type Publication = {
  id: string;
  itemId: string;
  revision: number;
  title: string;
  updatedAt: string;
  status: 'PUBLISHED' | 'ARCHIVED';
};
export type Draft = DraftRow & {
  summary: string;
  bodyHtml: string;
  categoryId: string | null;
  tagIds: string[];
  departmentIds: string[];
  positionIds: string[];
  videoUrl: string | null;
  attachments: Attachment[];
  scopeLabels?: string[];
};
export type EditorData = {
  categories: Category[];
  tags: Label[];
  departments: Label[];
  positions: Label[];
  drafts: DraftRow[];
  pending: DraftRow[];
  manageTaxonomy: boolean;
};

export const audienceLabels: Record<Audience, string> = {
  TENANT: 'Toàn doanh nghiệp',
  DEPARTMENTS: 'Theo phòng ban',
  POSITIONS: 'Theo chức danh',
};

export const inputStyle =
  'block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl + path, {
    ...options,
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json() as Promise<T>;
}

function knowledgeRequest<T>(path: string, method: string, body?: object) {
  return api<T>('/knowledge' + path, {
    method,
    ...(body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

export function editorRequest<T>(path = '', method = 'GET', body?: object) {
  return knowledgeRequest<T>('/editor' + path, method, body);
}

export function reviewRequest<T>(path = '', method = 'GET', body?: object) {
  return knowledgeRequest<T>('/reviews' + path, method, body);
}

export function rejectionRequest<T>(signal: AbortSignal) {
  return api<T>('/knowledge/rejections', { signal });
}

export function readerRequest<T>(path = '', signal?: AbortSignal) {
  return api<T>('/knowledge/read' + path, { signal, cache: 'no-store' });
}

export function uploadKnowledgeFile(file: File, departmentId?: string) {
  const body = new FormData();
  body.set('file', file);
  return api<Attachment['file']>(
    '/files' +
      (departmentId ? '?departmentId=' + encodeURIComponent(departmentId) : ''),
    { method: 'POST', body },
  );
}

export function categoryPaths(categories: Category[]) {
  const known = new Map(categories.map((category) => [category.id, category]));
  return categories
    .map((category) => {
      const parts = [category.name];
      const seen = new Set([category.id]);
      let parent = category.parentId;
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const entry = known.get(parent);
        if (!entry) break;
        parts.unshift(entry.name);
        parent = entry.parentId;
      }
      return { ...category, label: parts.join(' / ') };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}
