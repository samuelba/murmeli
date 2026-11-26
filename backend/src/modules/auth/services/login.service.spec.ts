import { HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RetryAfterException } from '../../../common/errors/api-exception';
import type { UserEntity } from '../../users/user.entity';
import { COOKIE_TOTP } from '../auth.constants';
import { LoginService, accountKey, accountNetworkKey } from './login.service';

const meta = { ip: '203.0.113.9', userAgent: 'jest' };
const response = {} as Response;
const policies = {
  login: { name: 'login' },
  loginEmail: { name: 'login-email' },
  totp: { name: 'totp' },
};
const ALLOWED = { allowed: true, retryAfterSeconds: 0, justLocked: false };

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'parent@example.com',
    passwordHash: 'argon2id$hash',
    role: 'parent',
    disabled: false,
    totpEnabled: false,
    emailVerifiedAt: new Date(),
    ...overrides,
  } as UserEntity;
}

function setup() {
  const deps = {
    users: { findByEmail: jest.fn(), findById: jest.fn() },
    passwords: {
      verify: jest.fn().mockResolvedValue(true),
      verifyDummy: jest.fn().mockResolvedValue(false),
    },
    limiter: {
      attempt: jest.fn().mockResolvedValue(ALLOWED),
      succeed: jest.fn(),
    },
    issuer: { signIn: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    tokens: {
      verify: jest.fn(),
      sign: jest
        .fn()
        .mockReturnValue({ token: 'step', expiresAt: new Date(1) }),
      newTotpClaims: jest.fn().mockReturnValue({ sub: 'user-1', jti: 'j' }),
    },
    cookies: { set: jest.fn(), clear: jest.fn() },
    totp: {
      consumeCode: jest.fn(),
      checkWithLimit: jest.fn((_id: string, check: () => Promise<boolean>) =>
        check(),
      ),
    },
    recoveryCodes: { consume: jest.fn() },
    audit: { record: jest.fn() },
  };
  const service = new LoginService(
    deps.users as never,
    deps.passwords as never,
    deps.limiter as never,
    policies as never,
    deps.issuer as never,
    deps.tokens as never,
    deps.cookies as never,
    deps.totp as never,
    deps.recoveryCodes as never,
    deps.audit as never,
  );
  return { service, ...deps };
}

async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpException);
  return ((error as HttpException).getResponse() as { errorCode: string })
    .errorCode;
}

const dto = { email: 'Parent@Example.com ', password: 'secret-password' };

describe('login keys', () => {
  it('are case-insensitive and do not contain the address', () => {
    expect(accountKey('A@B.ch')).toBe(accountKey(' a@b.ch'));
    expect(accountKey('a@b.ch')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('bind the strict key to the client network', () => {
    expect(accountNetworkKey('a@b.ch', '2001:db8:1:2:3::1')).toBe(
      accountNetworkKey('A@b.ch', '2001:db8:1:2:ffff::9'),
    );
    expect(accountNetworkKey('a@b.ch', '203.0.113.1')).not.toBe(
      accountNetworkKey('a@b.ch', '203.0.113.2'),
    );
    expect(accountNetworkKey('a@b.ch', null)).not.toBe(accountKey('a@b.ch'));
  });
});

describe('LoginService.login', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reserves an attempt per address and network and per address', async () => {
    const { service, users, limiter } = setup();
    users.findByEmail.mockResolvedValue(user());

    await service.login(dto, meta, response);

    expect(limiter.attempt).toHaveBeenCalledWith(
      policies.login,
      accountNetworkKey(dto.email, meta.ip),
    );
    expect(limiter.attempt).toHaveBeenCalledWith(
      policies.loginEmail,
      accountKey(dto.email),
    );
  });

  it.each([
    ['the address and network', 0],
    ['the address overall', 1],
  ])(
    'refuses before checking the password when %s is locked',
    async (_n, i) => {
      const { service, limiter, users, passwords } = setup();
      const locked = {
        allowed: false,
        retryAfterSeconds: 90,
        justLocked: false,
      };
      limiter.attempt
        .mockResolvedValueOnce(i === 0 ? locked : ALLOWED)
        .mockResolvedValueOnce(i === 1 ? locked : ALLOWED);

      const error = await service
        .login(dto, meta, response)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RetryAfterException);
      expect((error as RetryAfterException).retryAfterSeconds).toBe(90);
      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(passwords.verify).not.toHaveBeenCalled();
    },
  );

  it('logs and audits when the per-address ceiling locks', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, limiter, audit } = setup();
    limiter.attempt.mockResolvedValueOnce(ALLOWED).mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 3600,
      justLocked: true,
    });

    await expect(service.login(dto, meta, response)).rejects.toBeInstanceOf(
      RetryAfterException,
    );
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).not.toContain('example.com');
    expect(audit.record).toHaveBeenCalledWith({
      action: 'auth.login_failed',
      ip: meta.ip,
      meta: { lockedAddress: true },
    });
  });

  it('hashes a dummy password for an unknown address', async () => {
    const { service, users, passwords, limiter, audit } = setup();
    users.findByEmail.mockResolvedValue(null);

    expect(await errorCode(service.login(dto, meta, response))).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(passwords.verifyDummy).toHaveBeenCalledWith('secret-password');
    expect(limiter.succeed).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed', actorId: null }),
    );
    expect(audit.record.mock.calls[0][0]).not.toHaveProperty('targetId');
  });

  it('rejects a wrong password with the same code', async () => {
    const { service, users, passwords, audit } = setup();
    users.findByEmail.mockResolvedValue(user());
    passwords.verify.mockResolvedValue(false);

    expect(await errorCode(service.login(dto, meta, response))).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      actorId: 'user-1',
      targetType: 'user',
      targetId: 'user-1',
    });
  });

  it('reports a disabled account only after a correct password', async () => {
    const { service, users } = setup();
    users.findByEmail.mockResolvedValue(user({ disabled: true }));

    expect(await errorCode(service.login(dto, meta, response))).toBe(
      'ACCOUNT_DISABLED',
    );
  });

  it('reports an unverified address after a correct password', async () => {
    const { service, users } = setup();
    users.findByEmail.mockResolvedValue(user({ emailVerifiedAt: null }));

    expect(await errorCode(service.login(dto, meta, response))).toBe(
      'EMAIL_NOT_VERIFIED',
    );
  });

  it('starts the TOTP step when TOTP is enabled', async () => {
    const { service, users, tokens, cookies, issuer } = setup();
    users.findByEmail.mockResolvedValue(user({ totpEnabled: true }));

    await expect(service.login(dto, meta, response)).resolves.toEqual({
      totpRequired: true,
    });
    expect(tokens.sign).toHaveBeenCalledWith(
      'totp',
      { sub: 'user-1', jti: 'j' },
      300,
    );
    expect(cookies.set).toHaveBeenCalledWith(
      response,
      COOKIE_TOTP,
      'step',
      new Date(1),
    );
    expect(issuer.signIn).not.toHaveBeenCalled();
  });

  it('signs the user in and gives both reserved attempts back', async () => {
    const { service, users, limiter, issuer } = setup();
    users.findByEmail.mockResolvedValue(user());

    await expect(service.login(dto, meta, response)).resolves.toEqual({
      user: { id: 'user-1' },
    });
    expect(limiter.succeed).toHaveBeenCalledWith(
      policies.login,
      accountNetworkKey(dto.email, meta.ip),
    );
    expect(limiter.succeed).toHaveBeenCalledWith(
      policies.loginEmail,
      accountKey(dto.email),
    );
    expect(issuer.signIn).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ id: 'user-1' }),
      meta,
      'password',
    );
  });
});

describe('LoginService.verifyTotp', () => {
  const request = { cookies: { [COOKIE_TOTP]: 'step' } } as unknown as Request;
  const claims = { sub: 'user-1', jti: 'jti-1', exp: 1 };

  function withStep() {
    const deps = setup();
    deps.tokens.verify.mockReturnValue(claims);
    deps.users.findById.mockResolvedValue(user({ totpEnabled: true }));
    return deps;
  }

  it('rejects a missing or invalid step cookie', async () => {
    const { service, tokens } = setup();
    tokens.verify.mockReturnValue(null);

    expect(
      await errorCode(
        service.verifyTotp({ code: '123456' }, meta, request, response),
      ),
    ).toBe('TOTP_INVALID');
  });

  it('rejects a step that used up its attempts and clears it', async () => {
    const { service, limiter, cookies, users } = withStep();
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
      justLocked: true,
    });

    await expect(
      service.verifyTotp({ code: '123456' }, meta, request, response),
    ).rejects.toBeInstanceOf(RetryAfterException);
    expect(limiter.attempt).toHaveBeenCalledWith(policies.totp, 'jti-1');
    expect(cookies.clear).toHaveBeenCalledWith(response, COOKIE_TOTP);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown user', null],
    ['a disabled user', user({ disabled: true, totpEnabled: true })],
    ['a user without TOTP', user({ totpEnabled: false })],
  ])('rejects %s', async (_name, found) => {
    const { service, users, totp } = withStep();
    users.findById.mockResolvedValue(found);

    expect(
      await errorCode(
        service.verifyTotp({ code: '123456' }, meta, request, response),
      ),
    ).toBe('TOTP_INVALID');
    expect(totp.checkWithLimit).not.toHaveBeenCalled();
  });

  it('signs in with a valid TOTP code under the per-user limit', async () => {
    const { service, totp, issuer } = withStep();
    totp.consumeCode.mockResolvedValue(true);

    await expect(
      service.verifyTotp({ code: '123456' }, meta, request, response),
    ).resolves.toEqual({ user: { id: 'user-1' } });
    expect(totp.checkWithLimit).toHaveBeenCalledWith(
      'user-1',
      expect.any(Function),
    );
    expect(totp.consumeCode).toHaveBeenCalledWith('user-1', '123456', true);
    expect(issuer.signIn).toHaveBeenCalledWith(
      response,
      expect.anything(),
      meta,
      'totp',
    );
  });

  it('signs in with a recovery code', async () => {
    const { service, recoveryCodes, issuer } = withStep();
    recoveryCodes.consume.mockResolvedValue(true);

    await service.verifyTotp(
      { recoveryCode: 'ABCD-EFGH-JKLM' },
      meta,
      request,
      response,
    );

    expect(recoveryCodes.consume).toHaveBeenCalledWith(
      'user-1',
      'ABCD-EFGH-JKLM',
    );
    expect(issuer.signIn.mock.calls[0][3]).toBe('recovery_code');
  });

  it('rejects a wrong code', async () => {
    const { service, totp, issuer } = withStep();
    totp.consumeCode.mockResolvedValue(false);

    expect(
      await errorCode(
        service.verifyTotp({ code: '000000' }, meta, request, response),
      ),
    ).toBe('TOTP_INVALID');
    expect(issuer.signIn).not.toHaveBeenCalled();
  });

  it('passes the per-user lock through', async () => {
    const { service, totp } = withStep();
    totp.checkWithLimit.mockRejectedValue(new RetryAfterException(900));

    await expect(
      service.verifyTotp({ code: '000000' }, meta, request, response),
    ).rejects.toBeInstanceOf(RetryAfterException);
  });

  it('treats an empty code as a wrong one', async () => {
    const { service, totp } = withStep();
    totp.consumeCode.mockResolvedValue(false);

    await errorCode(service.verifyTotp({}, meta, request, response));

    expect(totp.consumeCode).toHaveBeenCalledWith('user-1', '', true);
  });
});
