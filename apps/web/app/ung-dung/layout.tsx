import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceShell } from '../../components/workspace/WorkspaceShell';

export const metadata: Metadata = {
  title: {
    default: 'Không gian làm việc | EduCore36',
    template: '%s | EduCore36',
  },
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
