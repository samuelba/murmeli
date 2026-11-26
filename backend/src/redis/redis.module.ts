import { BullModule } from '@nestjs/bullmq';
import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { type AppConfigService, pickEnv } from '../config/app-config';
import { createRedisClient } from './redis.client';
import {
  REDIS_CLIENT,
  REDIS_ENV_KEYS,
  buildBullConnection,
} from './redis.options';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: buildBullConnection(pickEnv(config, REDIS_ENV_KEYS)),
        prefix: 'murmeli:bull',
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: AppConfigService) =>
        createRedisClient(pickEnv(config, REDIS_ENV_KEYS)),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
      return;
    }
    this.redis.disconnect();
  }
}
