import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../../config/env.schema';
import { TOKEN_TYPES, type TokenType, deriveTokenKey } from './jwt-keys';

export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'murmeli';

export interface AccessClaims {
  readonly sub: string;
  readonly fam: string;
}

export interface ParentGateClaims {
  readonly sub: string;
  readonly fam: string;
  /** When the password was last entered (seconds); caps sliding renewal */
  readonly ath: number;
}

export interface KidClaims {
  readonly sub: string;
  readonly kid: string;
  readonly fam: string;
}

export interface TotpClaims {
  readonly sub: string;
  readonly jti: string;
}

interface ClaimsByType {
  access: AccessClaims;
  parent_gate: ParentGateClaims;
  kid: KidClaims;
  totp: TotpClaims;
}

export interface SignedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export type Verified<T> = T & { readonly exp: number };

const REQUIRED_CLAIMS: Readonly<Record<TokenType, readonly string[]>> = {
  access: ['sub', 'fam'],
  parent_gate: ['sub', 'fam'],
  kid: ['sub', 'kid', 'fam'],
  totp: ['sub', 'jti'],
};

const NUMERIC_CLAIMS: Readonly<Partial<Record<TokenType, readonly string[]>>> =
  {
    parent_gate: ['ath'],
  };

function hasClaims(
  payload: unknown,
  strings: readonly string[],
  numbers: readonly string[] = [],
): boolean {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return (
    strings.every((name) => typeof record[name] === 'string') &&
    numbers.every((name) => typeof record[name] === 'number')
  );
}

/**
 * Signs and verifies the short-lived JWT cookies. Every type has its own
 * HKDF-derived key and audience; only HS256 is accepted.
 */
@Injectable()
export class TokenService {
  private readonly keys: Readonly<Record<TokenType, Buffer>>;

  constructor(config: ConfigService<Env, true>) {
    const secret = config.get('JWT_SECRET', { infer: true });
    this.keys = Object.fromEntries(
      TOKEN_TYPES.map((type) => [type, deriveTokenKey(secret, type)]),
    ) as Record<TokenType, Buffer>;
  }

  sign<T extends TokenType>(
    type: T,
    claims: ClaimsByType[T],
    ttlSeconds: number,
    now = Date.now(),
  ): SignedToken {
    const iat = Math.floor(now / 1000);
    const exp = iat + ttlSeconds;
    const token = jwt.sign({ ...claims, iat, exp }, this.keys[type], {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: `${JWT_ISSUER}:${type}`,
    });
    return { token, expiresAt: new Date(exp * 1000) };
  }

  newTotpClaims(userId: string): TotpClaims {
    return { sub: userId, jti: randomUUID() };
  }

  /**
   * @returns the claims, or null for a missing, malformed, expired or
   * foreign token
   */
  verify<T extends TokenType>(
    type: T,
    token: string | undefined,
  ): Verified<ClaimsByType[T]> | null {
    if (typeof token !== 'string' || token === '') {
      return null;
    }
    try {
      const payload = jwt.verify(token, this.keys[type], {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: `${JWT_ISSUER}:${type}`,
      });
      return hasClaims(payload, REQUIRED_CLAIMS[type], NUMERIC_CLAIMS[type])
        ? (payload as Verified<ClaimsByType[T]>)
        : null;
    } catch {
      return null;
    }
  }
}
