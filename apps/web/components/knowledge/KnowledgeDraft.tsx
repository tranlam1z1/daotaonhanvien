'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, Input } from '../ui/controls';
import {
  audienceLabels,
  categoryPaths,
  editorRequest,
  inputStyle,
  uploadKnowledgeFile,
  type Audience,
  type Draft,
  type EditorData,
  type Label,
} from './knowledge-data';

const formats = [
  { command: 'bold', label: 'Đậm' },
  { command: 'italic', label: 'Nghiêng' },
  { command: 'insertUnorderedList', label: 'Danh sách' },
  { command: 'formatBlock', label: 'Tiêu đề đoạn', value: 'h2' },
] as const;

export function KnowledgeDraft({
  initial,
  data,
  onSave,
}: {
  initial?: Draft;
  data: EditorData;
  onSave: (draft: Draft) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const initialHtml = useMemo(
    () => ({ __html: initial?.bodyHtml ?? '' }),
    [initial?.bodyHtml],
  );
  const [audience, setAudience] = useState<Audience>(
    initial?.audience ?? (data.manageTaxonomy ? 'TENANT' : 'DEPARTMENTS'),
  );
  const [departments, setDepartments] = useState(initial?.departmentIds ?? []);
  const [attachments, setAttachments] = useState(initial?.attachments ?? []);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const video = attachments.find((entry) => entry.video);

  async function addFile(file: File, isVideo: boolean) {
    setError('');
    if (!data.manageTaxonomy && !departments.length) {
      setError('Chọn phòng ban trước khi tải tệp lên.');
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadKnowledgeFile(
        file,
        audience === 'DEPARTMENTS' ? departments[0] : undefined,
      );
      setAttachments((items) => [
        ...items.filter((item) => !isVideo || !item.video),
        { file: uploaded, video: isVideo },
      ]);
      if (isVideo) setVideoUrl('');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa tải được tệp.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const draft = await editorRequest<Draft>(
        '/drafts' + (initial ? '/' + initial.itemId : ''),
        initial ? 'PATCH' : 'POST',
        {
          title: fields.get('title'),
          summary: fields.get('summary'),
          bodyHtml: editor.current?.innerHTML ?? '',
          categoryId: fields.get('categoryId'),
          tagIds: fields.getAll('tagIds'),
          audience,
          departmentIds: audience === 'DEPARTMENTS' ? departments : [],
          positionIds:
            audience === 'POSITIONS' ? fields.getAll('positionIds') : [],
          fileIds: attachments
            .filter((entry) => !entry.video)
            .map(({ file }) => file.id),
          videoFileId: video?.file.id,
          videoUrl: videoUrl.trim(),
        },
      );
      onSave(draft);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa lưu được bản nháp.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <fieldset disabled={busy} className="space-y-4">
        <Input
          name="title"
          label="Tiêu đề"
          defaultValue={initial?.title}
          required
          maxLength={200}
        />
        <label className="block space-y-1 text-sm font-semibold">
          <span>Tóm tắt</span>
          <textarea
            name="summary"
            className={inputStyle}
            rows={2}
            maxLength={1000}
            defaultValue={initial?.summary}
          />
        </label>
        <div className="space-y-2">
          <p id="knowledge-body" className="text-sm font-semibold">
            Nội dung
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Định dạng nội dung"
          >
            {formats.map((format) => (
              <Button
                key={format.command}
                variant="secondary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.current?.focus();
                  document.execCommand(
                    format.command,
                    false,
                    'value' in format ? format.value : undefined,
                  );
                }}
              >
                {format.label}
              </Button>
            ))}
          </div>
          <div
            ref={editor}
            role="textbox"
            aria-labelledby="knowledge-body"
            aria-multiline
            contentEditable={!busy}
            suppressContentEditableWarning
            className="knowledge-rich min-h-44 rounded-lg border border-slate-400 bg-white p-3 break-words"
            dangerouslySetInnerHTML={initialHtml}
            onPaste={(event) => {
              event.preventDefault();
              document.execCommand(
                'insertText',
                false,
                event.clipboardData.getData('text/plain'),
              );
            }}
            onDrop={(event) => event.preventDefault()}
          />
        </div>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Danh mục</span>
          <select
            name="categoryId"
            className={inputStyle}
            defaultValue={initial?.categoryId ?? ''}
          >
            <option value="">Chưa chọn</option>
            {categoryPaths(data.categories).map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Choices
          title="Thẻ"
          name="tagIds"
          choices={data.tags}
          initial={initial?.tagIds}
        />
        <label className="block space-y-1 text-sm font-semibold">
          <span>Phạm vi truy cập</span>
          <select
            className={inputStyle}
            value={audience}
            onChange={(event) => setAudience(event.target.value as Audience)}
          >
            {data.manageTaxonomy && (
              <option value="TENANT">{audienceLabels.TENANT}</option>
            )}
            <option value="DEPARTMENTS">{audienceLabels.DEPARTMENTS}</option>
            {data.manageTaxonomy && (
              <option value="POSITIONS">{audienceLabels.POSITIONS}</option>
            )}
          </select>
        </label>
        {audience === 'DEPARTMENTS' && (
          <Choices
            title="Phòng ban"
            name="departmentIds"
            choices={data.departments}
            initial={departments}
            onChange={(ids) => setDepartments(ids)}
          />
        )}
        {audience === 'POSITIONS' && (
          <Choices
            title="Chức danh"
            name="positionIds"
            choices={data.positions}
            initial={initial?.positionIds}
          />
        )}
        <Input
          name="attachment"
          label="Tải tệp đính kèm"
          type="file"
          disabled={attachments.filter(({ video }) => !video).length >= 20}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void addFile(file, false);
          }}
        />
        <Input
          name="videoFile"
          label="Tải video"
          type="file"
          accept=".mp4,.m4v,.mov,.webm"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void addFile(file, true);
          }}
        />
        {attachments.length > 0 && (
          <ul className="space-y-2">
            {attachments.map(({ file, video }) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="min-w-0 break-words">
                  {video && 'Video · '}
                  {file.name}
                </span>
                <Button
                  variant="secondary"
                  aria-label={'Gỡ ' + file.name}
                  onClick={() =>
                    setAttachments((items) =>
                      items.filter((entry) => entry.file.id !== file.id),
                    )
                  }
                >
                  Gỡ
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Input
          name="videoUrl"
          label="Hoặc liên kết video (HTTPS)"
          type="url"
          value={videoUrl}
          disabled={!!video}
          maxLength={2048}
          onChange={(event) => setVideoUrl(event.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit">{busy ? 'Đang xử lý…' : 'Lưu bản nháp'}</Button>
      </fieldset>
    </form>
  );
}

function Choices({
  title,
  name,
  choices,
  initial = [],
  onChange,
}: {
  title: string;
  name: string;
  choices: Label[];
  initial?: string[];
  onChange?: (ids: string[]) => void;
}) {
  return (
    <fieldset className="space-y-1 rounded-lg border border-slate-300 px-3 pb-2">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {choices.length === 0 && (
        <p className="text-sm text-slate-600">Chưa có lựa chọn.</p>
      )}
      {choices.map(({ id, name: label }) => (
        <label key={id} className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={id}
            defaultChecked={initial.includes(id)}
            onChange={(event) =>
              onChange?.(
                event.target.checked
                  ? [...initial, id]
                  : initial.filter((selected) => selected !== id),
              )
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
