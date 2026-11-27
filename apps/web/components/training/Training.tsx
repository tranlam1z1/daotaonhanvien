'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '../ui/controls';
import { CourseForm } from './CourseForm';
import { ProgramForm } from './ProgramForm';
import { TemplateLibrary } from './TemplateLibrary';
import { panel, SubmitActions } from './TrainingFields';
import {
  trainingRequest,
  type Course,
  type Editor,
  type Program,
  type TrainingKind,
  type Workflow,
  workflowLabels,
} from './training-data';

type Form =
  | { kind: 'program'; initial: Program }
  | { kind: 'course'; initial: Course; programId?: string }
  | { kind: 'copy'; id: string; name: string };

const titles = { ONBOARDING: 'Hội nhập', SPECIALIST: 'Chuyên môn' };
const units = { DAYS: 'ngày', HOURS: 'giờ' };

export function Training() {
  const [catalog, setCatalog] = useState<Editor | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    trainingRequest<Editor>().then(
      (data) => {
        if (active) setCatalog(data);
      },
      (reason: Error) => {
        if (active) setError(reason.message);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  function open(next: Form | null) {
    setForm(next);
    setError('');
    setMessage('');
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(
    route: string,
    method: 'POST' | 'PATCH',
    data: object,
    notice: string,
  ) {
    await run(async () => {
      await trainingRequest(route, method, data);
      setForm(null);
      setMessage(notice);
      setCatalog(await trainingRequest<Editor>());
    });
  }

  if (!catalog)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || 'Đang tải nội dung đào tạo…'}
      </p>
    );

  const defaultScope = catalog.tenantWide
    ? null
    : (catalog.departments[0]?.id ?? null);

  function workflowActions(
    kind: TrainingKind,
    record: Workflow & { id: string },
  ) {
    function change(action: 'submit' | 'withdraw' | 'publish', notice: string) {
      void save(
        '/' + kind + '/' + record.id + '/workflow/' + action,
        'POST',
        action === 'withdraw'
          ? { token: record.reviewToken }
          : { revision: record.revision },
        notice,
      );
    }

    return (
      <>
        {record.canSubmit && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => change('submit', 'Đã gửi duyệt.')}
          >
            Gửi duyệt
          </Button>
        )}
        {record.canWithdraw && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => change('withdraw', 'Đã rút duyệt.')}
          >
            Rút lại
          </Button>
        )}
        {record.canPublish && (
          <Button
            disabled={busy}
            onClick={() => change('publish', 'Đã xuất bản.')}
          >
            Xuất bản
          </Button>
        )}
      </>
    );
  }

  function newCourse(program?: Program & { id: string }) {
    open({
      kind: 'course',
      programId: program?.id,
      initial: {
        id: null,
        name: '',
        description: '',
        departmentId: program ? program.departmentId : defaultScope,
        modules: [],
      },
    });
  }

  const courseNames = new Map(
    catalog.courses.map(({ id, name }) => [id, name]),
  );

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      {form?.kind === 'program' && (
        <ProgramForm
          key={form.initial.id ?? 'new'}
          initial={form.initial}
          catalog={catalog}
          disabled={busy}
          onCancel={() => open(null)}
          onSave={(data) =>
            void save(
              data.id ? '/programs/' + data.id : '/programs',
              data.id ? 'PATCH' : 'POST',
              {
                ...data,
                courseIds: data.courses.map(({ courseId }) => courseId),
              },
              'Đã lưu chương trình.',
            )
          }
        />
      )}
      {form?.kind === 'course' && (
        <CourseForm
          key={form.initial.id ?? form.programId ?? 'new'}
          initial={form.initial}
          programId={form.programId}
          catalog={catalog}
          disabled={busy}
          onCancel={() => open(null)}
          onSave={(data) =>
            void save(
              data.id ? '/courses/' + data.id : '/courses',
              data.id ? 'PATCH' : 'POST',
              data,
              'Đã lưu khóa học.',
            )
          }
        />
      )}
      {form?.kind === 'copy' && (
        <form
          className={panel}
          onSubmit={(event) => {
            event.preventDefault();
            void save(
              '/courses/' + form.id + '/copy',
              'POST',
              { name: form.name },
              'Đã sao chép thành khóa học nháp.',
            );
          }}
        >
          <h2 className="text-lg font-semibold text-navy-900">
            Sao chép khóa học
          </h2>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <Input
              label="Tên bản sao"
              name="copy-name"
              required
              maxLength={200}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <SubmitActions
              label="Tạo bản sao nháp"
              onCancel={() => open(null)}
            />
          </fieldset>
        </form>
      )}
      {!form && (
        <>
          <TemplateLibrary
            catalog={catalog}
            onCopied={async () => setCatalog(await trainingRequest<Editor>())}
          />
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-navy-900">
                Chương trình
              </h2>
              <Button
                disabled={busy}
                onClick={() =>
                  open({
                    kind: 'program',
                    initial: {
                      id: null,
                      name: '',
                      description: '',
                      audience: '',
                      departmentId: defaultScope,
                      type: 'ONBOARDING',
                      targetUnit: 'DAYS',
                      targetDuration: 1,
                      courses: [],
                    },
                  })
                }
              >
                Tạo chương trình
              </Button>
            </div>
            {catalog.programs.length === 0 && (
              <p className="text-sm text-slate-600">Chưa có chương trình.</p>
            )}
            <ul className="divide-y divide-slate-200">
              {catalog.programs.map((program) => (
                <li key={program.id} className="space-y-2 py-3">
                  <h3 className="break-words font-semibold text-navy-900">
                    {program.name}
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {program.description}
                  </p>
                  <p className="break-words text-sm text-slate-600">
                    {workflowLabels[program.status]} · {titles[program.type]} ·{' '}
                    {program.targetDuration} {units[program.targetUnit]} ·{' '}
                    {program.audience}
                  </p>
                  {program.rejectionReason && (
                    <RejectionReason reason={program.rejectionReason} />
                  )}
                  {program.totalDurationMinutes !== undefined && (
                    <p className="text-sm text-slate-600">
                      Tổng thời lượng{' '}
                      {program.totalDurationMinutes.toLocaleString('vi-VN')}{' '}
                      phút.
                      {program.exceedsTarget && (
                        <span className="ml-2 font-semibold text-orange-800">
                          Vượt thời gian mục tiêu.
                        </span>
                      )}
                    </p>
                  )}
                  {program.courses.length > 0 && (
                    <ul className="list-inside list-disc break-words text-sm">
                      {program.courses.map(({ courseId }) => (
                        <li key={courseId}>{courseNames.get(courseId)}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy || program.status === 'IN_REVIEW'}
                      onClick={() =>
                        open({ kind: 'program', initial: program })
                      }
                    >
                      {program.status === 'PUBLISHED'
                        ? 'Tạo bản nháp sửa chương trình'
                        : 'Sửa chương trình'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || program.status === 'IN_REVIEW'}
                      onClick={() => newCourse(program)}
                    >
                      Tạo khóa học trong chương trình
                    </Button>
                    {workflowActions('programs', program)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-navy-900">Khóa học</h2>
              <Button disabled={busy} onClick={() => newCourse()}>
                Tạo khóa học
              </Button>
            </div>
            {catalog.courses.length === 0 && (
              <p className="text-sm text-slate-600">Chưa có khóa học.</p>
            )}
            <ul className="divide-y divide-slate-200">
              {catalog.courses.map((course) => {
                const { id, name, totalDurationMinutes, status } = course;
                return (
                  <li key={id} className="space-y-2 py-3">
                    <h3 className="break-words font-semibold text-navy-900">
                      {name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {workflowLabels[status]} ·{' '}
                      {totalDurationMinutes.toLocaleString('vi-VN')} phút
                    </p>
                    {course.rejectionReason && (
                      <RejectionReason reason={course.rejectionReason} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy || status === 'IN_REVIEW'}
                        onClick={() =>
                          void run(async () => {
                            const initial = await trainingRequest<Course>(
                              '/courses/' + id,
                            );
                            open({ kind: 'course', initial });
                          })
                        }
                      >
                        {status === 'PUBLISHED'
                          ? 'Tạo bản nháp sửa khóa học'
                          : 'Sửa khóa học'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          open({
                            kind: 'copy',
                            id,
                            name: name.slice(0, 190) + ' (bản sao)',
                          })
                        }
                      >
                        Sao chép
                      </Button>
                      {workflowActions('courses', course)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function RejectionReason({ reason }: { reason: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-red-800">
      Lý do từ chối • {reason}
    </p>
  );
}
