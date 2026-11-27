'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input } from '../ui/controls';
import {
  categoryPaths,
  editorRequest,
  inputStyle,
  type Category,
  type EditorData,
  type Label,
} from './knowledge-data';

type Selection = { kind: 'categories' | 'tags'; row?: Category | Label };

export function KnowledgeCatalog({
  data,
  onChange,
}: {
  data: EditorData;
  onChange: () => Promise<void>;
}) {
  const [selection, setSelection] = useState<Selection>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  const categories = categoryPaths(data.categories);

  function choose(next?: Selection, removing = false) {
    setSelection(next);
    setRemove(removing);
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const fields = new FormData(event.currentTarget);
    const { kind, row } = selection;
    setBusy(true);
    setError('');
    try {
      await editorRequest(
        '/catalog/' + kind + (row ? '/' + row.id : ''),
        remove ? 'DELETE' : row ? 'PATCH' : 'POST',
        remove
          ? undefined
          : { name: fields.get('name'), parentId: fields.get('parentId') },
      );
      await onChange();
      choose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Chưa lưu được thay đổi.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['categories', 'tags'] as const).map((kind) => {
        const category = kind === 'categories';
        const rows = category ? categories : data.tags;
        return (
          <section
            key={kind}
            className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">{category ? 'Danh mục' : 'Thẻ'}</h2>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => choose({ kind })}
              >
                {category ? 'Thêm danh mục' : 'Thêm thẻ'}
              </Button>
            </div>
            {rows.length ? (
              <ul className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 break-words text-sm">
                      {'label' in row ? String(row.label) : row.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        aria-label={'Sửa ' + row.name}
                        onClick={() => choose({ kind, row })}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        aria-label={'Xóa ' + row.name}
                        onClick={() => choose({ kind, row }, true)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Chưa có mục nào.</p>
            )}
            {selection?.kind === kind && (
              <form
                key={(selection.row?.id ?? 'new') + remove}
                onSubmit={save}
                className="space-y-3 border-t border-slate-200 pt-3"
              >
                {remove ? (
                  <p className="break-words">Xóa {selection.row?.name}?</p>
                ) : (
                  <>
                    <Input
                      name="name"
                      label={category ? 'Tên danh mục' : 'Tên thẻ'}
                      defaultValue={selection.row?.name}
                      maxLength={160}
                      required
                    />
                    {category && (
                      <label className="block space-y-1 text-sm font-semibold">
                        <span>Danh mục cha</span>
                        <select
                          name="parentId"
                          className={inputStyle}
                          defaultValue={
                            (selection.row as Category | undefined)?.parentId ??
                            ''
                          }
                        >
                          <option value="">Danh mục gốc</option>
                          {categories
                            .filter(({ id }) => id !== selection.row?.id)
                            .map(({ id, label }) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
                {error && (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy}>
                    {remove ? 'Xác nhận xóa' : 'Lưu'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => choose()}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
