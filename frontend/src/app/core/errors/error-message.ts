import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, isApiError, toApiError } from '../http/api-error';

export interface ErrorMessage {
  readonly key: string;
  readonly params?: Readonly<Record<string, number | string>>;
}

export const KNOWN_ERROR_CODES = [
  'ACCOUNT_DISABLED',
  'ALTCHA_INVALID',
  'AVATAR_INVALID',
  'CANNOT_DELETE_SELF',
  'EMAIL_NOT_VERIFIED',
  'INVALID_CREDENTIALS',
  'INVALID_JSON',
  'INVITE_INVALID',
  'KID_LIMIT',
  'KID_NOT_FOUND',
  'LAST_ADMIN',
  'PARENT_GATE_REQUIRED',
  'PASSWORD_TOO_WEAK',
  'PAYLOAD_TOO_LARGE',
  'PIN_INVALID',
  'PIN_LOCKED',
  'RATE_LIMIT_UNAVAILABLE',
  'REGISTRATION_DISABLED',
  'SESSION_COMPROMISED',
  'SESSION_EXPIRED',
  'SETUP_COMPLETE',
  'TOKEN_INVALID',
  'TOTP_INVALID',
  'TOTP_REQUIRED',
  'VALIDATION_FAILED',
] as const;

const KNOWN = new Set<string>(KNOWN_ERROR_CODES);

function asApiError(error: unknown): ApiError | null {
  if (error instanceof HttpErrorResponse) {
    return toApiError(error);
  }
  return isApiError(error) ? error : null;
}

function waitMessage(prefix: string, seconds: number | null | undefined): ErrorMessage {
  if (!seconds || seconds <= 0) {
    return { key: `errors.${prefix}` };
  }
  if (seconds < 60) {
    return { key: `errors.${prefix}_SECONDS`, params: { count: seconds } };
  }
  return { key: `errors.${prefix}_MINUTES`, params: { count: Math.ceil(seconds / 60) } };
}

export function errorMessage(error: unknown): ErrorMessage {
  const apiError = asApiError(error);
  if (!apiError) {
    return { key: 'errors.GENERIC' };
  }
  if (apiError.code === 'PIN_LOCKED') {
    return waitMessage('PIN_LOCKED', apiError.retryAfterSeconds);
  }
  if (apiError.status === 429 || apiError.code === 'RATE_LIMITED') {
    return waitMessage('RATE_LIMITED', apiError.retryAfterSeconds);
  }
  if (apiError.code && KNOWN.has(apiError.code)) {
    return { key: `errors.${apiError.code}` };
  }
  if (apiError.status === 0) {
    return { key: 'errors.NETWORK' };
  }
  if (apiError.status >= 500) {
    return { key: 'errors.SERVER' };
  }
  return { key: 'errors.GENERIC' };
}
