import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { apiError } from '../../../common/errors/api-exception';
import { errorMessage } from '../../../common/errors/error-message';
import { REDIS_CLIENT } from '../../../redis/redis.options';
import { RATE_LIMIT_UNAVAILABLE } from '../../../throttler/app-throttler.guard';

export interface LimitPolicy {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly lockSeconds: number;
  /** Double the lock for every further lock within LEVEL_TTL_SECONDS */
  readonly exponential?: boolean;
}

export interface AttemptResult {
  /** false when the identifier is locked; the attempt must be refused */
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
  /** true when this attempt crossed the limit and started the lock */
  readonly justLocked: boolean;
}

export const LEVEL_TTL_SECONDS = 24 * 3600;
export const MAX_LOCK_SECONDS = 24 * 3600;
const KEY_PREFIX = 'murmeli:limit';

/**
 * Reserves one attempt before the secret is checked, so concurrent requests
 * cannot all slip under the limit. Returns [allowed, lockTtlMs, justLocked].
 */
export const ATTEMPT_SCRIPT = `
local fails, lock, level = KEYS[1], KEYS[2], KEYS[3]
local limit, window, lockMs = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local exponential, levelTtl, maxLock = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])

local lockTtl = redis.call('PTTL', lock)
if lockTtl > 0 then
  return {0, lockTtl, 0}
end

local count = redis.call('INCR', fails)
if count == 1 then
  redis.call('PEXPIRE', fails, window)
end
if count <= limit then
  return {1, 0, 0}
end

local duration = lockMs
if exponential == 1 then
  local lvl = redis.call('INCR', level)
  redis.call('PEXPIRE', level, levelTtl)
  duration = math.min(lockMs * (2 ^ (lvl - 1)), maxLock)
end
redis.call('SET', lock, '1', 'PX', duration)
redis.call('DEL', fails)
return {0, duration, 1}
`;

function toSeconds(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

/**
 * Identifier-based limits (per account, per user, per kid, per sign-in step)
 * kept in Redis. They fail closed: without Redis the request is refused with
 * 503 RATE_LIMIT_UNAVAILABLE.
 */
@Injectable()
export class AttemptLimiter {
  private readonly logger = new Logger(AttemptLimiter.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Pick<Redis, 'eval' | 'del'>,
  ) {}

  /**
   * Counts an attempt up front. Call `succeed` after a correct secret to
   * give the reserved attempt back.
   */
  async attempt(policy: LimitPolicy, id: string): Promise<AttemptResult> {
    const [allowed, ttl, justLocked] = (await this.guarded(() =>
      this.redis.eval(
        ATTEMPT_SCRIPT,
        3,
        ...this.keys(policy, id),
        policy.limit,
        policy.windowSeconds * 1000,
        policy.lockSeconds * 1000,
        policy.exponential ? 1 : 0,
        LEVEL_TTL_SECONDS * 1000,
        MAX_LOCK_SECONDS * 1000,
      ),
    )) as [number, number, number];
    return {
      allowed: allowed === 1,
      retryAfterSeconds: allowed === 1 ? 0 : toSeconds(ttl),
      justLocked: justLocked === 1,
    };
  }

  async succeed(policy: LimitPolicy, id: string): Promise<void> {
    const [fails] = this.keys(policy, id);
    await this.guarded(() => this.redis.del(fails));
  }

  private keys(policy: LimitPolicy, id: string): [string, string, string] {
    const base = `${KEY_PREFIX}:${policy.name}:${id}`;
    return [`${base}:fails`, `${base}:lock`, `${base}:level`];
  }

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(
        `Attempt limiter unavailable, rejecting request: ${errorMessage(error)}`,
      );
      throw apiError(
        503,
        RATE_LIMIT_UNAVAILABLE,
        'Rate limiting is temporarily unavailable',
      );
    }
  }
}
