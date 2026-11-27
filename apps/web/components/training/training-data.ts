import { accountError, apiUrl } from '../../lib/account-api';
import type { CompanyConfig } from '../organization/organization-data';

export type CourseSettings = {
  completion: CompanyConfig['completion'];
  learningMode: 'SEQUENTIAL' | 'FREE';
};

export type TemplateSource = {
  sourceItemId: string;
  sourceVersion: string;
  customized: boolean;
};
export type Label = { id: string; name: string };
export type LessonType = keyof typeof lessonTypes;
export type Lesson = {
  templateSource?: TemplateSource | null;
  id: string | null;
  name: string;
  type: LessonType;
  durationMinutes: number;
  body: string | null;
  file: Label | null;
  fileId: string | null;
  videoUrl: string | null;
  knowledgeId: string | null;
  quizId: string | null;
};
export type OutlineModule = {
  templateSource?: TemplateSource | null;
  id: string | null;
  name: string;
  lessons: Lesson[];
};
export type Course = Partial<CourseSettings> & {
  templateSource?: TemplateSource | null;
  id: string | null;
  revision?: number;
  departmentId: string | null;
  name: string;
  description: string;
  modules: OutlineModule[];
  totalDurationMinutes?: number;
};
export type Program = {
  templateSource?: TemplateSource | null;
  id: string | null;
  revision?: number;
  departmentId: string | null;
  name: string;
  description: string;
  audience: string;
  type: 'ONBOARDING' | 'SPECIALIST';
  targetUnit: 'DAYS' | 'HOURS';
  targetDuration: number;
  courses: { courseId: string }[];
  totalDurationMinutes?: number;
  exceedsTarget?: boolean;
};
export type TrainingKind = 'courses' | 'programs';
export type Workflow = {
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  revision: number;
  reviewToken: string | null;
  rejectionReason: string | null;
  canSubmit: boolean;
  canPublish: boolean;
  canWithdraw: boolean;
  canApprove: boolean;
};

export const workflowLabels = {
  DRAFT: 'Nháp',
  IN_REVIEW: 'Chờ duyệt',
  PUBLISHED: 'Đã xuất bản',
};

export type Editor = {
  tenantWide: boolean;
  departments: Label[];
  courses: (Label & {
    departmentId: string | null;
    totalDurationMinutes: number;
  } & Workflow)[];
  programs: (Program & { id: string } & Workflow)[];
  knowledge: Label[];
  quizzes: (Label & { departmentId: string | null })[];
  defaults: CourseSettings;
};

export const lessonTypes = {
  TEXT: 'Văn bản',
  DOCUMENT: 'Tệp tài liệu',
  VIDEO: 'Video',
  KNOWLEDGE: 'Liên kết bài tri thức',
  QUIZ: 'Tham chiếu bài kiểm tra',
};

export const newLesson: Lesson = {
  id: null,
  name: '',
  type: 'TEXT',
  durationMinutes: 1,
  body: '',
  file: null,
  fileId: null,
  videoUrl: null,
  knowledgeId: null,
  quizId: null,
};

export async function trainingRequest<T>(
  route = '',
  method = 'GET',
  body?: object,
) {
  return trainingApi<T>('/editor' + route, method, body);
}

export async function trainingApi<T>(
  route: string,
  method = 'GET',
  body?: object,
  signal?: AbortSignal,
) {
  const response = await fetch(apiUrl + '/training' + route, {
    signal,
    method,
    credentials: 'include',
    ...(body && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) throw new Error(await accountError(response));
  return response.json() as Promise<T>;
}
