import type { ReactNode } from 'react';
import { Button } from '../ui/controls';

type Item = { key: string; name: string };

export function OrderedItems<T extends Item>({
  items,
  label,
  onChange,
  children,
}: {
  items: T[];
  label: string;
  onChange: (items: T[]) => void;
  children: (item: T, position: number) => ReactNode;
}) {
  const dragType =
    'application/x-educore-' + label.replace(/[^a-z0-9]/gi, '').toLowerCase();

  function move(from: number, to: number) {
    if (from < 0 || from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <ol className="space-y-3" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.key}
          className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-3"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(dragType)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            const key = event.dataTransfer.getData(dragType);
            if (!key) return;
            event.preventDefault();
            event.stopPropagation();
            move(
              items.findIndex((entry) => entry.key === key),
              index,
            );
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              draggable
              aria-label={'Kéo ' + (item.name || index + 1)}
              className="cursor-grab rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-navy-900 active:cursor-grabbing"
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData(dragType, item.key);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              ↕ Kéo để đổi chỗ
            </span>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="secondary"
                disabled={index === 0}
                aria-label={'Đưa lên ' + (item.name || index + 1)}
                onClick={() => move(index, index - 1)}
              >
                Lên
              </Button>
              <Button
                variant="secondary"
                disabled={index === items.length - 1}
                aria-label={'Đưa xuống ' + (item.name || index + 1)}
                onClick={() => move(index, index + 1)}
              >
                Xuống
              </Button>
              <Button
                variant="secondary"
                aria-label={'Bỏ ' + (item.name || index + 1)}
                onClick={() =>
                  onChange(items.filter((entry) => entry.key !== item.key))
                }
              >
                Bỏ
              </Button>
            </div>
          </div>
          {children(item, index)}
        </li>
      ))}
    </ol>
  );
}
