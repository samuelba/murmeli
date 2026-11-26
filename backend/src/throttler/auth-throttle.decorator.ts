import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLER = 'auth';
export const AUTH_THROTTLE_KEY = 'murmeli:authThrottle';

/**
 * Opts a route or controller into the stricter `auth` throttler. Combine with
 * `@Throttle({ auth: { limit, ttl } })` to override its limits.
 */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);
