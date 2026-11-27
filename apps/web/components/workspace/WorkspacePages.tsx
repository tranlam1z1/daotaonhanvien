'use client';

import Link from 'next/link';
import { availableSections } from '../../lib/workspace';
import Assessments from '../assessments/Assessments';
import { Assignments } from '../assignments/Assignments';
import { Employees } from '../employees/Employees';
import { Knowledge } from '../knowledge/Knowledge';
import { KnowledgeLibrary } from '../knowledge/KnowledgeLibrary';
import { KnowledgeReviews } from '../knowledge/KnowledgeReviews';
import { Learning } from '../learning/Learning';
import { Practice } from '../learning/Practice';
import { SurveyTemplate } from '../learning/CourseSurvey';
import { Organization } from '../organization/Organization';
import { PlatformCompanies } from '../platform/PlatformCompanies';
import { PlatformOverview } from '../platform/PlatformOverview';
import { PlatformLeads } from '../platform/PlatformLeads';
import { PlatformTemplates } from '../training/PlatformTemplates';
import { Training } from '../training/Training';
import { TrainingReviews } from '../training/TrainingReviews';
import { EmptyState } from '../ui/controls';
import { useAccount } from './WorkspaceShell';
import { Handovers, TrainingReports } from './StageThree';

export function WorkspaceHome() {
  const { profile, permissions } = useAccount();
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
      {permissions.some(
        ({ permission, scope }) =>
          permission === 'training.report' && scope !== 'self',
      ) && (
        <div className="mt-5">
          <TrainingReports summaryOnly />
        </div>
      )}
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
      ) : slug === 'bao-cao-nen-tang' ? (
        <PlatformOverview />
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
      ) : slug === 'bo-mau' ? (
        permissions.some(({ permission }) => permission === 'platform.manage') ? (
          <PlatformTemplates />
        ) : (
          <Link href="/ung-dung/dao-tao" className="text-blue-700 underline">
            Mở thư viện và bản cập nhật trong mục Đào tạo
          </Link>
        )
      ) : slug === 'dao-tao' ? (
        <Training />
      ) : slug === 'hoc-tap' ? (
        <Learning />
      ) : slug === 'phan-bo' ? (
        <Assignments />
      ) : slug === 'danh-gia' ? (
        <>
          <Assessments />
          {permissions.some(
            ({ permission, scope }) =>
              permission === 'assessments.manage' && scope === 'tenant',
          ) && <SurveyTemplate />}
        </>
      ) : slug === 'thuc-hanh' ? (
        <Practice />
      ) : slug === 'ban-giao' ? (
        <Handovers />
      ) : slug === 'bao-cao-dao-tao' ? (
        <TrainingReports />
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
