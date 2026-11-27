export type Account = {
  id: string;
  tenantId: string | null;
  profile: {
    fullName: string;
    email: string;
    phone: string | null;
    tenantName: string | null;
  };
  roles: string[];
  permissions: { permission: string; scope: string }[];
};

export const roleNames: Record<string, string> = {
  QTNT: 'Quản trị nền tảng',
  ADM: 'Quản trị doanh nghiệp',
  PTDT: 'Phụ trách đào tạo',
  PD: 'Người phê duyệt',
  NV: 'Nhân viên',
};

export const workspaceSections = [
  {
    slug: 'doanh-nghiep',
    label: 'Doanh nghiệp và gói',
    permission: 'platform.manage',
  },
  {
    slug: 'dang-ky-pilot',
    label: 'Đăng ký pilot',
    permission: 'platform.manage',
  },
  {
    slug: 'bao-cao-nen-tang',
    label: 'Báo cáo nền tảng',
    permission: 'platform.report.summary',
  },
  { slug: 'to-chuc', label: 'Tổ chức', permission: 'organization.read' },
  { slug: 'nhan-vien', label: 'Nhân viên', permission: 'employees.manage' },
  { slug: 'kho-tri-thuc', label: 'Kho tri thức', permission: 'knowledge.read' },
  { slug: 'noi-dung', label: 'Quản lý nội dung', permission: 'content.edit' },
  { slug: 'dao-tao', label: 'Đào tạo', permission: 'content.edit' },
  {
    slug: 'phe-duyet',
    label: 'Phê duyệt nội dung',
    permission: 'content.approve',
  },
  {
    slug: 'bo-mau',
    label: 'Bộ mẫu',
    permission: 'templates.apply',
    platformPermission: 'platform.manage',
  },
  {
    slug: 'phan-bo',
    label: 'Phân bổ đào tạo',
    permission: 'assignments.manage',
  },
  {
    slug: 'danh-gia',
    label: 'Kiểm tra và khảo sát',
    permission: 'assessments.manage',
  },
  { slug: 'hoc-tap', label: 'Việc học của tôi', permission: 'learning.use' },
  {
    slug: 'thuc-hanh',
    label: 'Xác nhận thực hành',
    permission: 'practice.confirm',
  },
  {
    slug: 'bao-cao-dao-tao',
    label: 'Báo cáo đào tạo',
    permission: 'training.report',
    scope: 'team',
  },
  { slug: 'ban-giao', label: 'Bàn giao', permission: 'handover.prepare' },
] satisfies {
  slug: string;
  label: string;
  permission: string;
  scope?: 'team';
  platformPermission?: string;
}[];

export function availableSections(permissions: Account['permissions']) {
  return workspaceSections.filter((section) =>
    permissions.some(
      ({ permission, scope }) =>
        ('platformPermission' in section &&
          permission === section.platformPermission) ||
        (permission === section.permission &&
          (!('scope' in section) || scope !== 'self')),
    ),
  );
}
