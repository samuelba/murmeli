import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { type AppConfigService, pickEnv } from '../config/app-config';
import { REDIS_CLIENT } from '../redis/redis.options';
import { AppThrottlerGuard } from './app-throttler.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { THROTTLER_ENV_KEYS, buildThrottlerOptions } from './throttler.options';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: AppConfigService, redis: Redis) =>
        buildThrottlerOptions(
          pickEnv(config, THROTTLER_ENV_KEYS),
          new RedisThrottlerStorage(redis),
        ),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class RateLimitModule {}
