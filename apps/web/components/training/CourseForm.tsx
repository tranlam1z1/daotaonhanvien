import { useState } from 'react';
import { uploadKnowledgeFile } from '../knowledge/knowledge-data';
import { Button, Input } from '../ui/controls';
import { CourseCompletionFields } from './CourseCompletionFields';
import { LessonFields } from './LessonFields';
import { OrderedItems } from './OrderedItems';
import {
  newLesson,
  trainingRequest,
  type Course,
  type Editor,
  type Lesson,
  type OutlineModule,
} from './training-data';
import {
  TemplateSourceLabel,
  panel,
  Scope,
  SubmitActions,
  TextArea,
} from './TrainingFields';

type LessonRow = Lesson & { key: string };
type ModuleRow = Omit<OutlineModule, 'lessons'> & {
  key: string;
  lessons: LessonRow[];
};

export function CourseForm({
  initial,
  programId,
  catalog,
  disabled,
  onSave,
  onCancel,
}: {
  initial: Course;
  programId?: string;
  catalog: Editor;
  disabled: boolean;
  onSave: (course: Course & { programId?: string }) => void;
  onCancel: () => void;
}) {
  const [course, setCourse] = useState(initial);
  const [settings, setSettings] = useState(() => ({
    completion: initial.completion ?? catalog.defaults.completion,
    learningMode: initial.learningMode ?? catalog.defaults.learningMode,
  }));
  const [modules, setModules] = useState<ModuleRow[]>(() =>
    initial.modules.map((module) => ({
      ...module,
      key: module.id!,
      lessons: module.lessons.map((lesson) => ({ ...lesson, key: lesson.id! })),
    })),
  );
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const totalDurationMinutes = modules
    .flatMap(({ lessons }) => lessons)
    .reduce((total, lesson) => total + lesson.durationMinutes, 0);

  function changeModule(key: string, change: (row: ModuleRow) => ModuleRow) {
    setModules((rows) =>
      rows.map((row) => (row.key === key ? change(row) : row)),
    );
  }

  function changeLesson(moduleKey: string, lessonKey: string, value: Lesson) {
    changeModule(moduleKey, (module) => ({
      ...module,
      lessons: module.lessons.map((lesson) =>
        lesson.key === lessonKey ? { ...value, key: lessonKey } : lesson,
      ),
    }));
  }

  async function upload(moduleKey: string, lesson: LessonRow, file: File) {
    setFileError('');
    setUploading(true);
    try {
      const uploaded = await uploadKnowledgeFile(
        file,
        course.departmentId ?? undefined,
      );
      changeLesson(moduleKey, lesson.key, {
        ...lesson,
        file: uploaded,
        fileId: uploaded.id,
      });
      setChangedFiles((keys) => [...keys, lesson.key]);
    } catch (error) {
      setFileError((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function download(id: string) {
    setFileError('');
    try {
      const file = await trainingRequest<{ url: string }>(
        '/courses/' + course.id + '/lessons/' + id + '/file',
      );
      window.location.assign(file.url);
    } catch (error) {
      setFileError((error as Error).message);
    }
  }

  return (
    <form
      className={panel}
      onSubmit={(event) => {
        event.preventDefault();
        setFileError('');
        if (
          modules.some((module) =>
            module.lessons.some(
              (lesson) =>
                (lesson.type === 'DOCUMENT' ||
                  (lesson.type === 'VIDEO' && lesson.videoUrl === null)) &&
                !lesson.fileId,
            ),
          )
        ) {
          setFileError(
            'Vui lòng tải tệp cho từng bài yêu cầu tài liệu hoặc video.',
          );
          return;
        }
        onSave({
          ...course,
          ...settings,
          programId,
          modules: modules.map(({ id, name, lessons }) => ({
            id,
            name,
            lessons: lessons.map(
              ({
                id,
                name,
                type,
                durationMinutes,
                body,
                file,
                fileId,
                videoUrl,
                knowledgeId,
                quizId,
              }) => ({
                id,
                name,
                type,
                durationMinutes,
                body,
                file,
                fileId,
                videoUrl,
                knowledgeId,
                quizId,
              }),
            ),
          })),
        });
      }}
    >
      <h2 className="text-lg font-semibold text-navy-900">
        {course.id ? 'Sửa khóa học nháp' : 'Tạo khóa học'}
      </h2>
      <TemplateSourceLabel source={course.templateSource} />
      <p className="text-sm text-navy-900">
        Tổng thời lượng {totalDurationMinutes.toLocaleString('vi-VN')} phút.
      </p>
      {fileError && (
        <p role="alert" className="text-sm text-red-700">
          {fileError}
        </p>
      )}
      {uploading && (
        <p role="status" className="text-sm">
          Đang tải tệp…
        </p>
      )}
      <fieldset disabled={disabled || uploading} className="min-w-0 space-y-4">
        <Input
          label="Tên khóa học"
          name="course-name"
          required
          maxLength={200}
          value={course.name}
          onChange={(event) =>
            setCourse({ ...course, name: event.target.value })
          }
        />
        <TextArea
          label="Mô tả khóa học"
          maxLength={5000}
          value={course.description}
          onChange={(event) =>
            setCourse({ ...course, description: event.target.value })
          }
        />
        <Scope
          catalog={catalog}
          value={course.departmentId}
          disabled={!!course.id || !!programId}
          onChange={(departmentId) => setCourse({ ...course, departmentId })}
        />
        <CourseCompletionFields settings={settings} onChange={setSettings} />
        <OrderedItems
          items={modules}
          label="Danh sách module"
          onChange={setModules}
        >
          {(module) => (
            <>
              <TemplateSourceLabel source={module.templateSource} />
              <Input
                label="Tên module"
                name={module.key + '-name'}
                required
                maxLength={200}
                value={module.name}
                onChange={(event) => {
                  const name = event.target.value;
                  changeModule(module.key, (row) => ({ ...row, name }));
                }}
              />
              <OrderedItems
                items={module.lessons}
                label="Danh sách bài học"
                onChange={(lessons) =>
                  changeModule(module.key, (row) => ({ ...row, lessons }))
                }
              >
                {(lesson) => (
                  <LessonFields
                    lesson={lesson}
                    catalog={catalog}
                    departmentId={course.departmentId}
                    fieldId={lesson.key}
                    onChange={(value) =>
                      changeLesson(module.key, lesson.key, value)
                    }
                    onUpload={(file) => void upload(module.key, lesson, file)}
                    onDownload={
                      lesson.id && !changedFiles.includes(lesson.key)
                        ? () => void download(lesson.id!)
                        : undefined
                    }
                  />
                )}
              </OrderedItems>
              <Button
                variant="secondary"
                onClick={() => {
                  const lesson = { ...newLesson, key: crypto.randomUUID() };
                  changeModule(module.key, (row) => ({
                    ...row,
                    lessons: [...row.lessons, lesson],
                  }));
                }}
              >
                Thêm bài học
              </Button>
            </>
          )}
        </OrderedItems>
        <Button
          variant="secondary"
          onClick={() =>
            setModules([
              ...modules,
              { key: crypto.randomUUID(), id: null, name: '', lessons: [] },
            ])
          }
        >
          Thêm module
        </Button>
        <SubmitActions label="Lưu khóa học" onCancel={onCancel} />
      </fieldset>
    </form>
  );
}
