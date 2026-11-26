import { Secret, TOTP } from 'otpauth';
import { BRAND_NAME } from '../../../config/brand';

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
const SECRET_BYTES = 20;

export function createTotpSecret(): string {
  return new Secret({ size: SECRET_BYTES }).base32;
}

function totpFor(secret: string, label = ''): TOTP {
  return new TOTP({
    issuer: BRAND_NAME,
    label,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: Secret.fromBase32(secret),
  });
}

export function otpauthUrl(secret: string, accountLabel: string): string {
  return totpFor(secret, accountLabel).toString();
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * @returns the time step the code belongs to, or null if it is not valid
 * within ±TOTP_WINDOW steps
 */
export function matchingStep(
  secret: string,
  code: string,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }
  const delta = totpFor(secret).validate({
    token: code,
    timestamp: now,
    window: TOTP_WINDOW,
  });
  return delta === null ? null : currentStep(now) + delta;
}

export function generateCode(secret: string, now = Date.now()): string {
  return totpFor(secret).generate({ timestamp: now });
}
