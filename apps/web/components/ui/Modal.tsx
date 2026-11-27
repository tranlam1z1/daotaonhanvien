'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './controls';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-950/50"
    >
      <h2 id={titleId} className="mb-4 text-lg font-bold text-navy-900">
        {title}
      </h2>
      {children}
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => dialog.current?.close()}
      >
        Đóng
      </Button>
    </dialog>
  );
}
