import {
  RedisThrottlerStorage,
  INCREMENT_SCRIPT,
} from './redis-throttler.storage';

function storageReturning(reply: [number, number, number, number]) {
  const redis = { eval: jest.fn().mockResolvedValue(reply) };
  return { redis, storage: new RedisThrottlerStorage(redis) };
}

describe('RedisThrottlerStorage', () => {
  it('runs the script atomically with namespaced keys', async () => {
    const { redis, storage } = storageReturning([1, 60_000, 0, 0]);

    await storage.increment('abc', 60_000, 10, 30_000, 'auth');

    expect(redis.eval).toHaveBeenCalledWith(
      INCREMENT_SCRIPT,
      2,
      'murmeli:throttle:auth:abc:hits',
      'murmeli:throttle:auth:abc:block',
      60_000,
      10,
      30_000,
    );
  });

  it('reports hits and the time to expire in seconds', async () => {
    const { storage } = storageReturning([3, 59_001, 0, 0]);

    await expect(
      storage.increment('k', 60_000, 10, 60_000, 'default'),
    ).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('reports a block', async () => {
    const { storage } = storageReturning([11, 30_000, 1, 30_000]);

    await expect(
      storage.increment('k', 60_000, 10, 30_000, 'default'),
    ).resolves.toEqual({
      totalHits: 11,
      timeToExpire: 30,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
  });

  it('never reports negative times', async () => {
    const { storage } = storageReturning([1, -1, 0, -2]);

    const record = await storage.increment('k', 1, 10, 1, 'default');

    expect(record.timeToExpire).toBe(0);
    expect(record.timeToBlockExpire).toBe(0);
  });

  it('propagates Redis errors', async () => {
    const redis = { eval: jest.fn().mockRejectedValue(new Error('down')) };

    await expect(
      new RedisThrottlerStorage(redis as never).increment('k', 1, 1, 1, 'x'),
    ).rejects.toThrow('down');
  });
});
