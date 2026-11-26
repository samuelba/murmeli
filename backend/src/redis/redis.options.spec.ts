import {
  buildBullConnection,
  buildRedisClientOptions,
  buildRedisConnection,
} from './redis.options';

describe('redis options', () => {
  const env = { REDIS_HOST: 'valkey', REDIS_PORT: 6380, REDIS_PASSWORD: 'pw' };

  it('builds the shared connection settings', () => {
    expect(buildRedisConnection(env)).toEqual({
      host: 'valkey',
      port: 6380,
      password: 'pw',
    });
  });

  it('lets BullMQ retry blocking commands forever', () => {
    expect(buildBullConnection(env)).toEqual({
      host: 'valkey',
      port: 6380,
      password: 'pw',
      maxRetriesPerRequest: null,
    });
  });

  it('connects lazily and fails fast', () => {
    expect(buildRedisClientOptions(env)).toMatchObject({
      host: 'valkey',
      lazyConnect: true,
      commandTimeout: 2000,
      maxRetriesPerRequest: 2,
    });
  });
});
