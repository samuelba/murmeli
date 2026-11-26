import { HttpException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { AuthMailer } from '../auth/services/auth-mailer';
import type { EmailTokenService } from '../auth/services/email-token.service';
import type { UserEntity } from '../users/user.entity';
import { AdminRecoveryService } from './admin-recovery.service';
import type { AdminUsersService } from './admin-users.service';

const ADMIN_ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc652d';
const USER_ID = '01a218d7-5edc-7a87-a1d4-5fe46ddc6530';
const actor = { userId: ADMIN_ID, ip: '203.0.113.1' };
const EXPIRES = new Date('2026-11-26T13:00:00.000Z');

function user(overrides: Partial<UserEntity> = {}): Partial<UserEntity> {
  return { id: USER_ID, disabled: false, emailVerifiedAt: null, ...overrides };
}

function setup(target: Partial<UserEntity> | null = user()) {
  const repository = {
    findOneBy: jest.fn().mockResolvedValue(target),
    findOne: jest.fn().mockResolvedValue(target),
    update: jest.fn().mockResolvedValue({}),
  };
  const manager = { getRepository: () => repository };
  const dataSource = {
    getRepository: () => repository,
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
  };
  const emailTokens = {
    issueWithExpiry: jest
      .fn()
      .mockResolvedValue({ token: 'tok', expiresAt: EXPIRES }),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
  const mailer = {
    passwordResetUrl: jest.fn(
      (token: string) =>
        `https://murmeli.example.com/reset-password?token=${token}`,
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const adminUsers = {
    view: jest.fn().mockResolvedValue({ id: USER_ID, emailVerified: true }),
  };
  const service = new AdminRecoveryService(
    dataSource as unknown as DataSource,
    emailTokens as unknown as EmailTokenService,
    mailer as unknown as AuthMailer,
    audit as unknown as AuditService,
    adminUsers as unknown as AdminUsersService,
  );
  return { service, repository, manager, emailTokens, audit, adminUsers };
}

async function failure(promise: Promise<unknown>) {
  const error = (await promise.catch((e: unknown) => e)) as HttpException;
  expect(error).toBeInstanceOf(HttpException);
  return [
    error.getStatus(),
    (error.getResponse() as { errorCode: string }).errorCode,
  ];
}

describe('AdminRecoveryService.passwordResetLink', () => {
  it('issues a reset token without email and audits it without the token', async () => {
    const { service, emailTokens, audit } = setup();

    await expect(service.passwordResetLink(actor, USER_ID)).resolves.toEqual({
      resetUrl: 'https://murmeli.example.com/reset-password?token=tok',
      expiresAt: '2026-11-26T13:00:00.000Z',
    });

    expect(emailTokens.issueWithExpiry).toHaveBeenCalledWith(
      USER_ID,
      'password_reset',
    );
    expect(audit.record).toHaveBeenCalledWith({
      action: 'admin.password_reset_link_created',
      actorId: ADMIN_ID,
      targetType: 'user',
      targetId: USER_ID,
      ip: actor.ip,
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('tok');
  });

  it('rejects an unknown user', async () => {
    const { service, emailTokens } = setup(null);

    expect(await failure(service.passwordResetLink(actor, USER_ID))).toEqual([
      404,
      'USER_NOT_FOUND',
    ]);
    expect(emailTokens.issueWithExpiry).not.toHaveBeenCalled();
  });

  it('rejects a disabled user, whose link could not be used', async () => {
    const { service, emailTokens } = setup(user({ disabled: true }));

    expect(await failure(service.passwordResetLink(actor, USER_ID))).toEqual([
      409,
      'USER_DISABLED',
    ]);
    expect(emailTokens.issueWithExpiry).not.toHaveBeenCalled();
  });
});

describe('AdminRecoveryService.verifyEmail', () => {
  it('marks the address verified, drops open verification links and audits', async () => {
    const { service, repository, manager, emailTokens, audit, adminUsers } =
      setup();

    await expect(service.verifyEmail(actor, USER_ID)).resolves.toEqual({
      id: USER_ID,
      emailVerified: true,
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: USER_ID },
      lock: { mode: 'pessimistic_write' },
    });
    expect(repository.update).toHaveBeenCalledWith(
      { id: USER_ID },
      { emailVerifiedAt: expect.any(Date) },
    );
    expect(emailTokens.invalidate).toHaveBeenCalledWith(
      USER_ID,
      'registration',
      manager,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.email_verified',
        targetId: USER_ID,
      }),
    );
    expect(adminUsers.view).toHaveBeenCalledWith(USER_ID);
  });

  it('changes and audits nothing for a verified address', async () => {
    const { service, repository, audit } = setup(
      user({ emailVerifiedAt: new Date() }),
    );

    await service.verifyEmail(actor, USER_ID);

    expect(repository.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    const { service } = setup(null);

    expect(await failure(service.verifyEmail(actor, USER_ID))).toEqual([
      404,
      'USER_NOT_FOUND',
    ]);
  });
});
