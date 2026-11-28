import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { apiError } from '../../../common/errors/api-exception';
import { errorMessage } from '../../../common/errors/error-message';
import { REDIS_CLIENT } from '../../../redis/redis.options';
import { RUN_TTL_SECONDS } from '../learning.constants';
import type { RunState } from './run-state';

export const RUN_KEY_PREFIX = 'murmeli:run:';
export const ACTIVE_RUN_KEY_PREFIX = 'murmeli:run-active:';
export const RUN_STORE_UNAVAILABLE = 'RUN_STORE_UNAVAILABLE';

/**
 * Stores the new run and makes it the kid's only active run. Returns the
 * replaced run's state, if any. KEYS: active, run. ARGV: runId, json, ttl,
 * run key prefix.
 */
export const START_SCRIPT = `
local previousId = redis.call('GET', KEYS[1])
local previous = false
if previousId then
  local previousKey = ARGV[4] .. previousId
  previous = redis.call('GET', previousKey)
  redis.call('DEL', previousKey)
end
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))
return previous
`;

/** Replaces the run only if nobody changed it since it was read. */
export const UPDATE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
return 1
`;

/** Removes the run (and the active pointer) only if it is unchanged. */
export const TAKE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) == ARGV[2] then
  redis.call('DEL', KEYS[2])
end
return 1
`;

/**
 * Puts a taken run back (only if nothing replaced it meanwhile), so a failed
 * finish can be retried. KEYS: run, active. ARGV: json, runId, ttl.
 */
export const RESTORE_SCRIPT = `
local stored = redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]), 'NX')
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]), 'NX')
if stored then
  return 1
end
return 0
`;

export interface StoredRun {
  readonly state: RunState;
  /** The exact stored JSON, used for compare-and-set */
  readonly raw: string;
}

function parse(raw: string | null): StoredRun | null {
  if (raw === null) {
    return null;
  }
  try {
    const state = JSON.parse(raw) as RunState | null;
    const valid =
      state?.v === 3 &&
      typeof state.kidId === 'string' &&
      typeof state.runId === 'string' &&
      typeof state.locale === 'string' &&
      Array.isArray(state.items) &&
      state.items.every(
        (item: { exercise?: unknown } | null) =>
          typeof item?.exercise === 'object',
      );
    return valid ? { state, raw } : null;
  } catch {
    return null;
  }
}

/**
 * Run state in Redis (`murmeli:run:<runId>`, 2 h TTL) with one active run per
 * kid. Updates are compare-and-set, so concurrent answers cannot both use
 * the same attempt and a run can only be finished once.
 */
@Injectable()
export class RunStore {
  private readonly logger = new Logger(RunStore.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'eval' | 'get'>,
  ) {}

  async start(state: RunState): Promise<RunState | null> {
    const previous = await this.guarded(() =>
      this.redis.eval(
        START_SCRIPT,
        2,
        ACTIVE_RUN_KEY_PREFIX + state.kidId,
        RUN_KEY_PREFIX + state.runId,
        state.runId,
        JSON.stringify(state),
        RUN_TTL_SECONDS,
        RUN_KEY_PREFIX,
      ),
    );
    return parse(typeof previous === 'string' ? previous : null)?.state ?? null;
  }

  async activeOf(kidId: string): Promise<StoredRun | null> {
    const runId = await this.guarded(() =>
      this.redis.get(ACTIVE_RUN_KEY_PREFIX + kidId),
    );
    return runId === null ? null : this.get(runId);
  }

  async get(runId: string): Promise<StoredRun | null> {
    return parse(
      await this.guarded(() => this.redis.get(RUN_KEY_PREFIX + runId)),
    );
  }

  async update(current: StoredRun, next: RunState): Promise<boolean> {
    const result = await this.guarded(() =>
      this.redis.eval(
        UPDATE_SCRIPT,
        1,
        RUN_KEY_PREFIX + current.state.runId,
        current.raw,
        JSON.stringify(next),
      ),
    );
    return result === 1;
  }

  async take(current: StoredRun): Promise<boolean> {
    const { runId, kidId } = current.state;
    const result = await this.guarded(() =>
      this.redis.eval(
        TAKE_SCRIPT,
        2,
        RUN_KEY_PREFIX + runId,
        ACTIVE_RUN_KEY_PREFIX + kidId,
        current.raw,
        runId,
      ),
    );
    return result === 1;
  }

  async restore(taken: StoredRun): Promise<boolean> {
    const { runId, kidId } = taken.state;
    const result = await this.guarded(() =>
      this.redis.eval(
        RESTORE_SCRIPT,
        2,
        RUN_KEY_PREFIX + runId,
        ACTIVE_RUN_KEY_PREFIX + kidId,
        taken.raw,
        runId,
        RUN_TTL_SECONDS,
      ),
    );
    return result === 1;
  }

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`Run store unavailable: ${errorMessage(error)}`);
      throw apiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        RUN_STORE_UNAVAILABLE,
        'Learning is temporarily unavailable',
      );
    }
  }
}
