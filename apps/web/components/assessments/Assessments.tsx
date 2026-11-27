'use client';

import { useEffect, useState } from 'react';
import { panel } from '../training/TrainingFields';
import { Button, EmptyState, Input } from '../ui/controls';
import { QuestionEditor, QuestionImport } from './QuestionForms';
import { QuizEditor } from './QuizEditor';
import {
  assessmentRequest,
  departmentLabel,
  groupLabel,
  questionTypes,
  type Catalog,
  type Question,
  type Quiz,
} from './assessment-data';

type View =
  | { kind: 'question'; question?: Question }
  | { kind: 'import' }
  | { kind: 'quiz'; quiz?: Quiz };

export default function Assessments() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [view, setView] = useState<View>();
  const [deleteTarget, setDeleteTarget] = useState<Question>();
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    setCatalog(await assessmentRequest<Catalog>());
  }

  useEffect(() => {
    let active = true;
    void assessmentRequest<Catalog>()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, []);

  function open(next: View) {
    setView(next);
    setMessage('');
    setError('');
  }

  async function saved(result: string) {
    setView(undefined);
    setDeleteTarget(undefined);
    setMessage(result);
    setError('');
    try {
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Chưa thể tải dữ liệu.',
      );
    }
  }

  async function deleteQuestion(question: Question) {
    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await assessmentRequest('/questions/' + question.id, {
        method: 'DELETE',
      });
      await saved('Đã xóa câu hỏi.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Chưa thể xóa câu hỏi.',
      );
      setDeleteTarget(undefined);
    } finally {
      setDeleting(false);
    }
  }

  if (!catalog)
    return error ? (
      <p role="alert" className="text-red-700">
        {error}
      </p>
    ) : (
      <p role="status" className="text-slate-600">
        Đang tải ngân hàng câu hỏi…
      </p>
    );

  const formProps = {
    catalog,
    onSaved: saved,
    onClose: () => setView(undefined),
  };
  const filtered = catalog.questions.filter((question) =>
    (question.prompt + ' ' + groupLabel(catalog, question))
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
  );

  return (
    <div className="space-y-5">
      {message && (
        <p role="status" className="text-teal-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {view?.kind === 'question' && (
        <QuestionEditor
          key={view.question?.id ?? 'new'}
          current={view.question}
          {...formProps}
        />
      )}
      {view?.kind === 'import' && <QuestionImport {...formProps} />}
      {view?.kind === 'quiz' && (
        <QuizEditor
          key={view.quiz?.id ?? 'new'}
          current={view.quiz}
          {...formProps}
        />
      )}
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-900">
            Ngân hàng câu hỏi
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open({ kind: 'question' })}>
              Thêm câu hỏi
            </Button>
            <Button
              variant="secondary"
              onClick={() => open({ kind: 'import' })}
            >
              Nhập Excel
            </Button>
          </div>
        </div>
        <Input
          label="Tìm theo câu hỏi, khóa học hoặc chủ đề"
          name="questionSearch"
          value={query}
          onChange={({ target }) => setQuery(target.value)}
        />
        {filtered.length === 0 ? (
          <EmptyState title="Chưa có câu hỏi phù hợp" />
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((question) => (
              <li key={question.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 grow">
                    <p className="break-words font-medium text-navy-900">
                      {question.prompt}
                    </p>
                    <p className="break-words text-sm text-slate-600">
                      {questionTypes[question.type]} ·{' '}
                      {groupLabel(catalog, question)} ·{' '}
                      {departmentLabel(catalog, question.departmentId)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => open({ kind: 'question', question })}
                    >
                      Sửa câu hỏi
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={deleting}
                      onClick={() => setDeleteTarget(question)}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
                {deleteTarget?.id === question.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-slate-600">
                      Xóa câu hỏi này khỏi ngân hàng?
                    </p>
                    <Button
                      disabled={deleting}
                      onClick={() => void deleteQuestion(question)}
                    >
                      Xác nhận xóa
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={deleting}
                      onClick={() => setDeleteTarget(undefined)}
                    >
                      Giữ câu hỏi
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-900">Bài kiểm tra</h2>
          <Button onClick={() => open({ kind: 'quiz' })}>
            Tạo bài kiểm tra
          </Button>
        </div>
        {catalog.quizzes.length === 0 ? (
          <EmptyState title="Chưa có bài kiểm tra" />
        ) : (
          <ul className="divide-y divide-slate-200">
            {catalog.quizzes.map((quiz) => (
              <li
                className="flex flex-wrap items-start justify-between gap-3 py-3"
                key={quiz.id}
              >
                <div className="min-w-0 grow">
                  <p className="break-words font-medium text-navy-900">
                    {quiz.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    {departmentLabel(catalog, quiz.departmentId)} ·{' '}
                    {quiz.selectionMode === 'RANDOM'
                      ? 'Rút ' +
                        quiz.randomCount +
                        ' trong ' +
                        quiz.questions.length +
                        ' câu'
                      : quiz.selectionMode === 'FIXED'
                        ? quiz.questions.length + ' câu cố định'
                        : 'Chưa cấu hình đề'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => open({ kind: 'quiz', quiz })}
                >
                  Sửa bài kiểm tra
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
