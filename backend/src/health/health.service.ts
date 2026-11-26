import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { errorMessage } from '../common/errors/error-message';
import { REDIS_CLIENT } from '../redis/redis.options';

export type CheckStatus = 'up' | 'down';

export interface ReadinessReport {
  readonly status: 'ok' | 'error';
  readonly checks: Readonly<Record<'database' | 'redis', CheckStatus>>;
}

export const CHECK_TIMEOUT_MS = 2_000;

export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'ping'>,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.check('database', () => this.dataSource.query('SELECT 1')),
      this.check('redis', () => this.redis.ping()),
    ]);
    const status = database === 'up' && redis === 'up' ? 'ok' : 'error';
    return { status, checks: { database, redis } };
  }

  private async check(
    name: string,
    probe: () => Promise<unknown>,
  ): Promise<CheckStatus> {
    try {
      await withTimeout(probe(), CHECK_TIMEOUT_MS);
      return 'up';
    } catch (error) {
      this.logger.warn(
        `Readiness check ${name} failed: ${errorMessage(error)}`,
      );
      return 'down';
    }
  }
}
