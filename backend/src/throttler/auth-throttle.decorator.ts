import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLER = 'auth';
export const AUTH_THROTTLE_KEY = 'murmeli:authThrottle';
export const EMAIL_THROTTLER = 'email';
export const EMAIL_THROTTLE_KEY = 'murmeli:emailThrottle';

export const FAIL_CLOSED_THROTTLERS: ReadonlySet<string> = new Set([
  AUTH_THROTTLER,
  EMAIL_THROTTLER,
]);

/**
 * Opts a route or controller into the stricter `auth` throttler. Combine with
 * `@Throttle({ auth: { limit, ttl } })` to override its limits.
 */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);

/**
 * Opts a route into the `email` throttler for routes that send email to an
 * address the caller chooses (register, forgot-password, resend).
 */
export const EmailThrottle = () => SetMetadata(EMAIL_THROTTLE_KEY, true);
