'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/controls';
import { learningRequest } from './learning-api';

type Question = {
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  prompt: string;
  options: string[];
  correctOptions?: number[];
  explanation?: string;
};
type Result = {
  id: string;
  number: number;
  score: number | null;
  passed: boolean | null;
  submittedAt: string | null;
};
type Paper = Result & {
  expiresAt: string;
  answers: Record<string, number[]>;
  questions: Question[];
};
type Quiz = {
  status: string;
  canStart: boolean;
  maxAttempts: number;
  passingScore: number;
  durationMinutes: number;
  serverNow: string;
  attempt: Paper | null;
  history: Result[];
};

export function QuizLesson({
  path,
  onResult,
}: {
  path: string;
  onResult: (passed: boolean) => void;
}) {
  const [quiz, setQuiz] = useState<Quiz>();
  const [review, setReview] = useState<Paper>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deadline, setDeadline] = useState<number>();
  const [remaining, setRemaining] = useState<number>();
  const endpoint = path + '/quiz/';

  const apply = useCallback((result: Quiz) => {
    setQuiz(result);
    const attempt = result.attempt;
    if (!attempt || attempt.submittedAt) {
      setDeadline(undefined);
      return;
    }
    const milliseconds =
      Date.parse(attempt.expiresAt) - Date.parse(result.serverNow);
    setDeadline(Date.now() + milliseconds);
    setRemaining(Math.max(0, Math.ceil(milliseconds / 1000)));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void learningRequest<Quiz>(endpoint + 'load', {
      post: true,
      signal: controller.signal,
    })
      .then(apply)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [apply, endpoint]);

  useEffect(() => {
    if (deadline === undefined) return;
    const timer = window.setInterval(
      () =>
        setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      250,
    );
    return () => window.clearInterval(timer);
  }, [deadline]);

  const act = useCallback(
    async (action: 'start' | 'save' | 'submit' | 'load', body?: object) => {
      setBusy(true);
      setError('');
      try {
        const result = await learningRequest<Quiz>(endpoint + action, {
          post: true,
          body,
        });
        apply(result);
        if (result.attempt?.submittedAt)
          onResult(result.attempt.passed === true);
      } catch (failure) {
        if (failure instanceof Error) setError(failure.message);
      } finally {
        setBusy(false);
      }
    },
    [apply, endpoint, onResult],
  );

  const attempt = quiz?.attempt;
  useEffect(() => {
    if (remaining !== 0 || !attempt || attempt.submittedAt || busy || error)
      return;
    void act('submit', { attemptId: attempt.id });
  }, [remaining, attempt, busy, error, act]);

  function select(index: number, option: number, multiple: boolean) {
    if (!attempt) return;
    const previous = attempt.answers[index] ?? [];
    const next = multiple
      ? previous.includes(option)
        ? previous.filter((value) => value !== option)
        : [...previous, option]
      : [option];
    void act('save', { attemptId: attempt.id, answers: { [index]: next } });
  }

  const active = attempt && !attempt.submittedAt;
  const paper = review ?? attempt;

  async function reviewAttempt(attemptId: string) {
    setBusy(true);
    setError('');
    try {
      setReview(
        await learningRequest<Paper>(endpoint + 'review', {
          post: true,
          body: { attemptId },
        }),
      );
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Bài kiểm tra">
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-red-700">
            {error}
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void act('load')}
          >
            Tải lại bài kiểm tra
          </Button>
        </div>
      )}
      {!quiz && !error && <p role="status">Đang tải bài kiểm tra…</p>}
      {quiz && (
        <p className="text-sm text-slate-700">
          {quiz.durationMinutes} phút · Điểm đạt {quiz.passingScore}% · Tối đa{' '}
          {quiz.maxAttempts} lần
        </p>
      )}
      {active && remaining !== undefined && (
        <p role="timer" className="font-semibold">
          Thời gian còn lại {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </p>
      )}
      {paper?.submittedAt && (
        <p role="status" className="font-semibold">
          Lần {paper.number} · {formatQuizScore(paper.score!)} ·{' '}
          {paper.passed ? 'Đạt' : 'Chưa đạt'}
        </p>
      )}
      {review && (
        <Button variant="secondary" onClick={() => setReview(undefined)}>
          Về lần làm gần nhất
        </Button>
      )}
      {paper?.questions.map((question, index) => {
        const chosen = paper.answers[index] ?? [];
        const multiple = question.type === 'MULTIPLE_CHOICE';
        return (
          <fieldset
            key={index}
            disabled={busy || !!review || !active || remaining === 0}
            className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3"
          >
            <legend className="max-w-full break-words px-1 font-semibold">
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className="flex min-h-11 items-center gap-2 break-words"
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={'question-' + index}
                  checked={chosen.includes(optionIndex + 1)}
                  onChange={() => select(index, optionIndex + 1, multiple)}
                />
                <span className="min-w-0">
                  {option}
                  {question.correctOptions?.includes(optionIndex + 1) &&
                    ' · Đáp án đúng'}
                </span>
              </label>
            ))}
            {question.explanation && (
              <p className="break-words text-sm">{question.explanation}</p>
            )}
          </fieldset>
        );
      })}
      {active && !review && (
        <Button
          disabled={busy}
          onClick={() => void act('submit', { attemptId: attempt.id })}
        >
          Nộp bài
        </Button>
      )}
      {quiz?.canStart && !review && (
        <Button disabled={busy} onClick={() => void act('start')}>
          {attempt ? 'Làm lại' : 'Bắt đầu làm bài'}
        </Button>
      )}
      {quiz &&
        quiz.history.some(
          (row) => row.id !== attempt?.id && row.submittedAt,
        ) && (
          <ul className="space-y-1 text-sm text-slate-700">
            {quiz.history
              .filter((row) => row.id !== attempt?.id && row.submittedAt)
              .map((row) => (
                <li key={row.id}>
                  <Button
                    variant="secondary"
                    disabled={busy || !!active}
                    onClick={() => void reviewAttempt(row.id)}
                  >
                    Xem lần {row.number} · {formatQuizScore(row.score!)} ·{' '}
                    {row.passed ? 'Đạt' : 'Chưa đạt'}
                  </Button>
                </li>
              ))}
          </ul>
        )}
    </section>
  );
}

export function formatQuizScore(score: number) {
  return (
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(score) +
    '%'
  );
}
