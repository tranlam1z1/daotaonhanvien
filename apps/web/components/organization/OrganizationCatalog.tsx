import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button, EmptyState, Input } from '../ui/controls';
import { organizationRequest, type CatalogItem } from './organization-data';
import { OrganizationForm } from './OrganizationForms';

function treeRows(items: CatalogItem[]) {
  const byParent = new Map<string | null, CatalogItem[]>();
  const ids = new Set(items.map(({ id }) => id));
  for (const item of items) {
    const parent =
      item.parentId && ids.has(item.parentId) ? item.parentId : null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(item);
    byParent.set(parent, siblings);
  }
  const rows: { item: CatalogItem; lineage: string[]; label: string }[] = [];
  function visit(parent: string | null, lineage: string[], names: string[]) {
    for (const item of byParent.get(parent) ?? []) {
      const path = [...names, item.name];
      rows.push({ item, lineage, label: path.join(' / ') });
      visit(item.id, [...lineage, item.id], path);
    }
  }
  visit(null, [], []);
  return rows;
}

const selectClass =
  'block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-navy-900';

export function OrganizationCatalog({
  catalog,
  items,
  editable,
  onChange,
}: {
  catalog: 'departments' | 'positions';
  items: CatalogItem[];
  editable: boolean;
  onChange: (items: CatalogItem[]) => void;
}) {
  const isDepartment = catalog === 'departments';
  const noun = isDepartment ? 'phòng ban' : 'chức danh';
  const [editing, setEditing] = useState<CatalogItem | null>();
  const rows = treeRows(items);
  const parents = rows.filter(
    ({ item, lineage }) =>
      item.id !== editing?.id &&
      !lineage.includes(editing?.id ?? '') &&
      (item.status === 'ACTIVE' || item.id === editing?.parentId),
  );
  const nameById = new Map(items.map(({ id, name }) => [id, name]));

  async function save(form: FormData) {
    const id = editing?.id;
    const saved = await organizationRequest<CatalogItem>(
      '/' + catalog + (id ? '/' + id : ''),
      { method: id ? 'PATCH' : 'POST', body: Object.fromEntries(form) },
    );
    onChange(
      [...items.filter((item) => item.id !== saved.id), saved].sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id),
      ),
    );
    setEditing(undefined);
  }

  return (
    <div className="space-y-4">
      {editable && (
        <Button onClick={() => setEditing(null)}>Thêm {noun}</Button>
      )}
      {!rows.length ? (
        <EmptyState title={'Chưa có ' + noun} />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {rows.map(({ item, lineage }) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 py-2 pr-2"
              style={{ paddingLeft: 12 + Math.min(3, lineage.length) * 12 }}
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-navy-900">
                  {item.name}
                </p>
                {item.parentId && (
                  <p className="break-words text-sm text-slate-600">
                    Cấp trên · {nameById.get(item.parentId) ?? '—'}
                  </p>
                )}
                <p
                  className={
                    item.status === 'ACTIVE'
                      ? 'text-sm text-teal-800'
                      : 'text-sm text-slate-600'
                  }
                >
                  {item.status === 'ACTIVE'
                    ? 'Đang hoạt động'
                    : 'Ngừng sử dụng'}
                </p>
              </div>
              {editable && (
                <Button
                  variant="secondary"
                  aria-label={'Sửa ' + item.name}
                  onClick={() => setEditing(item)}
                >
                  Sửa
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={editing !== undefined}
        title={(editing ? 'Sửa ' : 'Thêm ') + noun}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <OrganizationForm editable onSave={save}>
            <Input
              id={catalog + '-name'}
              name="name"
              label={'Tên ' + noun}
              defaultValue={editing?.name}
              maxLength={200}
              required
            />
            {isDepartment && (
              <label className="space-y-1 text-sm font-semibold text-navy-900">
                Phòng ban cấp trên
                <select
                  name="parentId"
                  defaultValue={editing?.parentId ?? ''}
                  className={selectClass}
                >
                  <option value="">Cấp cao nhất</option>
                  {parents.map(({ item, label }) => (
                    <option key={item.id} value={item.id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="space-y-1 text-sm font-semibold text-navy-900">
              Trạng thái
              <select
                name="status"
                defaultValue={editing?.status ?? 'ACTIVE'}
                className={selectClass}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng sử dụng</option>
              </select>
            </label>
          </OrganizationForm>
        )}
      </Modal>
    </div>
  );
}
