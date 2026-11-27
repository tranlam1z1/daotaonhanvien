import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { type AuthCredentialKind, type User } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';
import { TenantDatabase } from '../tenant/tenant-database';
import { AuthMailer } from './auth-mailer';
import {
  authPolicy,
  checkPassword,
  digest,
  invalidLink,
  invalidLogin,
  invalidSession,
  isSecret,
  loginIdentifier,
  newSecret,
} from './auth-policy';

import type { SessionIdentity } from './permissions';

type Identity = Pick<User, 'id' | 'tenantId'>;
type AccountUser = User & { tenantName: string | null };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(TenantDatabase) private readonly database: TenantDatabase,
    @Inject(AuthMailer) private readonly mailer: AuthMailer,
  ) {}

  async login(
    input: string,
    password: string,
    companyCode: string,
    ip?: string,
  ) {
    const identity = await this.findIdentity(input, companyCode);
    if (!identity || !password) throw new UnauthorizedException(invalidLogin);

    const token = await this.database.runAuth(identity.tenantId, async () => {
      const user = await this.lockUser(identity);
      if (
        !user ||
        !this.canSignIn(user) ||
        (user.lockedUntil?.getTime() ?? 0) > Date.now()
      )
        return null;

      if (!(await verify(user.passwordHash, password))) {
        const failedLogins = (user.lockedUntil ? 0 : user.failedLogins) + 1;
        await this.client.user.update({
          where: { id: user.id },
          data: {
            failedLogins,
            lockedUntil:
              failedLogins >= authPolicy.loginAttempts
                ? new Date(Date.now() + authPolicy.lockMs)
                : null,
          },
        });
        return null;
      }

      const now = Date.now();
      await this.client.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
      await this.client.authCredential.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date(now) } },
      });
      const token = await this.createCredential(
        identity,
        'SESSION',
        now + authPolicy.sessionIdleMs,
      );
      await this.audit(identity, 'LOGIN', ip);
      return token;
    });

    // Throw outside the transaction so the failed-attempt update commits.
    if (!token) throw new UnauthorizedException(invalidLogin);
    return token;
  }

  async requestReset(email: string, companyCode: string) {
    const input = loginIdentifier(email);
    if (!input || input.byPhone) return;
    const identity = await this.findIdentity(email, companyCode);
    if (identity) await this.issueEmail(identity, 'RESET');
  }

  async invite(email: string, companyCode: string) {
    const input = loginIdentifier(email);
    if (!input || input.byPhone) return false;
    const identity = await this.findIdentity(email, companyCode);
    return identity ? this.issueEmail(identity, 'INVITE') : false;
  }

  invitePendingAccount(id: string, tenantId: string) {
    return this.issueEmail({ id, tenantId }, 'INVITE');
  }

  async setPassword(
    token: string,
    password: string,
    kind: 'RESET' | 'INVITE',
    ip?: string,
  ) {
    checkPassword(password);
    await this.withCredential(token, kind, async (user) => {
      await this.replacePassword(user.id, password, kind === 'INVITE');
      if (kind === 'INVITE' && user.status === 'PENDING')
        await this.audit(user, 'ACTIVATE_USER', ip);
    });
  }

  async authenticate(token: string): Promise<SessionIdentity> {
    return this.withCredential(
      token,
      'SESSION',
      async (user, secretDigest, now) => {
        await this.client.authCredential.update({
          where: { digest: secretDigest },
          data: { expiresAt: new Date(now + authPolicy.sessionIdleMs) },
        });
        const { id, tenantId, status } = user;
        await this.client
          .$queryRaw`SELECT set_config('app.auth_user_id', ${id}, true)`;
        const roles = await this.client.userRole.findMany({
          where: { userId: id, tenantId, deletedAt: null },
          select: { role: true, departmentIds: true },
          orderBy: { role: 'asc' },
        });
        const directReport =
          tenantId &&
          (await this.client.user.findFirst({
            where: {
              tenantId,
              managerId: id,
              id: { not: id },
              deletedAt: null,
            },
            select: { id: true },
          }));
        return {
          id,
          tenantId,
          status,
          roles,
          hasDirectReports: !!directReport,
          profile: {
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            tenantName: user.tenantName,
          },
        };
      },
    );
  }

  async logoutAll(token: string) {
    await this.withCredential(token, 'SESSION', async (user) => {
      await this.client.authCredential.deleteMany({
        where: { userId: user.id, kind: 'SESSION' },
      });
    });
  }

  async changePassword(token: string, current: string, password: string) {
    checkPassword(password);
    await this.withCredential(token, 'SESSION', async (user) => {
      if (!current || !(await verify(user.passwordHash, current))) {
        throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
      }
      await this.replacePassword(user.id, password);
    });
  }

  private get client() {
    return this.database.client;
  }

  private async replacePassword(
    userId: string,
    password: string,
    activate = false,
  ) {
    const passwordHash = await hash(password, { type: argon2id });
    await this.client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        ...(activate ? { status: 'ACTIVE', invitationRequired: false } : {}),
      },
    });
    await this.client.authCredential.deleteMany({ where: { userId } });
  }

  private async findIdentity(value: string, companyCode: string) {
    const input = loginIdentifier(value);
    if (!input) return null;
    const rows = await this.database.runAuth(
      null,
      () =>
        this.client.$queryRaw<
          Identity[]
        >`SELECT * FROM public.auth_find_identity(${input.identifier}, ${input.byPhone}, ${companyCode.trim() || null})`,
    );
    return rows.length === 1 ? rows[0] : null;
  }

  private async lockUser(identity: Identity) {
    // All credential changes lock the account first, including consumption and revocation.
    const [locked] = await this.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${identity.id}::uuid AND deleted_at IS NULL FOR UPDATE
    `;
    if (!locked) return null;
    const user = await this.client.user.findUniqueOrThrow({
      where: { id: locked.id },
    });
    let tenantName: string | null = null;
    if (user.tenantId) {
      const tenant = await this.client.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!tenant || tenant.deletedAt || tenant.status !== 'ACTIVE')
        return null;
      tenantName = tenant.name;
    }
    return { ...user, tenantName };
  }

  private canSignIn(user: User) {
    return (
      !user.invitationRequired &&
      (user.status === 'ACTIVE' || user.status === 'HANDOVER')
    );
  }

  private canSetInitialPassword(user: User) {
    return user.invitationRequired
      ? user.status === 'ACTIVE'
      : user.status === 'PENDING';
  }

  private async withCredential<T>(
    token: string,
    kind: AuthCredentialKind,
    work: (user: AccountUser, secretDigest: string, now: number) => Promise<T>,
  ): Promise<T> {
    const message = kind === 'SESSION' ? invalidSession : invalidLink;
    if (!isSecret(token)) throw new UnauthorizedException(message);
    const secretDigest = digest(token);
    const [identity] = await this.database.runAuth(
      null,
      () =>
        this.client.$queryRaw<
          Identity[]
        >`SELECT * FROM public.auth_find_credential(${secretDigest}, ${kind}::public."AuthCredentialKind")`,
    );
    if (!identity) throw new UnauthorizedException(message);

    return this.database.runAuth(identity.tenantId, async () => {
      const user = await this.lockUser(identity);
      const credential = await this.client.authCredential.findUnique({
        where: { digest: secretDigest },
      });
      const now = Date.now();
      if (
        !user ||
        !credential ||
        credential.userId !== user.id ||
        credential.kind !== kind ||
        credential.expiresAt.getTime() <= now ||
        (kind === 'INVITE'
          ? !this.canSetInitialPassword(user)
          : !this.canSignIn(user))
      ) {
        throw new UnauthorizedException(message);
      }
      return work(user, secretDigest, now);
    });
  }

  private async issueEmail(identity: Identity, kind: 'RESET' | 'INVITE') {
    const message = await this.database.runAuth(identity.tenantId, async () => {
      const user = await this.lockUser(identity);
      if (
        !user ||
        (kind === 'INVITE'
          ? !this.canSetInitialPassword(user)
          : !this.canSignIn(user))
      )
        return null;

      const now = new Date();
      await this.client.authCredential.deleteMany({
        where: { userId: user.id, kind, expiresAt: { lte: now } },
      });
      const ttl =
        kind === 'INVITE' ? authPolicy.invitationMs : authPolicy.resetMs;
      const token = await this.createCredential(
        identity,
        kind,
        now.getTime() + ttl,
      );
      return { to: user.email, token };
    });
    if (!message) return false;

    try {
      await this.mailer.send(message.to, kind, message.token);
      return true;
    } catch {
      this.logger.warn('Authentication email could not be sent');
      await this.database.runAuth(identity.tenantId, () =>
        this.client.authCredential.deleteMany({
          where: { digest: digest(message.token) },
        }),
      );
      return false;
    }
  }

  private async createCredential(
    identity: Identity,
    kind: AuthCredentialKind,
    expiresAt: number,
  ) {
    const token = newSecret();
    await this.client.authCredential.create({
      data: {
        digest: digest(token),
        userId: identity.id,
        tenantId: identity.tenantId,
        kind,
        expiresAt: new Date(expiresAt),
      },
    });
    return token;
  }

  private async audit(identity: Identity, action: string, ip?: string) {
    await this.client.auditLog.create({
      data: {
        tenantId: identity.tenantId,
        userId: identity.id,
        objectType: 'User',
        objectId: identity.id,
        action,
        ip,
      },
      select: { id: true },
    });
  }
}
