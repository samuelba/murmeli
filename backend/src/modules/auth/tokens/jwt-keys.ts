import { hkdfSync } from 'node:crypto';

export const TOKEN_TYPES = ['access', 'parent_gate', 'kid', 'totp'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

const DERIVED_KEY_LENGTH = 32;

/**
 * Derives a dedicated signing key per token type from JWT_SECRET, so a token
 * of one type fails verification wherever another type is expected.
 */
export function deriveTokenKey(secret: string, type: TokenType): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secret, '', `murmeli:jwt:${type}`, DERIVED_KEY_LENGTH),
  );
}
