import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Env } from '../../../config/env.schema';
import type { UserEntity } from '../../users/user.entity';
import {
  PARENT_GATE_MAX_SECONDS,
  PARENT_GATE_TTL_SECONDS,
} from '../auth.constants';
import { SessionIssuer } from './session-issuer';

const USER = {
  id: 'user-1',
  email: 'parent@example.com',
  role: 'parent',
  locale: 'de-CH',
  theme: null,
  emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
  totpEnabled: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
} as UserEntity;

const SESSION = {
  familyId: 'fam-1',
  refreshToken: 'refresh',
  refreshExpiresAt: new Date(Date.now() + 86_400_000),
};

function setup(updated: UserEntity | null = USER) {
  const sessions = { start: jest.fn().mockResolvedValue(SESSION) };
  const tokens = {
    sign: jest.fn((type: string) => ({
      token: `${type}-token`,
      expiresAt: new Date(Date.now() + 60_000),
    })),
  };
  const cookies = { set: jest.fn(), clear: jest.fn() };
  const users = { update: jest.fn().mockResolvedValue(updated) };
  const audit = { record: jest.fn() };
  const issuer = new SessionIssuer(
    sessions as never,
    tokens as never,
    cookies as never,
    users as never,
    audit as never,
    { get: () => '15m' } as unknown as ConfigService<Env, true>,
  );
  return { issuer, sessions, tokens, cookies, users, audit };
}

const response = {} as Response;

describe('SessionIssuer', () => {
  it('signs in: new family, access, refresh and parent-gate cookies', async () => {
    const { issuer, sessions, tokens, cookies, users, audit } = setup();

    const view = await issuer.signIn(
      response,
      USER,
      { ip: '203.0.113.9', userAgent: 'UA' },
      'password',
    );

    expect(view).toMatchObject({ id: 'user-1', emailVerified: true });
    expect(sessions.start).toHaveBeenCalledWith('user-1', 'UA');
    expect(tokens.sign).toHaveBeenCalledWith(
      'access',
      { sub: 'user-1', fam: 'fam-1' },
      900,
    );
    expect(tokens.sign).toHaveBeenCalledWith(
      'parent_gate',
      { sub: 'user-1', fam: 'fam-1', ath: expect.any(Number) },
      PARENT_GATE_TTL_SECONDS,
    );
    expect(cookies.set.mock.calls.map(([, name]) => name as string)).toEqual([
      'mu_at',
      'mu_rt',
      'mu_pg',
    ]);
    expect(cookies.set).toHaveBeenCalledWith(
      response,
      'mu_rt',
      'refresh',
      SESSION.refreshExpiresAt,
    );
    expect(cookies.clear).toHaveBeenCalledWith(response, 'mu_totp');
    expect(users.update).toHaveBeenCalledWith('user-1', {
      lastLoginAt: expect.any(Date),
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'auth.login',
      actorId: 'user-1',
      targetType: 'user',
      targetId: 'user-1',
      ip: '203.0.113.9',
      meta: { method: 'password' },
    });
  });

  it('falls back to the given user when the update returns nothing', async () => {
    const { issuer } = setup(null);

    await expect(
      issuer.signIn(response, USER, { ip: null, userAgent: null }, 'setup'),
    ).resolves.toMatchObject({ id: 'user-1' });
  });

  it('opens the parent gate and returns its expiry', () => {
    const { issuer, cookies } = setup();

    const expiresAt = issuer.openParentGate(response, 'user-1', 'fam-1');

    expect(cookies.set).toHaveBeenCalledWith(
      response,
      'mu_pg',
      'parent_gate-token',
      expiresAt,
    );
  });

  it('stamps a new gate with the current time as auth time', () => {
    const { issuer, tokens } = setup();
    const now = Math.floor(Date.now() / 1000);

    issuer.openParentGate(response, 'user-1', 'fam-1');

    const [, claims] = tokens.sign.mock.calls[0] as unknown as [
      string,
      { ath: number },
    ];
    expect(claims.ath).toBeGreaterThanOrEqual(now);
  });

  it('keeps the auth time on renewal and caps the gate at thirty minutes', () => {
    const { issuer, tokens } = setup();
    const now = Math.floor(Date.now() / 1000);
    const ath = now - PARENT_GATE_MAX_SECONDS + 120;

    issuer.openParentGate(response, 'user-1', 'fam-1', ath);

    expect(tokens.sign).toHaveBeenCalledWith(
      'parent_gate',
      { sub: 'user-1', fam: 'fam-1', ath },
      expect.any(Number),
    );
    const ttl = (tokens.sign.mock.calls[0] as unknown[])[2] as number;
    expect(ttl).toBeLessThanOrEqual(120);
    expect(ttl).toBeGreaterThan(110);
  });

  it('never signs a gate for less than one second', () => {
    const { issuer, tokens } = setup();
    const ath = Math.floor(Date.now() / 1000) - PARENT_GATE_MAX_SECONDS - 60;

    issuer.openParentGate(response, 'user-1', 'fam-1', ath);

    expect((tokens.sign.mock.calls[0] as unknown[])[2]).toBe(1);
  });

  it('closes the parent gate', () => {
    const { issuer, cookies } = setup();

    issuer.closeParentGate(response);

    expect(cookies.clear).toHaveBeenCalledWith(response, 'mu_pg');
  });
});
