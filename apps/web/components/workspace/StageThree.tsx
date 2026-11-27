'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { accountError, apiUrl } from '../../lib/account-api';
import { useAccount } from './WorkspaceShell';

const inputStyle =
  'min-h-11 min-w-0 rounded border border-slate-300 bg-white p-2';
const buttonStyle =
  'min-h-11 rounded bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-60';
const cardStyle =
  'min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4';
const date = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});
const formatDate = (value: string) => date.format(new Date(value));

async function stageRequest<T>(
  path: string,
  body?: object,
  method = 'POST',
): Promise<T> {
  const response = await fetch(apiUrl + path, {
    credentials: 'include',
    ...(body && {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json() as Promise<T>;
}

const categories: Record<string, string> = {
  WORK: 'Công việc',
  DOCUMENT: 'Tài liệu',
  TOOL: 'Tài khoản / công cụ',
  CONTACT: 'Đầu mối liên hệ',
  EXPERIENCE: 'Kinh nghiệm và lưu ý',
};
const statuses: Record<string, string> = {
  DRAFT: 'Đang lập',
  RECEIVING: 'Chờ tiếp nhận',
  REVISION: 'Cần bổ sung',
  REVIEW: 'Chờ quản lý xác nhận',
  COMPLETED: 'Hoàn tất',
  PENDING: 'Chờ nhận',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Đã từ chối',
  NOT_STARTED: 'Chưa học',
  IN_PROGRESS: 'Đang học',
  OVERDUE: 'Quá hạn',
  FAILED: 'Chưa đạt',
  CANCELLED: 'Đã hủy',
};

type DraftItem = {
  files?: { id: string; name: string }[];
  category: string;
  title: string;
  description: string;
  recipientId: string;
};
type Handover = {
  id: string;
  employeeId: string;
  departureOn: string;
  dueOn: string;
  status: string;
  employee: { id: string; fullName: string };
  canPrepare: boolean;
  canComplete: boolean;
  explanation?: string;
  substituteId?: string;
  substituteReason?: string;
  reviewReason?: string;
  appendices?: { userId: string; text: string; createdAt: string }[];
  items: (DraftItem & {
    id: string;
    status: string;
    reason: string;
    draftId?: string;
  })[];
};
type Directory = {
  cases: Handover[];
  people: { id: string; fullName: string; canStart: boolean }[];
};

function HandoverCard({
  record,
  people,
  busy,
  action,
}: {
  record: Handover;
  people: Directory['people'];
  busy: boolean;
  action: (name: string, body?: object) => void;
}) {
  const account = useAccount();
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<(DraftItem & { key: string })[]>(() =>
    record.items
      .filter(({ status }) => status !== 'ACCEPTED')
      .map((item) => ({ ...item, key: item.id })),
  );
  const editable =
    record.canPrepare && ['DRAFT', 'REVISION'].includes(record.status);
  const decisions = ['RECEIVING', 'REVISION'].includes(record.status);
  const reviewer = record.canComplete && record.status === 'REVIEW';
  const editor = account.permissions.some(
    ({ permission }) => permission === 'content.edit',
  );
  const names = new Map(people.map(({ id, fullName }) => [id, fullName]));
  function textAction(
    event: FormEvent<HTMLFormElement>,
    name: string,
    key: string,
    itemId?: string,
  ) {
    event.preventDefault();
    action(name, {
      [key]: new FormData(event.currentTarget).get(key),
      ...(itemId && { itemId }),
    });
  }
  return (
    <article className={cardStyle}>
      <h2 className="break-words text-lg font-bold">
        {record.employee.fullName}
      </h2>
      <p>
        {statuses[record.status]} · Nghỉ việc {formatDate(record.departureOn)} ·
        Hạn {formatDate(record.dueOn)}
      </p>
      {record.substituteReason && (
        <p className="break-words">
          Người lập thay{' '}
          {names.get(record.substituteId ?? '') ?? record.substituteId} ·{' '}
          {record.substituteReason}
        </p>
      )}
      {record.reviewReason && (
        <p className="break-words">Yêu cầu bổ sung · {record.reviewReason}</p>
      )}
      {record.explanation && (
        <p className="break-words">Giải trình · {record.explanation}</p>
      )}
      {record.items.map((item) => (
        <section
          key={item.id}
          className="space-y-2 break-words rounded border border-slate-200 p-3"
        >
          <h3 className="font-semibold">{item.title}</h3>
          <p>
            {categories[item.category]} · {statuses[item.status]}
          </p>
          <p className="whitespace-pre-wrap">{item.description}</p>
          {item.files?.map((file) => (
            <button
              type="button"
              key={file.id}
              className="block min-h-11 text-left text-blue-700 underline"
              onClick={() => {
                setFileError('');
                void stageRequest<{ url: string }>(
                  `/handovers/${record.id}/files/${file.id}`,
                )
                  .then(({ url }) => window.location.assign(url))
                  .catch((error: Error) => setFileError(error.message));
              }}
            >
              Tải {file.name}
            </button>
          ))}
          {names.has(item.recipientId) && (
            <p>Người nhận · {names.get(item.recipientId)}</p>
          )}
          {item.reason && <p>Lý do từ chối · {item.reason}</p>}
          {decisions &&
            item.status === 'PENDING' &&
            item.recipientId === account.id && (
              <>
                <button
                  className={buttonStyle}
                  disabled={busy}
                  onClick={() => action('accept', { itemId: item.id })}
                >
                  Tiếp nhận
                </button>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) =>
                    textAction(event, 'reject', 'reason', item.id)
                  }
                >
                  <input
                    className={inputStyle}
                    name="reason"
                    aria-label="Lý do từ chối"
                    placeholder="Lý do từ chối"
                    maxLength={500}
                    required
                  />
                  <button className={buttonStyle} disabled={busy}>
                    Từ chối
                  </button>
                </form>
              </>
            )}
          {record.canComplete &&
            editor &&
            item.category === 'EXPERIENCE' &&
            item.status === 'ACCEPTED' &&
            (item.draftId ? (
              <a className="text-blue-700 underline" href="/ung-dung/noi-dung">
                Xem bản nháp trong kho tri thức
              </a>
            ) : (
              <button
                className={buttonStyle}
                disabled={busy}
                onClick={() => action('draft', { itemId: item.id })}
              >
                Chuyển thành bản nháp tri thức
              </button>
            ))}
        </section>
      ))}
      {editable && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            action('submit', {
              items: items.map((item) => ({
                ...item,
                fileIds: item.files?.map(({ id }) => id) ?? [],
              })),
              explanation: fields.get('explanation'),
              substituteReason: fields.get('substituteReason'),
            });
          }}
        >
          {account.id !== record.employeeId && (
            <label className="grid gap-1">
              Lý do lập thay
              <input
                className={inputStyle}
                name="substituteReason"
                defaultValue={record.substituteReason}
                required
                maxLength={500}
              />
            </label>
          )}
          {items.map((item, index) => {
            const set = (changes: Partial<DraftItem>) =>
              setItems((current) =>
                current.map((entry, position) =>
                  position === index ? { ...entry, ...changes } : entry,
                ),
              );
            return (
              <fieldset
                key={item.key}
                className="grid gap-2 rounded border border-slate-200 p-3"
              >
                <legend>Hạng mục {index + 1}</legend>
                <label className="grid gap-1">
                  Thêm tệp đính kèm
                  <input
                    type="file"
                    className={inputStyle}
                    disabled={uploading || (item.files?.length ?? 0) >= 10}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      const body = new FormData();
                      body.set('file', file);
                      setFileError('');
                      setUploading(true);
                      void fetch(apiUrl + `/files/handover/${record.id}`, {
                        method: 'POST',
                        credentials: 'include',
                        body,
                      })
                        .then(async (response) => {
                          if (!response.ok)
                            throw new Error(await accountError(response));
                          const saved = (await response.json()) as {
                            id: string;
                            name: string;
                          };
                          setItems((current) =>
                            current.map((entry) =>
                              entry.key === item.key
                                ? {
                                    ...entry,
                                    files: [...(entry.files ?? []), saved],
                                  }
                                : entry,
                            ),
                          );
                        })
                        .catch((error: Error) => setFileError(error.message))
                        .finally(() => setUploading(false));
                    }}
                  />
                </label>
                {item.files?.map((file) => (
                  <button
                    type="button"
                    key={file.id}
                    className="min-h-11 text-left text-red-700"
                    onClick={() =>
                      set({
                        files: item.files?.filter(({ id }) => id !== file.id),
                      })
                    }
                  >
                    Gỡ {file.name}
                  </button>
                ))}
                <label className="grid gap-1">
                  Loại
                  <select
                    className={inputStyle}
                    value={item.category}
                    onChange={({ target }) => set({ category: target.value })}
                  >
                    {Object.entries(categories).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  Tiêu đề
                  <input
                    className={inputStyle}
                    required
                    maxLength={160}
                    value={item.title}
                    onChange={({ target }) => set({ title: target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  Mô tả
                  <textarea
                    className={inputStyle}
                    required
                    maxLength={10000}
                    value={item.description}
                    onChange={({ target }) =>
                      set({ description: target.value })
                    }
                  />
                </label>
                <label className="grid gap-1">
                  Người nhận
                  <select
                    className={inputStyle}
                    required
                    value={item.recipientId}
                    onChange={({ target }) =>
                      set({ recipientId: target.value })
                    }
                  >
                    <option value="">Chọn nhân viên</option>
                    {people
                      .filter(({ id }) => id !== record.employeeId)
                      .map(({ id, fullName }) => (
                        <option key={id} value={id}>
                          {fullName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="min-h-11 text-left text-red-700"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  Xóa hạng mục
                </button>
              </fieldset>
            );
          })}
          {!items.length &&
            !record.items.some(({ status }) => status === 'ACCEPTED') && (
              <label className="grid gap-1">
                Giải trình vì sao không có hạng mục bàn giao
                <textarea
                  className={inputStyle}
                  name="explanation"
                  defaultValue={record.explanation}
                  required
                  maxLength={1000}
                />
              </label>
            )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonStyle}
              disabled={busy || items.length === 100}
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    category: 'WORK',
                    title: '',
                    description: '',
                    recipientId: '',
                  },
                ])
              }
            >
              Thêm hạng mục
            </button>
            <button className={buttonStyle} disabled={busy || uploading}>
              Gửi hồ sơ
            </button>
          </div>
        </form>
      )}
      {reviewer && (
        <>
          <button
            className={buttonStyle}
            disabled={busy}
            onClick={() => action('complete')}
          >
            Xác nhận hoàn tất
          </button>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => textAction(event, 'revise', 'reason')}
          >
            <input
              className={inputStyle}
              name="reason"
              required
              maxLength={500}
              aria-label="Nội dung cần bổ sung"
              placeholder="Nội dung cần bổ sung"
            />
            <button className={buttonStyle} disabled={busy}>
              Yêu cầu bổ sung
            </button>
          </form>
        </>
      )}
      {record.appendices?.map((entry, index) => (
        <p key={index} className="break-words">
          {formatDate(entry.createdAt)} ·{' '}
          {names.get(entry.userId) ?? entry.userId} · {entry.text}
        </p>
      ))}
      {record.canComplete && record.status === 'COMPLETED' && (
        <form
          className="grid gap-2"
          onSubmit={(event) => textAction(event, 'append', 'text')}
        >
          <label className="grid gap-1">
            Phụ lục
            <textarea
              className={inputStyle}
              name="text"
              required
              maxLength={5000}
            />
          </label>
          <button className={buttonStyle} disabled={busy}>
            Lưu phụ lục
          </button>
        </form>
      )}
      {fileError && (
        <p role="alert" className="text-red-700">
          {fileError}
        </p>
      )}
    </article>
  );
}

export function Handovers() {
  const [data, setData] = useState<Directory>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void stageRequest<Directory>('/handovers')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function mutate(path: string, body: object) {
    setBusy(true);
    setError('');
    try {
      await stageRequest(path, body);
      setData(await stageRequest<Directory>('/handovers'));
      setRefresh((value) => value + 1);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const candidates =
    data?.people.filter(
      ({ id, canStart }) =>
        canStart &&
        !data.cases.some(
          ({ employeeId, status }) =>
            id === employeeId && status !== 'COMPLETED',
        ),
    ) ?? [];
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Đang tải hồ sơ…</p>}
      {candidates.length > 0 && (
        <form
          className={cardStyle}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            void mutate(`/employees/${fields.get('employeeId')}/handover`, {
              departureOn: fields.get('departureOn'),
            });
          }}
        >
          <h2 className="font-semibold">Đánh dấu nghỉ việc</h2>
          <label className="grid gap-1">
            Nhân viên
            <select className={inputStyle} name="employeeId" required>
              <option value="">Chọn nhân viên</option>
              {candidates.map(({ id, fullName }) => (
                <option key={id} value={id}>
                  {fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Ngày nghỉ việc
            <input
              className={inputStyle}
              name="departureOn"
              type="date"
              required
            />
          </label>
          <button className={buttonStyle} disabled={busy}>
            Tạo hồ sơ bàn giao
          </button>
        </form>
      )}
      {data && !data.cases.length && <p>Chưa có hồ sơ bàn giao.</p>}
      {data?.cases.map((record) => (
        <HandoverCard
          key={`${record.id}-${refresh}`}
          record={record}
          people={data.people}
          busy={busy}
          action={(name, body = {}) =>
            void mutate(`/handovers/${record.id}/actions/${name}`, body)
          }
        />
      ))}
    </div>
  );
}

type Notice = {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};
export function WorkspaceNotices() {
  const [items, setItems] = useState<Notice[]>([]);
  const [muted, setMuted] = useState<string[]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.all([
      stageRequest<Notice[]>('/notices'),
      stageRequest<string[]>('/notices/preferences'),
    ])
      .then(([notices, preferences]) => {
        if (active) {
          setItems(notices);
          setMuted(preferences);
        }
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function read(id: string) {
    try {
      await stageRequest(`/notices/${id}/read`, {});
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const enabled = new FormData(event.currentTarget).getAll('emailGroup');
    try {
      setMuted(
        await stageRequest<string[]>(
          '/notices/preferences',
          ['training', 'content', 'subscription'].filter(
            (group) => !enabled.includes(group),
          ),
          'PATCH',
        ),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {muted && !items.length && <p>Chưa có thông báo.</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 break-words py-3">
              <p
                className={`whitespace-pre-wrap ${item.readAt ? '' : 'font-semibold'}`}
              >
                {item.message}
              </p>
              <p className="text-sm text-slate-600">
                {formatDate(item.createdAt)}
              </p>
              {!item.readAt && (
                <button
                  className="min-h-11 text-blue-700 underline"
                  onClick={() => void read(item.id)}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {muted && (
        <details className="mt-4 border-t border-slate-200 pt-3">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Tùy chọn email
          </summary>
          <form
            onSubmit={(event) => void savePreferences(event)}
            className="grid gap-2"
          >
            {Object.entries({
              training: 'Đào tạo',
              content: 'Nội dung',
              subscription: 'Thuê bao',
            }).map(([group, label]) => (
              <label key={group} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name="emailGroup"
                  value={group}
                  defaultChecked={!muted.includes(group)}
                />
                {label}
              </label>
            ))}
            <p className="text-sm text-slate-600">
              Email bàn giao và quá hạn luôn được gửi.
            </p>
            <button className={buttonStyle} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu tùy chọn'}
            </button>
          </form>
        </details>
      )}
    </>
  );
}

type TrainingReport = {
  summary: {
    activeLearners: number;
    completionRate: number;
    overdue: number;
    pending: number;
    openHandovers: number;
  };
  rows: {
    id: string;
    userId: string;
    courseId: string;
    programId: string | null;
    status: string;
    progressPercent: number;
    completedLate: boolean;
    dueAt: string;
    user: { fullName: string; department: { name: string } | null };
    course: { name: string };
    program: { name: string } | null;
  }[];
  cases: {
    id: string;
    employee: { fullName: string };
    dueOn: string;
    status: string;
  }[];
  groups: Record<
    string,
    { id: string; name: string; totals: Record<string, number> }[]
  >;
  quiz: {
    attempts: number;
    average: number;
    passRate: number;
    questions: { prompt: string; wrongRate: number }[];
  };
  surveys: {
    course: string;
    ratings: Record<string, number>;
    feedback: string;
  }[];
  filters: {
    departments: { id: string; name: string }[];
    courses: { id: string; name: string }[];
    programs: { id: string; name: string }[];
    employees: { id: string; name: string }[];
  };
};

export function TrainingReports({
  summaryOnly = false,
}: {
  summaryOnly?: boolean;
}) {
  const [data, setData] = useState<TrainingReport>();
  const [query, setQuery] = useState('');
  const [loadedQuery, setLoadedQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void stageRequest<TrainingReport>('/reports' + query)
      .then((result) => {
        if (active) {
          setData(result);
          setLoadedQuery(query);
        }
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [query]);
  if (!data)
    return (
      <p role={error ? 'alert' : 'status'}>{error || 'Đang tải báo cáo…'}</p>
    );
  const { summary } = data;
  return (
    <div className="space-y-4">
      {!summaryOnly && (
        <form
          className={`${cardStyle} grid gap-2 sm:grid-cols-2`}
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            const fields = new URLSearchParams();
            new FormData(event.currentTarget).forEach((value, key) => {
              if (value) fields.set(key, String(value));
            });
            setQuery(fields.size ? '?' + fields.toString() : '');
          }}
        >
          {(
            [
              ['departmentId', 'Phòng ban', 'departments'],
              ['courseId', 'Khóa học', 'courses'],
              ['programId', 'Chương trình', 'programs'],
              ['employeeId', 'Nhân viên', 'employees'],
            ] as const
          ).map(([name, label, key]) => (
            <label key={name} className="grid gap-1">
              {label}
              <select name={name} className={inputStyle}>
                <option value="">Tất cả</option>
                {data.filters[key].map(({ id, name: title }) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="grid gap-1">
            Từ ngày
            <input type="date" className={inputStyle} name="from" />
          </label>
          <label className="grid gap-1">
            Đến ngày
            <input type="date" className={inputStyle} name="to" />
          </label>
          <button className={buttonStyle}>Áp dụng bộ lọc</button>
          <a
            className="inline-flex min-h-11 items-center text-blue-700 underline"
            href={apiUrl + '/reports/export' + loadedQuery}
          >
            Xuất Excel
          </a>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Nhân viên đang học', summary.activeLearners],
          ['Tỷ lệ hoàn thành', `${summary.completionRate}%`],
          ['Lượt học quá hạn', summary.overdue],
          ['Nội dung chờ duyệt', summary.pending],
          ['Hồ sơ bàn giao đang mở', summary.openHandovers],
        ].map(([label, value]) => (
          <div key={label} className={cardStyle}>
            <dt>{label}</dt>
            <dd className="text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {!summaryOnly && (
        <>
          {Object.entries({
            courses: 'Tiến độ theo khóa học',
            programs: 'Tiến độ theo chương trình',
            departments: 'Tiến độ theo phòng ban',
            employees: 'Tiến độ theo nhân viên',
          }).map(([key, title]) => (
            <section key={key} className={cardStyle}>
              <h2 className="font-bold">{title}</h2>
              {data.groups[key].map(({ id, name, totals }) => (
                <p key={id} className="break-words">
                  {name} · Được giao{' '}
                  {Object.values(totals).reduce((sum, value) => sum + value, 0)}{' '}
                  ·{' '}
                  {Object.entries(totals)
                    .map(([status, value]) => `${statuses[status]} ${value}`)
                    .join(' · ')}
                </p>
              ))}
            </section>
          ))}
          <section className={cardStyle}>
            <h2 className="font-bold">Chi tiết lượt học</h2>
            {data.rows.map((row) => (
              <p key={row.id} className="break-words">
                {row.user.fullName} · {row.course.name} · {statuses[row.status]}{' '}
                · {row.progressPercent}% · Hạn {formatDate(row.dueAt)}
                {row.completedLate && ' · Hoàn thành trễ'}
              </p>
            ))}
          </section>
          <section className={cardStyle}>
            <h2 className="font-bold">Bàn giao</h2>
            {data.cases.map((entry) => (
              <p key={entry.id} className="break-words">
                {entry.employee.fullName} · {entry.status} · Hạn{' '}
                {formatDate(entry.dueOn)}
              </p>
            ))}
          </section>
          <section className={cardStyle}>
            <h2 className="font-bold">Kết quả kiểm tra</h2>
            <p>
              {data.quiz.attempts} lượt làm · Điểm trung bình{' '}
              {data.quiz.average} · Tỷ lệ đạt {data.quiz.passRate}%
            </p>
            {data.quiz.questions.slice(0, 10).map(({ prompt, wrongRate }) => (
              <p className="break-words" key={prompt}>
                {prompt} · Tỷ lệ sai {wrongRate}%
              </p>
            ))}
          </section>
          <section className={cardStyle}>
            <h2 className="font-bold">Khảo sát chất lượng</h2>
            {data.surveys.map(({ course, ratings, feedback }, index) => (
              <p className="break-words" key={index}>
                {course} · {Object.values(ratings).join(' / ')} · {feedback}
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
