import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../src/throttler/redis-throttler.storage';

const describeWithDb = process.env.E2E_DB === '1' ? describe : describe.skip;

describeWithDb('RedisThrottlerStorage (e2e, real Redis)', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    });
    storage = new RedisThrottlerStorage(redis);
  });

  afterAll(() => redis.quit());

  it('counts hits within the window', async () => {
    const key = randomUUID();

    const first = await storage.increment(key, 60_000, 3, 60_000, 'default');
    const second = await storage.increment(key, 60_000, 3, 60_000, 'default');

    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(second).toMatchObject({ totalHits: 2, isBlocked: false });
    expect(second.timeToExpire).toBeGreaterThan(0);
    expect(second.timeToExpire).toBeLessThanOrEqual(60);
  });

  it('blocks after the limit for the block duration', async () => {
    const key = randomUUID();
    for (let i = 0; i < 2; i += 1) {
      await storage.increment(key, 60_000, 2, 5_000, 'auth');
    }

    const blocked = await storage.increment(key, 60_000, 2, 5_000, 'auth');
    const stillBlocked = await storage.increment(key, 60_000, 2, 5_000, 'auth');

    expect(blocked).toMatchObject({ isBlocked: true, timeToBlockExpire: 5 });
    expect(stillBlocked.isBlocked).toBe(true);
  });

  it('starts a new window after the block expires', async () => {
    const key = randomUUID();
    await storage.increment(key, 60_000, 1, 100, 'auth');
    await storage.increment(key, 60_000, 1, 100, 'auth');
    await new Promise((resolve) => setTimeout(resolve, 150));

    await expect(
      storage.increment(key, 60_000, 1, 100, 'auth'),
    ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
  });
});
