import { HttpException } from '@nestjs/common';
import type { UserEntity } from '../../users/user.entity';
import { RegistrationService } from './registration.service';

const meta = { ip: '198.51.100.7', userAgent: null };
const dto = {
  email: 'new@example.com',
  password: 'long-enough-password',
  locale: 'en-US' as const,
  acceptTerms: true as const,
  altcha: 'payload',
};

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'new@example.com',
    locale: 'de-CH',
    emailVerifiedAt: null,
    disabled: false,
    ...overrides,
  } as UserEntity;
}

function setup() {
  const repository = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneBy: jest.fn().mockResolvedValue(user()),
  };
  const manager = { getRepository: () => repository };
  const deps = {
    users: {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(user()),
      update: jest.fn(),
    },
    passwords: {
      assertAcceptable: jest.fn(),
      hash: jest.fn().mockResolvedValue('argon2id$hash'),
    },
    settings: { isRegistrationEnabled: jest.fn().mockResolvedValue(true) },
    altcha: { assertValid: jest.fn() },
    emailTokens: {
      issue: jest.fn().mockResolvedValue('token'),
      consume: jest.fn(),
      invalidateAll: jest.fn(),
    },
    mailer: {
      accountExists: jest.fn(),
      verifyEmail: jest.fn(),
      emailChanged: jest.fn(),
    },
    audit: { record: jest.fn() },
    dataSource: {
      transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
        work(manager),
      ),
    },
  };
  const service = new RegistrationService(
    deps.users as never,
    deps.passwords as never,
    deps.settings as never,
    deps.altcha as never,
    deps.emailTokens as never,
    deps.mailer as never,
    deps.audit as never,
    deps.dataSource as never,
  );
  return { service, repository, manager, ...deps };
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  const error = (await promise.catch(
    (caught: unknown) => caught,
  )) as HttpException;
  return (error.getResponse() as { errorCode: string }).errorCode;
}

describe('RegistrationService.register', () => {
  it('refuses while registration is disabled', async () => {
    const { service, settings, altcha } = setup();
    settings.isRegistrationEnabled.mockResolvedValue(false);

    expect(await errorCode(service.register(dto))).toBe(
      'REGISTRATION_DISABLED',
    );
    expect(altcha.assertValid).not.toHaveBeenCalled();
  });

  it('creates an unverified parent and sends the verification email', async () => {
    const { service, users, emailTokens, mailer, altcha, passwords } = setup();

    await service.register(dto);

    expect(altcha.assertValid).toHaveBeenCalledWith('payload');
    expect(passwords.assertAcceptable).toHaveBeenCalledWith(dto.password);
    expect(users.create).toHaveBeenCalledWith({
      email: dto.email,
      passwordHash: 'argon2id$hash',
      locale: 'en-US',
    });
    expect(emailTokens.issue).toHaveBeenCalledWith('user-1', 'registration');
    expect(mailer.verifyEmail).toHaveBeenCalledWith(
      { email: 'new@example.com', locale: 'de-CH' },
      'token',
    );
  });

  it('sends "account exists" for a known address and still hashes', async () => {
    const { service, users, mailer, passwords } = setup();
    users.findByEmail.mockResolvedValue(user({ email: 'Known@example.com' }));

    await service.register(dto);

    expect(passwords.hash).toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
    expect(mailer.accountExists).toHaveBeenCalledWith({
      email: 'Known@example.com',
      locale: 'en-US',
    });
  });

  it('treats a concurrent duplicate like an existing account', async () => {
    const { service, users, mailer } = setup();
    users.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );

    await service.register(dto);

    expect(mailer.accountExists).toHaveBeenCalledWith({
      email: dto.email,
      locale: 'en-US',
    });
  });

  it('rethrows other database errors', async () => {
    const { service, users } = setup();
    users.create.mockRejectedValue(new Error('db down'));

    await expect(service.register(dto)).rejects.toThrow('db down');
  });
});

describe('RegistrationService.resendVerification', () => {
  const resend = { email: 'new@example.com', altcha: 'payload' };

  it('resends for an unverified account', async () => {
    const { service, users, mailer } = setup();
    users.findByEmail.mockResolvedValue(user());

    await service.resendVerification(resend);

    expect(mailer.verifyEmail).toHaveBeenCalled();
  });

  it.each([
    ['unknown', null],
    ['verified', user({ emailVerifiedAt: new Date() })],
    ['disabled', user({ disabled: true })],
  ])('stays silent for an %s account', async (_name, found) => {
    const { service, users, mailer } = setup();
    users.findByEmail.mockResolvedValue(found);

    await service.resendVerification(resend);

    expect(mailer.verifyEmail).not.toHaveBeenCalled();
  });
});

describe('RegistrationService.resendForUser', () => {
  it('404s for an unknown user', async () => {
    const { service, users } = setup();
    users.findById.mockResolvedValue(null);

    expect(await errorCode(service.resendForUser('x'))).toBe('USER_NOT_FOUND');
  });

  it('sends only while unverified', async () => {
    const { service, users, mailer } = setup();
    users.findById.mockResolvedValueOnce(user());
    users.findById.mockResolvedValueOnce(user({ emailVerifiedAt: new Date() }));

    await service.resendForUser('user-1');
    await service.resendForUser('user-1');

    expect(mailer.verifyEmail).toHaveBeenCalledTimes(1);
  });
});

describe('RegistrationService.verifyEmail', () => {
  it('rejects an invalid token', async () => {
    const { service, emailTokens, manager } = setup();
    emailTokens.consume.mockResolvedValue(null);

    expect(await errorCode(service.verifyEmail('bad', meta))).toBe(
      'TOKEN_INVALID',
    );
    expect(emailTokens.consume).toHaveBeenCalledWith(
      'bad',
      ['registration', 'email_change'],
      manager,
    );
  });

  it('rejects a token of a deleted user', async () => {
    const { service, emailTokens, repository } = setup();
    emailTokens.consume.mockResolvedValue({
      userId: 'gone',
      type: 'registration',
    });
    repository.findOneBy.mockResolvedValue(null);

    expect(await errorCode(service.verifyEmail('tok', meta))).toBe(
      'TOKEN_INVALID',
    );
  });

  it('marks a registration as verified in the same transaction', async () => {
    const { service, emailTokens, repository, mailer } = setup();
    emailTokens.consume.mockResolvedValue({
      userId: 'user-1',
      type: 'registration',
      newEmail: null,
    });

    await expect(service.verifyEmail('tok', meta)).resolves.toBe(
      'registration',
    );
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { emailVerifiedAt: expect.any(Date) },
    );
    expect(mailer.emailChanged).not.toHaveBeenCalled();
  });

  it('keeps an earlier verification date', async () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    const { service, emailTokens, repository } = setup();
    repository.findOneBy.mockResolvedValue(
      user({ emailVerifiedAt: verifiedAt }),
    );
    emailTokens.consume.mockResolvedValue({
      userId: 'user-1',
      type: 'registration',
      newEmail: null,
    });

    await service.verifyEmail('tok', meta);

    expect(repository.update.mock.calls[0][1]).toEqual({
      emailVerifiedAt: verifiedAt,
    });
  });

  describe('email change', () => {
    const consumed = {
      userId: 'user-1',
      type: 'email_change',
      newEmail: 'next@example.com',
    };

    it('switches the address, invalidates tokens, audits and tells the old address', async () => {
      const { service, emailTokens, repository, manager, audit, mailer } =
        setup();
      emailTokens.consume.mockResolvedValue(consumed);

      await expect(service.verifyEmail('tok', meta)).resolves.toBe(
        'email_change',
      );
      expect(repository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { email: 'next@example.com', emailVerifiedAt: expect.any(Date) },
      );
      expect(emailTokens.invalidateAll).toHaveBeenCalledWith('user-1', manager);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.email_changed',
          targetId: 'user-1',
          ip: '198.51.100.7',
        }),
      );
      expect(mailer.emailChanged).toHaveBeenCalledWith({
        email: 'new@example.com',
        locale: 'de-CH',
      });
    });

    it('rejects when the new address was taken meanwhile', async () => {
      const { service, emailTokens, repository, mailer } = setup();
      emailTokens.consume.mockResolvedValue(consumed);
      repository.update.mockRejectedValue({ code: '23505' });

      expect(await errorCode(service.verifyEmail('tok', meta))).toBe(
        'TOKEN_INVALID',
      );
      expect(mailer.emailChanged).not.toHaveBeenCalled();
    });

    it('rethrows other errors', async () => {
      const { service, emailTokens, repository } = setup();
      emailTokens.consume.mockResolvedValue(consumed);
      repository.update.mockRejectedValue(new Error('db down'));

      await expect(service.verifyEmail('tok', meta)).rejects.toThrow('db down');
    });
  });
});
