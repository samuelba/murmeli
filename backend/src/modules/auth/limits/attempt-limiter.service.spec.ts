import { HttpException, Logger } from '@nestjs/common';
import {
  ATTEMPT_SCRIPT,
  AttemptLimiter,
  LEVEL_TTL_SECONDS,
  type LimitPolicy,
  MAX_LOCK_SECONDS,
} from './attempt-limiter.service';

const policy: LimitPolicy = {
  name: 'login',
  limit: 5,
  windowSeconds: 300,
  lockSeconds: 900,
};

function redis() {
  return { eval: jest.fn(), del: jest.fn() };
}

async function expectUnavailable(promise: Promise<unknown>): Promise<void> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(503);
  expect((error as HttpException).getResponse()).toMatchObject({
    errorCode: 'RATE_LIMIT_UNAVAILABLE',
  });
}

describe('AttemptLimiter', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('attempt', () => {
    it('reserves an attempt with the policy as script arguments', async () => {
      const client = redis();
      client.eval.mockResolvedValue([1, 0, 0]);

      await expect(
        new AttemptLimiter(client).attempt(policy, 'abc'),
      ).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
        justLocked: false,
      });
      expect(client.eval).toHaveBeenCalledWith(
        ATTEMPT_SCRIPT,
        3,
        'murmeli:limit:login:abc:fails',
        'murmeli:limit:login:abc:lock',
        'murmeli:limit:login:abc:level',
        5,
        300_000,
        900_000,
        0,
        LEVEL_TTL_SECONDS * 1000,
        MAX_LOCK_SECONDS * 1000,
      );
    });

    it('passes the exponential flag', async () => {
      const client = redis();
      client.eval.mockResolvedValue([1, 0, 0]);

      await new AttemptLimiter(client).attempt(
        { ...policy, exponential: true },
        'kid',
      );

      expect(client.eval.mock.calls[0][8]).toBe(1);
    });

    it('reports an existing lock in whole seconds', async () => {
      const client = redis();
      client.eval.mockResolvedValue([0, 1500, 0]);

      await expect(
        new AttemptLimiter(client).attempt(policy, 'abc'),
      ).resolves.toEqual({
        allowed: false,
        retryAfterSeconds: 2,
        justLocked: false,
      });
    });

    it('reports the attempt that started the lock', async () => {
      const client = redis();
      client.eval.mockResolvedValue([0, 900_000, 1]);

      await expect(
        new AttemptLimiter(client).attempt(policy, 'abc'),
      ).resolves.toEqual({
        allowed: false,
        retryAfterSeconds: 900,
        justLocked: true,
      });
    });

    it('never reports less than one second', async () => {
      const client = redis();
      client.eval.mockResolvedValue([0, 0, 0]);

      const result = await new AttemptLimiter(client).attempt(policy, 'abc');

      expect(result.retryAfterSeconds).toBe(1);
    });

    it('fails closed when Redis is down', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const client = redis();
      client.eval.mockRejectedValue(new Error('ECONNREFUSED'));

      await expectUnavailable(
        new AttemptLimiter(client).attempt(policy, 'abc'),
      );
    });
  });

  describe('succeed', () => {
    it('gives the reserved attempts back', async () => {
      const client = redis();
      client.del.mockResolvedValue(1);

      await new AttemptLimiter(client).succeed(policy, 'abc');

      expect(client.del).toHaveBeenCalledWith('murmeli:limit:login:abc:fails');
    });

    it('fails closed when Redis is down', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const client = redis();
      client.del.mockRejectedValue(new Error('down'));

      await expectUnavailable(
        new AttemptLimiter(client).succeed(policy, 'abc'),
      );
    });
  });

  it('locks only after the limit, so the limit-th attempt is still verified', () => {
    expect(ATTEMPT_SCRIPT).toContain('if count <= limit then');
    expect(ATTEMPT_SCRIPT).toContain(
      "redis.call('SET', lock, '1', 'PX', duration)",
    );
  });
});
