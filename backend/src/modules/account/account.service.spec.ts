import type { ProgressExportService } from '../learning/progress/progress-export.service';
import { HttpException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service';
import type { PasswordService } from '../auth/passwords/password.service';
import type { AuthMailer } from '../auth/services/auth-mailer';
import type { EmailTokenService } from '../auth/services/email-token.service';
import type { SessionService } from '../auth/sessions/session.service';
import type { KidsService } from '../kids/kids.service';
import type { DataSource } from 'typeorm';
import { deleteUserIn } from '../users/user-deletion';
import type { UserGuardrail } from '../users/user-guardrail.service';
import { lastAdmin } from '../users/user-guardrail.service';
import { UserEntity } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { AccountService } from './account.service';

jest.mock('../users/user-deletion', () => ({
  deleteUserIn: jest.fn().mockResolvedValue(undefined),
}));

const auth = { userId: 'u1', familyId: 'fam1' };
const meta = { ip: '203.0.113.7', userAgent: 'test' };

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'u1',
    email: 'anna@example.com',
    passwordHash: 'argon2id$hash',
    role: 'parent',
    locale: 'de-CH',
    theme: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    totpEnabled: false,
    disabled: false,
    lastLoginAt: new Date('2026-02-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(current: UserEntity | null = user()) {
  const users = {
    findById: jest.fn().mockResolvedValue(current),
    findByEmail: jest.fn().mockResolvedValue(null),
    update: jest.fn((_id: string, changes: Partial<UserEntity>) =>
      Promise.resolve(current && { ...current, ...changes }),
    ),
  };
  const passwords = {
    verify: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('argon2id$new'),
    assertAcceptable: jest.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    revokeUserSessionsIn: jest.fn().mockResolvedValue(['fam2']),
    markRevoked: jest.fn().mockResolvedValue(undefined),
  };
  const emailTokens = {
    issue: jest.fn().mockResolvedValue('token-1'),
    invalidateAll: jest.fn().mockResolvedValue(undefined),
  };
  const manager = { update: jest.fn().mockResolvedValue({}) };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
  };
  const guardrail = {
    mutate: jest.fn(
      (
        _id: string,
        losesAdmin: (u: UserEntity) => boolean,
        mutation: (m: typeof manager, u: UserEntity) => unknown,
      ) => {
        if (current?.role === 'admin' && losesAdmin(current)) {
          return Promise.reject(lastAdmin());
        }
        return Promise.resolve(mutation(manager, current as UserEntity));
      },
    ),
  };
  const mailer = {
    passwordChanged: jest.fn().mockResolvedValue('queued'),
    emailChange: jest.fn().mockResolvedValue('queued'),
  };
  const kids = {
    list: jest
      .fn()
      .mockResolvedValue([{ id: 'k1', nickname: 'Zoë', hasPin: true }]),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const progressExport = {
    forKids: jest
      .fn()
      .mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map((kidId) => ({ kidId, levels: [] }))),
      ),
  };
  const service = new AccountService(
    users as unknown as UsersService,
    passwords as unknown as PasswordService,
    sessions as unknown as SessionService,
    emailTokens as unknown as EmailTokenService,
    mailer as unknown as AuthMailer,
    kids as unknown as KidsService,
    audit as unknown as AuditService,
    guardrail as unknown as UserGuardrail,
    dataSource as unknown as DataSource,
    progressExport as unknown as ProgressExportService,
  );
  return {
    service,
    progressExport,
    manager,
    guardrail,
    users,
    passwords,
    sessions,
    emailTokens,
    mailer,
    kids,
    audit,
  };
}

async function failure(promise: Promise<unknown>) {
  const error = (await promise.catch((e: unknown) => e)) as HttpException;
  expect(error).toBeInstanceOf(HttpException);
  return [
    error.getStatus(),
    (error.getResponse() as { errorCode: string }).errorCode,
  ];
}

describe('AccountService.changePassword', () => {
  const dto = {
    currentPassword: 'old-password',
    newPassword: 'new-password-1',
  };

  it('stores the hash, drops open email tokens and other sessions in one transaction', async () => {
    const {
      service,
      manager,
      sessions,
      emailTokens,
      audit,
      mailer,
      passwords,
    } = setup();

    await service.changePassword(auth, dto, meta);

    expect(passwords.assertAcceptable).toHaveBeenCalledWith('new-password-1');
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: 'u1' },
      { passwordHash: 'argon2id$new' },
    );
    expect(emailTokens.invalidateAll).toHaveBeenCalledWith('u1', manager);
    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      manager,
      'u1',
      'password_changed',
      'fam1',
    );
    expect(sessions.markRevoked).toHaveBeenCalledWith(['fam2']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_changed', ip: meta.ip }),
    );
    expect(mailer.passwordChanged).toHaveBeenCalledWith({
      email: 'anna@example.com',
      locale: 'de-CH',
    });
  });

  it('refuses a wrong current password with INVALID_CREDENTIALS', async () => {
    const { service, passwords, manager } = setup();
    passwords.verify.mockResolvedValue(false);

    await expect(
      failure(service.changePassword(auth, dto, meta)),
    ).resolves.toEqual([401, 'INVALID_CREDENTIALS']);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('refuses a deleted user', async () => {
    const { service } = setup(null);

    await expect(
      failure(service.changePassword(auth, dto, meta)),
    ).resolves.toEqual([401, 'UNAUTHORIZED']);
  });
});

describe('AccountService.requestEmailChange', () => {
  const dto = { newEmail: 'neu@example.com', password: 'pw' };

  it('sends a verification link to the new address', async () => {
    const { service, emailTokens, mailer } = setup();

    await service.requestEmailChange(auth, dto);

    expect(emailTokens.issue).toHaveBeenCalledWith(
      'u1',
      'email_change',
      'neu@example.com',
    );
    expect(mailer.emailChange).toHaveBeenCalledWith(
      { email: 'neu@example.com', locale: 'de-CH' },
      'token-1',
    );
  });

  it('does nothing visible when the address is taken', async () => {
    const { service, users, emailTokens, mailer } = setup();
    users.findByEmail.mockResolvedValue(user({ id: 'u2' }));

    await expect(
      service.requestEmailChange(auth, dto),
    ).resolves.toBeUndefined();
    expect(emailTokens.issue).not.toHaveBeenCalled();
    expect(mailer.emailChange).not.toHaveBeenCalled();
  });

  it('requires the password', async () => {
    const { service, passwords } = setup();
    passwords.verify.mockResolvedValue(false);

    await expect(
      failure(service.requestEmailChange(auth, dto)),
    ).resolves.toEqual([401, 'INVALID_CREDENTIALS']);
  });
});

describe('AccountService.updatePreferences', () => {
  it('updates locale and theme', async () => {
    const { service, users } = setup();

    const view = await service.updatePreferences('u1', {
      locale: 'en-US',
      theme: 'dark',
    });

    expect(users.update).toHaveBeenCalledWith('u1', {
      locale: 'en-US',
      theme: 'dark',
    });
    expect(view).toMatchObject({ locale: 'en-US', theme: 'dark' });
  });

  it('returns the user unchanged for an empty patch', async () => {
    const { service, users } = setup();

    await expect(service.updatePreferences('u1', {})).resolves.toMatchObject({
      id: 'u1',
    });
    expect(users.update).not.toHaveBeenCalled();
  });
});

describe('AccountService.export', () => {
  it('exports the user, kids and progress without secrets', async () => {
    const { service } = setup(user({ totpEnabled: true }));

    const data = await service.export('u1');

    expect(data.user).toMatchObject({
      id: 'u1',
      email: 'anna@example.com',
      lastLoginAt: '2026-02-01T00:00:00.000Z',
    });
    expect(data.kids).toHaveLength(1);
    expect(data.progress).toEqual([{ kidId: 'k1', levels: [] }]);
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const json = JSON.stringify(data);
    expect(json).not.toContain('argon2id');
    expect(json).not.toMatch(/passwordHash|pinHash|secret/i);
  });

  it('exports a missing last login as null', async () => {
    const { service } = setup(user({ lastLoginAt: null }));

    await expect(service.export('u1')).resolves.toMatchObject({
      user: { lastLoginAt: null },
    });
  });
});

describe('AccountService.delete', () => {
  beforeEach(() => (deleteUserIn as jest.Mock).mockClear());

  it('revokes and deletes through the guardrail and audits without PII', async () => {
    const { service, guardrail, manager, sessions, audit } = setup();

    await service.delete(auth, 'pw');

    expect(guardrail.mutate).toHaveBeenCalledWith(
      'u1',
      expect.any(Function),
      expect.any(Function),
    );
    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      manager,
      'u1',
      'deleted',
    );
    expect(deleteUserIn).toHaveBeenCalledWith(manager, 'u1');
    expect(sessions.markRevoked).toHaveBeenCalledWith(['fam2']);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'account.deleted',
      targetType: 'user',
    });
  });

  it('keeps the last active admin with 400 LAST_ADMIN', async () => {
    const { service, sessions } = setup(user({ role: 'admin' }));

    await expect(failure(service.delete(auth, 'pw'))).resolves.toEqual([
      400,
      'LAST_ADMIN',
    ]);
    expect(deleteUserIn).not.toHaveBeenCalled();
    expect(sessions.markRevoked).not.toHaveBeenCalled();
  });

  it('requires the password', async () => {
    const { service, passwords, guardrail } = setup();
    passwords.verify.mockResolvedValue(false);

    await expect(failure(service.delete(auth, 'bad'))).resolves.toEqual([
      401,
      'INVALID_CREDENTIALS',
    ]);
    expect(guardrail.mutate).not.toHaveBeenCalled();
  });
});
