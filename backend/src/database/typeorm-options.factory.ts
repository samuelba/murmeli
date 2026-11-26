import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { type AppConfigService, pickEnv } from '../config/app-config';
import {
  DATABASE_CONNECTION_KEYS,
  buildDataSourceOptions,
} from './data-source.options';

/**
 * In production the Docker entrypoint is the only migration path (backup,
 * then migrate). Running migrations from the app is a development shortcut.
 */
export function typeOrmOptionsFactory(
  config: AppConfigService,
): TypeOrmModuleOptions {
  const env = pickEnv(config, [
    ...DATABASE_CONNECTION_KEYS,
    'NODE_ENV',
    'DB_MIGRATIONS_RUN',
  ]);
  return {
    ...buildDataSourceOptions(env),
    migrationsRun: env.NODE_ENV !== 'production' && env.DB_MIGRATIONS_RUN,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
