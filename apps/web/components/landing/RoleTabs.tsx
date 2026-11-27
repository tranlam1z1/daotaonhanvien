'use client';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
const roles = ['admin', 'manager', 'employee'] as const;
export function RoleTabs({
  labels,
  panels,
}: {
  labels: ReactNode[];
  panels: ReactNode[];
}) {
  const [activeRole, setActiveRole] = useState<string>('admin');
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = roles.findIndex((role) => role === activeRole);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % roles.length
        : event.key === 'ArrowLeft'
          ? (index + roles.length - 1) % roles.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? roles.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setActiveRole(roles[next]);
    event.currentTarget.parentElement
      ?.querySelectorAll('button')
      [next]?.focus();
  }
  return (
    <>
      <div
        className="flex flex-wrap justify-center gap-2.5 sm:gap-4 mb-10"
        role="tablist"
        aria-label="Giao diện theo vai trò"
      >
        {roles.map((role, index) => (
          <button
            key={role}
            type="button"
            role="tab"
            id={`tab-${role}`}
            aria-selected={activeRole === role}
            aria-controls={`panel-${role}`}
            tabIndex={activeRole === role ? 0 : -1}
            onClick={() => setActiveRole(role)}
            onKeyDown={handleTabKey}
            className={`role-tab-btn px-5 py-3.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center gap-2 ${activeRole === role ? 'bg-navy-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {labels[index]}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-slate-500 mb-4">
        Giao diện và số liệu minh họa, không phải dữ liệu doanh nghiệp thực tế.
      </p>
      <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-10 shadow-soft">
        {roles.map((role, index) => (
          <div
            key={role}
            role="tabpanel"
            id={`panel-${role}`}
            aria-labelledby={`tab-${role}`}
            hidden={activeRole !== role}
          >
            {panels[index]}
          </div>
        ))}
      </div>
    </>
  );
}
