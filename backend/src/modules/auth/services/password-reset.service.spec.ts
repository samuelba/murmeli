import { HttpException } from '@nestjs/common';
import type { UserEntity } from '../../users/user.entity';
import { PasswordResetService } from './password-reset.service';

const meta = { ip: '192.0.2.1', userAgent: null };

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'parent@example.com',
    locale: 'de-CH',
    disabled: false,
    emailVerifiedAt: null,
    ...overrides,
  } as UserEntity;
}

function setup() {
  const deps = {
    users: { findByEmail: jest.fn(), findById: jest.fn(), update: jest.fn() },
    passwords: {
      assertAcceptable: jest.fn(),
      hash: jest.fn().mockResolvedValue('argon2id$new'),
    },
    altcha: { assertValid: jest.fn() },
    emailTokens: {
      issue: jest.fn().mockResolvedValue('reset-token'),
      consume: jest.fn(),
      invalidateAll: jest.fn(),
    },
    mailer: { passwordReset: jest.fn(), passwordChanged: jest.fn() },
    sessions: {
      revokeUserSessionsIn: jest.fn().mockResolvedValue(['fam-1']),
      markRevoked: jest.fn(),
    },
    audit: { record: jest.fn() },
  };
  const managerRepo = { findOneBy: jest.fn(), update: jest.fn() };
  const manager = { getRepository: () => managerRepo };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const service = new PasswordResetService(
    deps.users as never,
    deps.passwords as never,
    deps.altcha as never,
    deps.emailTokens as never,
    deps.mailer as never,
    deps.sessions as never,
    deps.audit as never,
    dataSource as never,
  );
  return { service, managerRepo, manager, dataSource, ...deps };
}

describe('PasswordResetService.requestReset', () => {
  const dto = { email: 'parent@example.com', altcha: 'payload' };

  it('checks ALTCHA and mails a reset link to an active account', async () => {
    const { service, users, altcha, emailTokens, mailer } = setup();
    users.findByEmail.mockResolvedValue(user());

    await service.requestReset(dto);

    expect(altcha.assertValid).toHaveBeenCalledWith('payload');
    expect(emailTokens.issue).toHaveBeenCalledWith('user-1', 'password_reset');
    expect(mailer.passwordReset).toHaveBeenCalledWith(
      { email: 'parent@example.com', locale: 'de-CH' },
      'reset-token',
    );
  });

  it.each([
    ['an unknown', null],
    ['a disabled', user({ disabled: true })],
  ])('stays silent for %s account', async (_name, found) => {
    const { service, users, mailer } = setup();
    users.findByEmail.mockResolvedValue(found);

    await service.requestReset(dto);

    expect(mailer.passwordReset).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.reset', () => {
  const dto = { token: 'reset-token', password: 'a-new-long-password' };

  it.each([
    ['an invalid token', null, null],
    ['a deleted user', { userId: 'user-1' }, null],
    ['a disabled user', { userId: 'user-1' }, user({ disabled: true })],
  ])('rejects %s with TOKEN_INVALID', async (_name, consumed, found) => {
    const { service, emailTokens, managerRepo, sessions } = setup();
    emailTokens.consume.mockResolvedValue(consumed);
    managerRepo.findOneBy.mockResolvedValue(found);

    const error = (await service
      .reset(dto, meta)
      .catch((e: unknown) => e)) as HttpException;

    expect(error.getResponse()).toMatchObject({ errorCode: 'TOKEN_INVALID' });
    expect(managerRepo.update).not.toHaveBeenCalled();
    expect(sessions.markRevoked).not.toHaveBeenCalled();
  });

  it('applies the reset in one transaction and signs out everywhere', async () => {
    const {
      service,
      passwords,
      emailTokens,
      managerRepo,
      manager,
      sessions,
      audit,
      mailer,
    } = setup();
    emailTokens.consume.mockResolvedValue({ userId: 'user-1' });
    managerRepo.findOneBy.mockResolvedValue(user());

    await service.reset(dto, meta);

    expect(passwords.assertAcceptable).toHaveBeenCalledWith(dto.password);
    expect(emailTokens.consume).toHaveBeenCalledWith(
      'reset-token',
      ['password_reset'],
      manager,
    );
    expect(managerRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { passwordHash: 'argon2id$new', emailVerifiedAt: expect.any(Date) },
    );
    expect(emailTokens.invalidateAll).toHaveBeenCalledWith('user-1', manager);
    expect(sessions.revokeUserSessionsIn).toHaveBeenCalledWith(
      manager,
      'user-1',
      'password_reset',
    );
    expect(sessions.markRevoked).toHaveBeenCalledWith(['fam-1']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password_reset',
        ip: '192.0.2.1',
      }),
    );
    expect(mailer.passwordChanged).toHaveBeenCalledWith({
      email: 'parent@example.com',
      locale: 'de-CH',
    });
  });

  it('keeps an existing verification date', async () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    const { service, emailTokens, managerRepo } = setup();
    emailTokens.consume.mockResolvedValue({ userId: 'user-1' });
    managerRepo.findOneBy.mockResolvedValue(
      user({ emailVerifiedAt: verifiedAt }),
    );

    await service.reset(dto, meta);

    expect(managerRepo.update.mock.calls[0][1]).toMatchObject({
      emailVerifiedAt: verifiedAt,
    });
  });
});
