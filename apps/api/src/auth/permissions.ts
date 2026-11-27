import type { Role, UserStatus } from '@prisma/client';

type RoleAssignment = { role: Role; departmentIds: string[] };

export type AuthorizationIdentity = {
  id: string;
  tenantId: string | null;
  status: UserStatus;
  roles: RoleAssignment[];
  hasDirectReports: boolean;
};

export type SessionIdentity = AuthorizationIdentity & {
  profile: {
    fullName: string;
    email: string;
    phone: string | null;
    tenantName: string | null;
  };
};

export type PermissionContext = {
  tenantId: string;
  departmentIds?: readonly (string | null)[];
  employee?: { id: string; managerId: string | null };
  recipientId?: string | null;
  knowledgeVisible?: boolean;
};

const matrix = {
  'platform.manage': { QTNT: 'platform' },
  'platform.report.summary': { QTNT: 'platform' },
  'organization.read': {
    ADM: 'tenant',
    PTDT: 'tenant',
    PD: 'tenant',
    manager: 'tenant',
  },
  'organization.manage': { ADM: 'tenant' },
  'employees.manage': { ADM: 'tenant' },
  'content.edit': { ADM: 'tenant', PTDT: 'departments' },
  'content.approve': { ADM: 'tenant', PD: 'departments' },
  'templates.apply': { ADM: 'tenant', PTDT: 'departments' },
  'assignments.manage': { ADM: 'tenant', PTDT: 'departments' },
  'assessments.manage': { ADM: 'tenant', PTDT: 'departments' },
  'learning.use': { NV: 'tenant' },
  'knowledge.read': {
    ADM: 'tenant',
    PTDT: 'tenant',
    PD: 'tenant',
    manager: 'tenant',
    NV: 'knowledge',
  },
  'practice.confirm': { ADM: 'tenant', manager: 'directReports' },
  'training.report': {
    ADM: 'tenant',
    PTDT: 'departments',
    manager: 'directReports',
    NV: 'self',
  },
  'handover.start': { ADM: 'tenant', manager: 'directReports' },
  'handover.prepare': { ADM: 'tenant', manager: 'directReports', NV: 'self' },
  'handover.complete': { ADM: 'tenant', manager: 'directReports' },
  'handover.receive': { NV: 'recipient' },
  'session.profile': { account: 'account' },
  'session.changePassword': { account: 'account' },
  'session.logoutAll': { account: 'account' },
} as const;

export type Permission = keyof typeof matrix;
type Scope =
  | 'account'
  | 'platform'
  | 'tenant'
  | 'departments'
  | 'knowledge'
  | 'directReports'
  | 'self'
  | 'recipient';

type Grant =
  | { scope: Exclude<Scope, 'departments'> }
  | { scope: 'departments'; departmentIds: string[] };

export function effectiveRoles(actor: AuthorizationIdentity): RoleAssignment[] {
  if (actor.tenantId === null)
    return actor.roles.filter(({ role }) => role === 'QTNT');
  return [
    { role: 'NV', departmentIds: [] },
    ...actor.roles.filter(({ role }) => role !== 'NV' && role !== 'QTNT'),
  ];
}

function grantsFor(
  actor: AuthorizationIdentity,
  permission: Permission,
): Grant[] {
  if (
    actor.status === 'HANDOVER' &&
    !permission.startsWith('handover.') &&
    !permission.startsWith('session.')
  )
    return [];
  if (actor.status !== 'ACTIVE' && actor.status !== 'HANDOVER') return [];

  const rule: Partial<Record<Role, Scope>> & {
    manager?: 'tenant' | 'directReports';
    account?: 'account';
  } = matrix[permission];
  if (rule.account) return [{ scope: rule.account }];

  const grants: Grant[] = [];
  for (const { role, departmentIds } of effectiveRoles(actor)) {
    const scope = rule[role];
    if (scope === 'departments') {
      grants.push(
        departmentIds.length ? { scope, departmentIds } : { scope: 'tenant' },
      );
    } else if (scope) {
      grants.push({ scope });
    }
  }
  if (actor.tenantId !== null && actor.hasDirectReports && rule.manager) {
    grants.push({ scope: rule.manager });
  }

  const tenantGrant = grants.find(({ scope }) => scope === 'tenant');
  return tenantGrant ? [tenantGrant] : grants;
}

export function isDirectManager(
  actor: AuthorizationIdentity,
  context: PermissionContext,
) {
  return (
    actor.tenantId === context.tenantId &&
    context.employee !== undefined &&
    context.employee.id !== actor.id &&
    context.employee.managerId === actor.id
  );
}

export function isHandoverRecipient(
  actor: AuthorizationIdentity,
  context: PermissionContext,
) {
  return (
    actor.tenantId === context.tenantId && context.recipientId === actor.id
  );
}

export function can(
  actor: AuthorizationIdentity,
  permission: Permission,
  context?: PermissionContext,
) {
  if (context && context.tenantId !== actor.tenantId) return false;

  return grantsFor(actor, permission).some((grant) => {
    switch (grant.scope) {
      case 'account':
      case 'platform':
      case 'tenant':
        return true;
      case 'departments':
        return (
          !!context?.departmentIds?.length &&
          context.departmentIds.every(
            (id) => id !== null && grant.departmentIds.includes(id),
          )
        );
      case 'self':
        return context?.employee?.id === actor.id;
      case 'directReports':
        return !!context && isDirectManager(actor, context);
      case 'recipient':
        return !!context && isHandoverRecipient(actor, context);
      case 'knowledge':
        return context?.knowledgeVisible === true;
    }
  });
}

export function permissionProfile(actor: AuthorizationIdentity) {
  return (Object.keys(matrix) as Permission[]).flatMap((permission) =>
    grantsFor(actor, permission).map((grant) => ({ permission, ...grant })),
  );
}
