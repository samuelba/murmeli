import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_BYTES = 32;

export interface SecureToken {
  readonly token: string;
  readonly hash: string;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * A random opaque token for links and cookies. Only its SHA-256 hash is
 * stored, so a database leak does not reveal usable tokens.
 */
export function generateSecureToken(bytes = TOKEN_BYTES): SecureToken {
  const token = randomBytes(bytes).toString('base64url');
  return { token, hash: sha256Hex(token) };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
