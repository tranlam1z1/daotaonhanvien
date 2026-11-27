'use client';

import Link from 'next/link';
import { availableSections } from '../../lib/workspace';
import { Employees } from '../employees/Employees';
import { Knowledge } from '../knowledge/Knowledge';
import { KnowledgeLibrary } from '../knowledge/KnowledgeLibrary';
import { KnowledgeReviews } from '../knowledge/KnowledgeReviews';
import { Organization } from '../organization/Organization';
import { PlatformCompanies } from '../platform/PlatformCompanies';
import { PlatformLeads } from '../platform/PlatformLeads';
import { Training } from '../training/Training';
import { TrainingReviews } from '../training/TrainingReviews';
import { EmptyState } from '../ui/controls';
import { useAccount } from './WorkspaceShell';

export function WorkspaceHome() {
  const { profile } = useAccount();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        Tổng quan
      </h1>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="break-words text-lg font-semibold text-navy-900">
          Xin chào, {profile.fullName}
        </h2>
        <Link
          href="/ung-dung/ho-so"
          className="mt-2 inline-flex min-h-11 items-center rounded text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
        >
          Xem hồ sơ cá nhân
        </Link>
      </section>
    </div>
  );
}

export function WorkspaceSection({
  slug,
  pilot,
}: {
  slug: string;
  pilot?: string;
}) {
  const { permissions } = useAccount();
  const section = availableSections(permissions).find(
    (item) => item.slug === slug,
  );
  if (!section) return <EmptyState title="Bạn không có quyền mở mục này" />;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {section.label}
      </h1>
      {slug === 'doanh-nghiep' ? (
        <PlatformCompanies pilot={pilot} />
      ) : slug === 'dang-ky-pilot' ? (
        <PlatformLeads />
      ) : slug === 'nhan-vien' ? (
        <Employees />
      ) : slug === 'kho-tri-thuc' ? (
        <KnowledgeLibrary />
      ) : slug === 'noi-dung' ? (
        <Knowledge />
      ) : slug === 'phe-duyet' ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-navy-900">
              Tri thức chờ duyệt
            </h2>
            <KnowledgeReviews />
          </section>
          <TrainingReviews />
        </>
      ) : slug === 'dao-tao' ? (
        <Training />
      ) : slug === 'to-chuc' ? (
        <Organization
          editable={permissions.some(
            ({ permission }) => permission === 'organization.manage',
          )}
        />
      ) : (
        <EmptyState title="Tính năng đang được chuẩn bị" />
      )}
    </div>
  );
}
