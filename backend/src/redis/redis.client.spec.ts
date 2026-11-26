import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import { attachErrorLogging, createRedisClient } from './redis.client';

function setup() {
  const client = new EventEmitter();
  const logger = { error: jest.fn(), log: jest.fn() };
  attachErrorLogging(client as unknown as Redis, logger);
  return { client, logger };
}

describe('attachErrorLogging', () => {
  it('logs each distinct error once until the connection recovers', () => {
    const { client, logger } = setup();

    client.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    client.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    client.emit('error', new Error('NOAUTH Authentication required'));
    client.emit('ready');
    client.emit('ready');
    client.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:6379'));

    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      'Redis connection error: connect ECONNREFUSED 127.0.0.1:6379',
    );
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});

describe('createRedisClient', () => {
  it('creates a lazy client with an error listener', () => {
    const client = createRedisClient({
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 1,
      REDIS_PASSWORD: undefined,
    });

    expect(client).toBeInstanceOf(Redis);
    expect(client.status).toBe('wait');
    expect(client.listenerCount('error')).toBe(1);
    client.disconnect();
  });
});
