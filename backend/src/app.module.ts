import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { SameOriginGuard } from './common/guards/same-origin.guard';
import { buildLoggerOptions } from './common/logging/logger.options';
import { type AppConfigService, pickEnv } from './config/app-config';
import { validateEnv } from './config/validate-env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { KidsModule } from './modules/kids/kids.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RedisModule } from './redis/redis.module';
import { RateLimitModule } from './throttler/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) =>
        buildLoggerOptions(pickEnv(config, ['NODE_ENV', 'LOG_LEVEL'])),
    }),
    DatabaseModule,
    RedisModule,
    RateLimitModule,
    ScheduleModule.forRoot(),
    HealthModule,
    SettingsModule,
    AuditModule,
    EmailModule.register(),
    AuthModule,
    KidsModule,
    AccountModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SameOriginGuard }],
})
export class AppModule {}
