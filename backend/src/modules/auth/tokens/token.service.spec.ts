import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { Env } from '../../../config/env.schema';
import { deriveTokenKey } from './jwt-keys';
import { JWT_ISSUER, TokenService } from './token.service';

const SECRET = 'jwt-Secret-0123456789-abcdefghijklmnopqrstuvwxyz';

function service(secret = SECRET): TokenService {
  return new TokenService({
    get: () => secret,
  } as unknown as ConfigService<Env, true>);
}

describe('TokenService', () => {
  const tokens = service();
  const access = { sub: 'user-1', fam: 'fam-1' };

  it('signs and verifies a token of the same type', () => {
    const signed = tokens.sign('access', access, 60);

    expect(tokens.verify('access', signed.token)).toMatchObject(access);
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('computes the expiry from the ttl', () => {
    const now = Date.UTC(2026, 0, 1);

    const signed = tokens.sign(
      'kid',
      { sub: 'u', kid: 'k', fam: 'f' },
      3600,
      now,
    );

    expect(signed.expiresAt).toEqual(new Date(now + 3_600_000));
  });

  it('rejects a token of another type', () => {
    const gate = tokens.sign('parent_gate', { sub: 'u', fam: 'f', ath: 1 }, 60);

    expect(tokens.verify('access', gate.token)).toBeNull();
    expect(tokens.verify('kid', gate.token)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const foreign = service(`${SECRET}-other`).sign('access', access, 60);

    expect(tokens.verify('access', foreign.token)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = tokens.sign('access', access, 60, Date.now() - 120_000);

    expect(tokens.verify('access', expired.token)).toBeNull();
  });

  it.each([undefined, '', 'not-a-jwt'])('rejects %p', (token) => {
    expect(tokens.verify('access', token)).toBeNull();
  });

  it('rejects a token without the required claims', () => {
    const token = jwt.sign(
      { sub: 'user-1' },
      deriveTokenKey(SECRET, 'access'),
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: 'murmeli:access',
      },
    );

    expect(tokens.verify('access', token)).toBeNull();
  });

  it('does not put a role into access tokens', () => {
    const verified = tokens.verify(
      'access',
      tokens.sign('access', access, 60).token,
    );

    expect(verified).not.toHaveProperty('role');
  });

  it('requires a numeric auth time in parent-gate tokens', () => {
    const key = deriveTokenKey(SECRET, 'parent_gate');
    const options = {
      algorithm: 'HS256' as const,
      issuer: JWT_ISSUER,
      audience: 'murmeli:parent_gate',
    };
    const withoutAth = jwt.sign({ sub: 'u', fam: 'f' }, key, options);
    const stringAth = jwt.sign({ sub: 'u', fam: 'f', ath: '1' }, key, options);
    const valid = tokens.sign(
      'parent_gate',
      { sub: 'u', fam: 'f', ath: 7 },
      60,
    );

    expect(tokens.verify('parent_gate', withoutAth)).toBeNull();
    expect(tokens.verify('parent_gate', stringAth)).toBeNull();
    expect(tokens.verify('parent_gate', valid.token)).toMatchObject({ ath: 7 });
  });

  it('rejects a token whose payload is not an object', () => {
    const token = jwt.sign('plain', deriveTokenKey(SECRET, 'access'), {
      algorithm: 'HS256',
    });

    expect(tokens.verify('access', token)).toBeNull();
  });

  it('rejects the none algorithm', () => {
    const token = jwt.sign(access, '', {
      algorithm: 'none',
      issuer: JWT_ISSUER,
      audience: 'murmeli:access',
    });

    expect(tokens.verify('access', token)).toBeNull();
  });

  it('creates unique TOTP step claims', () => {
    const first = tokens.newTotpClaims('user-1');
    const second = tokens.newTotpClaims('user-1');

    expect(first.sub).toBe('user-1');
    expect(first.jti).not.toBe(second.jti);
    expect(
      tokens.verify('totp', tokens.sign('totp', first, 60).token),
    ).toMatchObject(first);
  });
});
