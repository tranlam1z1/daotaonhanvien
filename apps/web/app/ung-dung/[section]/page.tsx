import { notFound } from 'next/navigation';
import { WorkspaceSection } from '../../../components/workspace/WorkspacePages';
import { workspaceSections } from '../../../lib/workspace';

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ pilot?: string | string[] }>;
}) {
  const { section } = await params;
  if (!workspaceSections.some(({ slug }) => slug === section)) notFound();
  const { pilot } = await searchParams;
  return (
    <WorkspaceSection
      slug={section}
      pilot={typeof pilot === 'string' ? pilot : undefined}
    />
  );
}
