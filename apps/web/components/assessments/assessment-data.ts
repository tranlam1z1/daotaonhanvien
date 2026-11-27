import { accountError, apiUrl } from '../../lib/account-api';

export const endpoint = apiUrl + '/assessments';
export const questionTypes = {
  SINGLE_CHOICE: 'Một đáp án',
  MULTIPLE_CHOICE: 'Nhiều đáp án',
  TRUE_FALSE: 'Đúng/Sai',
} as const;
export type QuestionType = keyof typeof questionTypes;
export const trueFalseOptions = ['Đúng', 'Sai'];

export type QuestionGroup = {
  departmentId: string | null;
  courseId: string | null;
  topic: string;
};
export type Question = {
  id: string;
  departmentId: string | null;
  courseId: string | null;
  topic: string | null;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctOptions: number[];
  explanation: string;
};
export type Quiz = {
  id: string;
  name: string;
  departmentId: string | null;
  selectionMode: 'FIXED' | 'RANDOM' | null;
  randomCount: number | null;
  timeLimitMinutes: number | null;
  passingScore: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: boolean;
  questions: { questionId: string }[];
};
export type Catalog = {
  departments: { id: string; name: string }[];
  courses: { id: string; name: string; departmentId: string | null }[];
  questions: Question[];
  quizzes: Quiz[];
  tenantWide: boolean;
  defaults: { passingScore: number; maxAttempts: number };
};

export function defaultDepartment(catalog: Catalog) {
  return catalog.tenantWide ? null : (catalog.departments[0]?.id ?? null);
}

export function groupLabel(catalog: Catalog, question: Question) {
  return (
    question.topic ||
    catalog.courses.find((course) => course.id === question.courseId)?.name ||
    'Khóa học'
  );
}

export function departmentLabel(catalog: Catalog, departmentId: string | null) {
  return departmentId
    ? (catalog.departments.find(({ id }) => id === departmentId)?.name ??
        'Phòng ban')
    : 'Toàn doanh nghiệp';
}

export async function assessmentRequest<T>(path = '', init?: RequestInit) {
  const response = await fetch(endpoint + path, {
    ...init,
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await accountError(response));
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function saveAssessment(path: string, body: object, id?: string) {
  return assessmentRequest(id ? path + '/' + id : path, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
