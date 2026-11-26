import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { HealthService, withTimeout } from './health.service';

function service(query: jest.Mock, ping: jest.Mock): HealthService {
  return new HealthService({ query } as unknown as DataSource, { ping });
}

describe('HealthService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('is ready when Postgres and Redis answer', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const ping = jest.fn().mockResolvedValue('PONG');

    await expect(service(query, ping).readiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports each failing dependency', async () => {
    const query = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const ping = jest.fn().mockResolvedValue('PONG');

    await expect(service(query, ping).readiness()).resolves.toEqual({
      status: 'error',
      checks: { database: 'down', redis: 'up' },
    });
  });

  it('reports Redis as down', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const ping = jest.fn().mockRejectedValue(new Error('NOAUTH'));

    await expect(service(query, ping).readiness()).resolves.toMatchObject({
      status: 'error',
      checks: { redis: 'down' },
    });
  });
});

describe('withTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('resolves with the task result', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejects when the task takes too long', async () => {
    jest.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined), 50);
    jest.advanceTimersByTime(50);

    await expect(pending).rejects.toThrow('Timed out after 50 ms');
  });
});
