import type { ExecutionContext } from '@nestjs/common';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { Env } from '../config/env.schema';
import { AUTH_THROTTLE_KEY, AUTH_THROTTLER } from './auth-throttle.decorator';

export const THROTTLER_ENV_KEYS = [
  'RATE_LIMIT_TTL_SECONDS',
  'RATE_LIMIT_LIMIT',
  'RATE_LIMIT_AUTH_TTL_SECONDS',
  'RATE_LIMIT_AUTH_LIMIT',
] as const;

export type ThrottlerEnv = Pick<Env, (typeof THROTTLER_ENV_KEYS)[number]>;

export const IPV6_SUBNET_PREFIX = 64;

export function isAuthThrottled(context: ExecutionContext): boolean {
  return [context.getHandler(), context.getClass()].some(
    (target) => Reflect.getMetadata(AUTH_THROTTLE_KEY, target) === true,
  );
}

export function buildThrottlerOptions(
  env: ThrottlerEnv,
  storage: ThrottlerStorage,
): ThrottlerModuleOptions {
  return {
    storage,
    ipv6SubnetPrefix: IPV6_SUBNET_PREFIX,
    throttlers: [
      {
        name: 'default',
        ttl: env.RATE_LIMIT_TTL_SECONDS * 1000,
        limit: env.RATE_LIMIT_LIMIT,
      },
      {
        name: AUTH_THROTTLER,
        ttl: env.RATE_LIMIT_AUTH_TTL_SECONDS * 1000,
        limit: env.RATE_LIMIT_AUTH_LIMIT,
        skipIf: (context) => !isAuthThrottled(context),
      },
    ],
  };
}
