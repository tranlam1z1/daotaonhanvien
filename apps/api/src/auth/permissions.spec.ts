import type { Role } from '@prisma/client';
import {
  can,
  effectiveRoles,
  isDirectManager,
  isHandoverRecipient,
  permissionProfile,
  type AuthorizationIdentity,
  type Permission,
} from './permissions';

const tenantId = 'tenant-a';
const departmentId = 'training';
const actor = (
  role: Role,
  hasDirectReports = false,
): AuthorizationIdentity => ({
  id: 'actor',
  tenantId: role === 'QTNT' ? null : tenantId,
  status: 'ACTIVE',
  roles: [
    {
      role,
      departmentIds: ['PTDT', 'PD'].includes(role) ? [departmentId] : [],
    },
  ],
  hasDirectReports,
});

const staff = {
  tenantId,
  departmentIds: [departmentId],
  employee: { id: 'staff', managerId: 'actor' },
  recipientId: 'actor',
  knowledgeVisible: true,
};

const cases: [Permission, ...boolean[]][] = [
  ['platform.manage', true, false, false, false, false, false],
  ['platform.report.summary', true, false, false, false, false, false],
  ['organization.read', false, true, true, true, true, false],
  ['organization.manage', false, true, false, false, false, false],
  ['employees.manage', false, true, false, false, false, false],
  ['content.edit', false, true, true, false, false, false],
  ['content.approve', false, true, false, true, false, false],
  ['templates.apply', false, true, true, false, false, false],
  ['assignments.manage', false, true, true, false, false, false],
  ['assessments.manage', false, true, true, false, false, false],
  ['learning.use', false, true, true, true, true, true],
  ['knowledge.read', false, true, true, true, true, true],
  ['practice.confirm', false, true, false, false, true, false],
  ['training.report', false, true, true, false, true, false],
  ['handover.start', false, true, false, false, true, false],
  ['handover.prepare', false, true, false, false, true, false],
  ['handover.complete', false, true, false, false, true, false],
  ['handover.receive', false, true, true, true, true, true],
];

describe('D-01 / NFR-03 authorization matrix', () => {
  it.each(cases)(
    '%s allows QTNT, ADM, PTDT, PD, direct manager and NV as specified',
    (permission, ...allowed) => {
      const actors = [
        actor('QTNT'),
        actor('ADM'),
        actor('PTDT'),
        actor('PD'),
        actor('NV', true),
        actor('NV'),
      ];
      expect(
        actors.map((user) =>
          can(user, permission, user.tenantId ? staff : undefined),
        ),
      ).toEqual(allowed);
    },
  );

  it('requires the entire target scope for a scoped right and treats empty assignments as tenant-wide', () => {
    const trainer = actor('PTDT');
    expect(can(trainer, 'content.edit')).toBe(false);
    for (const departmentIds of [
      [],
      ['other'],
      [departmentId, 'other'],
      [departmentId, null],
    ]) {
      expect(can(trainer, 'content.edit', { ...staff, departmentIds })).toBe(
        false,
      );
    }
    trainer.roles[0].departmentIds = [];
    expect(
      can(trainer, 'content.edit', { ...staff, departmentIds: [null] }),
    ).toBe(true);
    expect(
      can(trainer, 'content.edit', { ...staff, tenantId: 'tenant-b' }),
    ).toBe(false);
    expect(
      can(actor('ADM'), 'content.edit', { ...staff, tenantId: 'tenant-b' }),
    ).toBe(false);
  });

  it('combines independent assignments without sharing their department scopes', () => {
    const user = actor('PTDT');
    user.roles.push({ role: 'PD', departmentIds: ['quality'] });
    expect(effectiveRoles(user).map(({ role }) => role)).toEqual([
      'NV',
      'PTDT',
      'PD',
    ]);
    expect(can(user, 'content.edit', staff)).toBe(true);
    expect(can(user, 'content.approve', staff)).toBe(false);
    expect(
      can(user, 'content.approve', { ...staff, departmentIds: ['quality'] }),
    ).toBe(true);
  });

  it('resolves own, direct manager, recipient, and knowledge scope from the target', () => {
    const user = actor('NV', true);
    const self = { tenantId, employee: { id: user.id, managerId: null } };
    const indirect = {
      tenantId,
      employee: { id: 'indirect', managerId: 'staff' },
    };
    expect(can(user, 'training.report', self)).toBe(true);
    expect(can(user, 'handover.prepare', self)).toBe(true);
    expect(can(user, 'handover.complete', indirect)).toBe(false);
    expect(isDirectManager(user, { ...staff, tenantId: 'tenant-b' })).toBe(
      false,
    );
    expect(isDirectManager(user, staff)).toBe(true);
    expect(isHandoverRecipient(user, staff)).toBe(true);
    expect(
      can(user, 'handover.receive', { ...staff, recipientId: 'staff' }),
    ).toBe(false);
    expect(
      can(user, 'handover.receive', { ...staff, tenantId: 'tenant-b' }),
    ).toBe(false);
    expect(can(user, 'knowledge.read', { tenantId })).toBe(true);
    expect(can(actor('NV'), 'knowledge.read', { tenantId })).toBe(false);
  });

  it('limits handover status to handover and account permissions', () => {
    const user = { ...actor('ADM'), status: 'HANDOVER' as const };
    expect(can(user, 'handover.prepare', staff)).toBe(true);
    expect(can(user, 'session.logoutAll')).toBe(true);
    expect(can(user, 'learning.use', staff)).toBe(false);
    expect(can(user, 'employees.manage', staff)).toBe(false);
    expect(
      permissionProfile(user).every(({ permission }) =>
        /^(handover|session)\./.test(permission),
      ),
    ).toBe(true);
  });
});
