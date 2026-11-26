import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { errorMessage } from '../common/errors/error-message';
import { type RedisEnv, buildRedisClientOptions } from './redis.options';

type Listenable = Pick<Redis, 'on'>;

/**
 * Logs connection errors once per distinct message until the connection is
 * ready again, so a Redis outage does not flood the log on every retry.
 */
export function attachErrorLogging<T extends Listenable>(
  client: T,
  logger: Pick<Logger, 'error' | 'log'> = new Logger('Redis'),
): T {
  let lastError: string | undefined;
  client.on('error', (error: unknown) => {
    const message = errorMessage(error);
    if (message !== lastError) {
      lastError = message;
      logger.error(`Redis connection error: ${message}`);
    }
  });
  client.on('ready', () => {
    if (lastError !== undefined) {
      logger.log('Redis connection restored');
      lastError = undefined;
    }
  });
  return client;
}

export function createRedisClient(env: RedisEnv): Redis {
  return attachErrorLogging(new Redis(buildRedisClientOptions(env)));
}
