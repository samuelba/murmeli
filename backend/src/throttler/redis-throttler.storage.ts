import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

/**
 * Fixed-window counter with an optional block period, run atomically in
 * Redis. Mirrors the semantics of the in-memory ThrottlerStorageService.
 * Returns [hits, hitsTtlMs, isBlocked, blockTtlMs].
 */
export const INCREMENT_SCRIPT = `
local hitsKey, blockKey = KEYS[1], KEYS[2]
local ttl, limit, block = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return {limit + 1, blockTtl, 1, blockTtl}
end

local hits = redis.call('INCR', hitsKey)
local hitsTtl = redis.call('PTTL', hitsKey)
if hitsTtl < 0 then
  redis.call('PEXPIRE', hitsKey, ttl)
  hitsTtl = ttl
end

if hits > limit then
  if block > 0 then
    redis.call('SET', blockKey, '1', 'PX', block)
    redis.call('DEL', hitsKey)
    return {hits, block, 1, block}
  end
  return {hits, hitsTtl, 1, hitsTtl}
end
return {hits, hitsTtl, 0, 0}
`;

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

const KEY_PREFIX = 'murmeli:throttle';

function toSeconds(milliseconds: number): number {
  return Math.max(0, Math.ceil(milliseconds / 1000));
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Pick<Redis, 'eval'>) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const baseKey = `${KEY_PREFIX}:${throttlerName}:${key}`;
    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${baseKey}:hits`,
      `${baseKey}:block`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    const [totalHits, hitsTtl, blocked, blockTtl] = result;
    return {
      totalHits,
      timeToExpire: toSeconds(hitsTtl),
      isBlocked: blocked === 1,
      timeToBlockExpire: toSeconds(blockTtl),
    };
  }
}
