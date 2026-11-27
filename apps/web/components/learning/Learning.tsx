'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readerRequest } from '../knowledge/knowledge-data';
import { PublishedDetail } from '../knowledge/PublishedDetail';
import { Button, EmptyState } from '../ui/controls';
import { LessonVideo } from './LessonVideo';
import { CourseSurvey } from './CourseSurvey';
import { formatQuizScore, QuizLesson } from './QuizLesson';
import { learningRequest } from './learning-api';

const statuses = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang học',
  OVERDUE: 'Quá hạn',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Chưa đạt',
};
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

type Enrollment = {
  id: string;
  title: string;
  status: keyof typeof statuses;
  dueAt: string;
  progressPercent: number;
  completedAt: string | null;
  score: number | null;
  completedLate: boolean;
};
type LessonType = 'TEXT' | 'DOCUMENT' | 'VIDEO' | 'KNOWLEDGE' | 'QUIZ';
type Course = Pick<Enrollment, 'id' | 'title' | 'dueAt' | 'status'> & {
  description: string;
  resumeLessonId: string | null;
  modules: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      durationMinutes: number;
      completed: boolean;
      locked: boolean;
    }[];
  }[];
};
type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  body: string | null;
  videoUrl: string | null;
  file: { name: string; contentType: string } | null;
  knowledge: { id: string; title: string } | null;
  completed: boolean;
  resumePosition: number;
  canRecordProgress: boolean;
};

const linkStyle =
  'inline-flex min-h-11 items-center font-semibold text-blue-700 underline';
const cardStyle =
  'space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6';

export function Learning() {
  const [items, setItems] = useState<Enrollment[]>();
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (!selected) {
      void learningRequest<Enrollment[]>('', { signal: controller.signal })
        .then(setItems)
        .catch((failure: Error) => {
          if (!controller.signal.aborted) setError(failure.message);
        });
    }
    return () => controller.abort();
  }, [selected]);

  if (selected) {
    return (
      <CourseView
        key={selected}
        id={selected}
        close={() => setSelected(undefined)}
      />
    );
  }
  const current = items?.filter(
    ({ completedAt, status }) => !completedAt && status !== 'FAILED',
  );
  const history = items?.filter(
    ({ completedAt, status }) => completedAt || status === 'FAILED',
  );
  return (
    <>
      <Link className={linkStyle} href="/ung-dung/kho-tri-thuc">
        Tra cứu kho tri thức
      </Link>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!items && !error && <p role="status">Đang tải lượt học…</p>}
      {current && (
        <EnrollmentList
          title="Khóa học được giao"
          empty="Bạn chưa có khóa học được giao."
          items={current}
          select={setSelected}
        />
      )}
      {history && (
        <EnrollmentList
          title="Lịch sử học tập"
          empty="Bạn chưa có lượt học đã kết thúc."
          items={history}
          select={setSelected}
        />
      )}
    </>
  );
}

function EnrollmentList({
  title,
  empty,
  items,
  select,
}: {
  title: string;
  empty: string;
  items: Enrollment[];
  select: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className={cardStyle}>
              <h3 className="break-words font-semibold">{item.title}</h3>
              <p className="text-sm text-slate-700">
                {statuses[item.status]} · {item.progressPercent}%
              </p>
              <p className="text-sm text-slate-700">
                Hạn {dateFormat.format(new Date(item.dueAt))}
              </p>
              {item.completedAt && (
                <p className="text-sm text-slate-700">
                  Hoàn thành {dateFormat.format(new Date(item.completedAt))}
                  {item.completedLate && ' · Trễ hạn'}
                </p>
              )}
              {item.score !== null && (
                <p className="text-sm text-slate-700">
                  Điểm kiểm tra cuối khóa {formatQuizScore(item.score)}
                </p>
              )}
              <Button variant="secondary" onClick={() => select(item.id)}>
                {item.completedAt ? 'Xem khóa học' : 'Mở khóa học'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CourseView({ id, close }: { id: string; close: () => void }) {
  const [course, setCourse] = useState<Course>();
  const [lessonId, setLessonId] = useState<string>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reloadCourse = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void learningRequest<Course>('/' + id, { signal: controller.signal })
      .then(setCourse)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [id, revision]);

  return (
    <>
      <Button variant="secondary" onClick={close}>
        Về danh sách
      </Button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!course && !error && <p role="status">Đang tải khóa học…</p>}
      {course && (
        <div className="space-y-4">
          <section className={cardStyle}>
            <h2 className="break-words text-xl font-bold">{course.title}</h2>
            {course.description && (
              <p className="whitespace-pre-wrap break-words">
                {course.description}
              </p>
            )}
            <p className="text-sm text-slate-700">
              {statuses[course.status]} · Hạn{' '}
              {dateFormat.format(new Date(course.dueAt))}
            </p>
            {course.resumeLessonId && !lessonId && (
              <Button onClick={() => setLessonId(course.resumeLessonId!)}>
                Tiếp tục học
              </Button>
            )}
          </section>
          {course.status === 'COMPLETED' && <CourseSurvey id={course.id} />}
          {lessonId && (
            <LessonView
              key={lessonId}
              path={'/' + id + '/lessons/' + lessonId}
              close={() => setLessonId(undefined)}
              onChange={reloadCourse}
            />
          )}
          {course.modules.map((module) => (
            <section key={module.id} className={cardStyle}>
              <h3 className="break-words font-semibold">{module.title}</h3>
              <ul className="space-y-2">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <button
                      className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left enabled:hover:bg-slate-100 disabled:text-slate-500"
                      disabled={lesson.locked}
                      onClick={() => setLessonId(lesson.id)}
                    >
                      <span className="min-w-0 break-words font-semibold">
                        {lesson.title}
                      </span>
                      <span className="text-sm">
                        {lesson.locked
                          ? 'Chưa mở'
                          : lesson.completed
                            ? 'Đã học xong'
                            : lesson.durationMinutes + ' phút'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function LessonView({
  path,
  close,
  onChange,
}: {
  path: string;
  close: () => void;
  onChange: () => void;
}) {
  const [lesson, setLesson] = useState<Lesson>();
  const [fileUrl, setFileUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void learningRequest<Lesson>(path + '/open', {
      post: true,
      signal: controller.signal,
    })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        setLesson(result);
        setCompleted(result.completed);
        onChange();
        if (result.file) {
          const file = await learningRequest<{ url: string }>(path + '/file', {
            signal: controller.signal,
          });
          if (!controller.signal.aborted) setFileUrl(file.url);
        }
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [path, onChange]);

  function finish() {
    setCompleted(true);
    onChange();
  }

  async function markComplete() {
    setBusy(true);
    setError('');
    try {
      await learningRequest(path + '/complete', { post: true });
      finish();
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const videoUrl = lesson?.videoUrl ?? fileUrl;
  const manual =
    lesson?.type === 'TEXT' ||
    lesson?.type === 'DOCUMENT' ||
    !!lesson?.knowledge;
  return (
    <article className={cardStyle}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-words text-lg font-semibold">
          {lesson?.title ?? 'Bài học'}
        </h3>
        <Button variant="secondary" onClick={close}>
          Đóng bài học
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!lesson && !error && <p role="status">Đang mở bài học…</p>}
      {lesson?.body && (
        <p className="whitespace-pre-wrap break-words">{lesson.body}</p>
      )}
      {lesson?.type === 'DOCUMENT' && fileUrl && (
        <>
          {lesson.file?.contentType === 'application/pdf' && (
            <iframe
              title={lesson.file.name}
              src={fileUrl}
              className="h-[65vh] w-full rounded-lg border border-slate-200"
            />
          )}
          <a
            className={linkStyle}
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mở {lesson.file?.name}
          </a>
        </>
      )}
      {lesson?.type === 'VIDEO' && videoUrl && (
        <LessonVideo
          url={videoUrl}
          path={path}
          resumeAt={lesson.resumePosition}
          record={lesson.canRecordProgress}
          onComplete={() => {
            if (!completed) finish();
          }}
          onError={setError}
        />
      )}
      {lesson?.type === 'KNOWLEDGE' &&
        (lesson.knowledge ? (
          <PublishedDetail
            path={'/' + lesson.knowledge.id}
            request={readerRequest}
          />
        ) : (
          <p>Bài tri thức hiện không khả dụng trong phạm vi của bạn.</p>
        ))}
      {lesson?.type === 'QUIZ' && (
        <QuizLesson
          path={path}
          onResult={(passed) => {
            if (passed) finish();
            else onChange();
          }}
        />
      )}
      {completed ? (
        <p role="status" className="font-semibold text-teal-700">
          Đã học xong
        </p>
      ) : (
        manual &&
        lesson?.canRecordProgress && (
          <Button onClick={() => void markComplete()} disabled={busy}>
            Đã học xong
          </Button>
        )
      )}
    </article>
  );
}
