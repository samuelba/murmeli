import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RetryAfterException } from '../../common/errors/api-exception';
import type { AuditService } from '../audit/audit.service';
import type { AuthCookies } from '../auth/cookies/auth-cookies';
import type { AttemptLimiter } from '../auth/limits/attempt-limiter.service';
import type { LimitPolicies } from '../auth/limits/limit-policies';
import type { PasswordService } from '../auth/passwords/password.service';
import type { SessionIssuer } from '../auth/sessions/session-issuer';
import type { TokenService } from '../auth/tokens/token.service';
import type { KidEntity } from './kid.entity';
import { KidSessionService } from './kid-session.service';
import type { KidsService } from './kids.service';

const auth = { userId: 'u1', familyId: 'fam1' };
const kidPinPolicy = {
  name: 'kid-pin',
  limit: 5,
  windowSeconds: 900,
  lockSeconds: 900,
};

function kid(pinHash: string | null = null): KidEntity {
  return {
    id: 'k1',
    userId: 'u1',
    nickname: 'Zoë',
    avatar: { animal: 'marmot', accessory: null, background: '#FFD8A8' },
    startClass: 'KG1',
    birthYear: null,
    language: 'de-CH',
    pinHash,
    dailyLimitMinutes: null,
    soundEnabled: true,
    readAloud: 'auto',
  } as KidEntity;
}

function setup(entity: KidEntity = kid()) {
  const kids = {
    requireOwned: jest.fn().mockResolvedValue(entity),
    findOwned: jest.fn().mockResolvedValue(entity),
    markActive: jest.fn().mockResolvedValue(undefined),
  };
  const passwords = { verify: jest.fn().mockResolvedValue(true) };
  const limiter = {
    attempt: jest.fn().mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
      justLocked: false,
    }),
    succeed: jest.fn().mockResolvedValue(undefined),
  };
  const tokens = {
    sign: jest
      .fn()
      .mockReturnValue({ token: 'kid-jwt', expiresAt: new Date(1e13) }),
    verify: jest.fn(),
  };
  const cookies = { set: jest.fn(), clear: jest.fn() };
  const issuer = { closeParentGate: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new KidSessionService(
    kids as unknown as KidsService,
    passwords as unknown as PasswordService,
    limiter as unknown as AttemptLimiter,
    { kidPin: kidPinPolicy } as unknown as LimitPolicies,
    tokens as unknown as TokenService,
    cookies as unknown as AuthCookies,
    issuer as unknown as SessionIssuer,
    audit as unknown as AuditService,
  );
  return { service, kids, passwords, limiter, tokens, cookies, issuer, audit };
}

const response = {} as Response;

describe('KidSessionService.activate', () => {
  it('activates a kid without a PIN: sets mu_kid and locks the gate', async () => {
    const { service, tokens, cookies, issuer, kids, limiter } = setup();

    const view = await service.activate(auth, 'k1', undefined, response, null);

    expect(view.id).toBe('k1');
    expect(tokens.sign).toHaveBeenCalledWith(
      'kid',
      { sub: 'u1', kid: 'k1', fam: 'fam1' },
      12 * 3600,
    );
    expect(cookies.set).toHaveBeenCalledWith(
      response,
      'mu_kid',
      'kid-jwt',
      new Date(1e13),
    );
    expect(issuer.closeParentGate).toHaveBeenCalledWith(response);
    expect(kids.markActive).toHaveBeenCalledWith('k1');
    expect(limiter.attempt).not.toHaveBeenCalled();
  });

  it('reserves an attempt, then gives it back for the correct PIN', async () => {
    const { service, passwords, limiter } = setup(kid('argon2id$hash'));

    await service.activate(auth, 'k1', [1, 2, 3, 4], response, null);

    expect(limiter.attempt).toHaveBeenCalledWith(kidPinPolicy, 'k1');
    expect(passwords.verify).toHaveBeenCalledWith('1-2-3-4', 'argon2id$hash');
    expect(limiter.succeed).toHaveBeenCalledWith(kidPinPolicy, 'k1');
  });

  it('answers a wrong PIN with 401 PIN_INVALID', async () => {
    const { service, passwords, cookies, audit } = setup(kid('argon2id$hash'));
    passwords.verify.mockResolvedValue(false);

    const error = await service
      .activate(auth, 'k1', [4, 3, 2, 1], response, null)
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toMatchObject({
      errorCode: 'PIN_INVALID',
    });
    expect(cookies.set).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('keeps the reserved attempt for a wrong PIN', async () => {
    const { service, passwords, limiter } = setup(kid('argon2id$hash'));
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.activate(auth, 'k1', [4, 3, 2, 1], response, null),
    ).rejects.toBeInstanceOf(HttpException);
    expect(limiter.succeed).not.toHaveBeenCalled();
  });

  it('treats a missing PIN as wrong', async () => {
    const { service, passwords, limiter } = setup(kid('argon2id$hash'));

    await expect(
      service.activate(auth, 'k1', undefined, response, null),
    ).rejects.toBeInstanceOf(HttpException);
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(limiter.attempt).toHaveBeenCalledWith(kidPinPolicy, 'k1');
  });

  it('locks with 429 PIN_LOCKED and audits kid.pin_locked once', async () => {
    const { service, passwords, limiter, audit } = setup(kid('argon2id$hash'));
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 900,
      justLocked: true,
    });

    const error = await service
      .activate(auth, 'k1', [0, 0, 0, 0], response, '203.0.113.1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetryAfterException);
    expect((error as RetryAfterException).retryAfterSeconds).toBe(900);
    expect((error as RetryAfterException).getResponse()).toMatchObject({
      errorCode: 'PIN_LOCKED',
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'kid.pin_locked',
      actorId: 'u1',
      targetType: 'kid',
      targetId: 'k1',
      ip: '203.0.113.1',
      meta: { lockSeconds: 900 },
    });
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('does not audit again while already locked', async () => {
    const { service, limiter, audit } = setup(kid('argon2id$hash'));
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 300,
      justLocked: false,
    });

    await expect(
      service.activate(auth, 'k1', [0, 0, 0, 0], response, null),
    ).rejects.toBeInstanceOf(RetryAfterException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses without checking the PIN while the kid is locked', async () => {
    const { service, passwords, limiter } = setup(kid('argon2id$hash'));
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
      justLocked: false,
    });

    const error = await service
      .activate(auth, 'k1', [1, 2, 3, 4], response, null)
      .catch((e: unknown) => e);

    expect((error as RetryAfterException).retryAfterSeconds).toBe(42);
    expect(passwords.verify).not.toHaveBeenCalled();
  });
});

describe('KidSessionService', () => {
  it('deactivate clears mu_kid', () => {
    const { service, cookies } = setup();

    service.deactivate(response);

    expect(cookies.clear).toHaveBeenCalledWith(response, 'mu_kid');
  });

  describe('activeKid', () => {
    const request = { cookies: { mu_kid: 'jwt' } } as unknown as Request;

    it('returns the kid of a matching token', async () => {
      const { service, tokens, kids } = setup();
      tokens.verify.mockReturnValue({ sub: 'u1', kid: 'k1', fam: 'fam1' });

      await expect(service.activeKid(request, auth)).resolves.toMatchObject({
        id: 'k1',
      });
      expect(tokens.verify).toHaveBeenCalledWith('kid', 'jwt');
      expect(kids.findOwned).toHaveBeenCalledWith('u1', 'k1');
    });

    it.each([
      ['no token', null],
      ['another user', { sub: 'u2', kid: 'k1', fam: 'fam1' }],
      ['another family', { sub: 'u1', kid: 'k1', fam: 'fam2' }],
    ])('returns null for %s', async (_label, claims) => {
      const { service, tokens, kids } = setup();
      tokens.verify.mockReturnValue(claims);

      await expect(service.activeKid(request, auth)).resolves.toBeNull();
      expect(kids.findOwned).not.toHaveBeenCalled();
    });
  });
});
