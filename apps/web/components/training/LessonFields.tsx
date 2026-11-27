import { inputStyle } from '../knowledge/knowledge-data';
import { Button, Input } from '../ui/controls';
import {
  newLesson,
  lessonTypes,
  type Editor,
  type Lesson,
  type LessonType,
} from './training-data';
import { TemplateSourceLabel, Field, Select, TextArea } from './TrainingFields';

export function LessonFields({
  lesson,
  catalog,
  departmentId,
  fieldId,
  onChange,
  onUpload,
  onDownload,
}: {
  lesson: Lesson;
  catalog: Editor;
  departmentId: string | null;
  fieldId: string;
  onChange: (lesson: Lesson) => void;
  onUpload: (file: File) => void;
  onDownload?: () => void;
}) {
  const kind = lesson.type;
  const videoSource = lesson.videoUrl === null ? 'file' : 'link';
  const refs =
    kind === 'KNOWLEDGE'
      ? catalog.knowledge
      : catalog.quizzes.filter((quiz) => quiz.departmentId === departmentId);

  return (
    <div className="space-y-3">
      <TemplateSourceLabel source={lesson.templateSource} />
      <Input
        label="Tên bài học"
        name={fieldId + '-name'}
        required
        maxLength={200}
        value={lesson.name}
        onChange={(event) => onChange({ ...lesson, name: event.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Loại bài học"
          value={kind}
          onChange={(event) =>
            onChange({
              ...newLesson,
              id: lesson.id,
              name: lesson.name,
              durationMinutes: lesson.durationMinutes,
              type: event.target.value as LessonType,
            })
          }
        >
          {Object.entries(lessonTypes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Thời lượng dự kiến (phút)"
          name={fieldId + '-minutes'}
          type="number"
          required
          min={1}
          max={2147483647}
          value={lesson.durationMinutes || ''}
          onChange={(event) =>
            onChange({ ...lesson, durationMinutes: Number(event.target.value) })
          }
        />
      </div>
      {kind === 'TEXT' && (
        <TextArea
          label="Văn bản bài học"
          required
          maxLength={50000}
          value={lesson.body ?? ''}
          onChange={(event) =>
            onChange({ ...lesson, body: event.target.value })
          }
        />
      )}
      {kind === 'VIDEO' && (
        <Select
          label="Nguồn video"
          value={videoSource}
          onChange={(event) =>
            onChange({
              ...lesson,
              fileId: null,
              file: null,
              videoUrl: event.target.value === 'link' ? '' : null,
            })
          }
        >
          <option value="file">Tệp tải lên</option>
          <option value="link">Liên kết HTTPS</option>
        </Select>
      )}
      {kind === 'VIDEO' && videoSource === 'link' && (
        <Input
          label="Liên kết video"
          name={fieldId + '-url'}
          type="url"
          required
          maxLength={2048}
          value={lesson.videoUrl ?? ''}
          onChange={(event) =>
            onChange({ ...lesson, videoUrl: event.target.value })
          }
        />
      )}
      {(kind === 'DOCUMENT' ||
        (kind === 'VIDEO' && videoSource === 'file')) && (
        <div className="space-y-2">
          <Field
            label={kind === 'DOCUMENT' ? 'Tải tệp tài liệu' : 'Tải tệp video'}
          >
            <input
              className={inputStyle}
              type="file"
              accept={kind === 'VIDEO' ? 'video/*' : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = '';
              }}
            />
          </Field>
          {lesson.file && (
            <p className="break-all text-sm">{lesson.file.name}</p>
          )}
          {onDownload && lesson.file && (
            <Button variant="secondary" onClick={onDownload}>
              Tải tệp đã lưu
            </Button>
          )}
        </div>
      )}
      {(kind === 'KNOWLEDGE' || kind === 'QUIZ') && (
        <Select
          label={
            kind === 'KNOWLEDGE' ? 'Bài tri thức đã xuất bản' : 'Bài kiểm tra'
          }
          required
          value={
            (kind === 'KNOWLEDGE' ? lesson.knowledgeId : lesson.quizId) ?? ''
          }
          onChange={(event) =>
            onChange({
              ...lesson,
              [kind === 'KNOWLEDGE' ? 'knowledgeId' : 'quizId']:
                event.target.value,
            })
          }
        >
          <option value="">Chọn nội dung bạn có quyền đọc</option>
          {refs.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
