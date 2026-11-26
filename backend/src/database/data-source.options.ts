import { extname, join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.schema';

export const DATABASE_CONNECTION_KEYS = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USERNAME',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'DATABASE_SSL',
] as const;

export type ConnectionEnv = Pick<
  Env,
  (typeof DATABASE_CONNECTION_KEYS)[number]
>;
export type MigrationEnv = ConnectionEnv &
  Pick<Env, 'DB_MIGRATION_USERNAME' | 'DB_MIGRATION_PASSWORD'>;
export type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

const SOURCE_ROOT = join(__dirname, '..');
const EXTENSION = extname(__filename);

export const ENTITIES_GLOB = join(SOURCE_ROOT, '**', `*.entity${EXTENSION}`);
export const MIGRATIONS_GLOB = join(SOURCE_ROOT, 'migrations', `*${EXTENSION}`);

export function typeOrmSsl(mode: Env['DATABASE_SSL']): PostgresOptions['ssl'] {
  switch (mode) {
    case 'require-verify':
      return { rejectUnauthorized: true };
    case 'true':
      return { rejectUnauthorized: false };
    default:
      return false;
  }
}

/**
 * Connection options shared by the app, the TypeORM CLI, the migrate script
 * and the backup. `migrationsRun` is deliberately absent: initialize() would
 * run the migrations itself, before the backup has been taken.
 */
export function buildDataSourceOptions(env: ConnectionEnv): PostgresOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: typeOrmSsl(env.DATABASE_SSL),
    entities: [ENTITIES_GLOB],
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: 'migrations',
    synchronize: false,
  };
}

/**
 * Migrations and backups run as the schema owner when DB_MIGRATION_USERNAME
 * is set; the app itself keeps the least-privileged DATABASE_USERNAME.
 */
export function withMigrationCredentials(env: MigrationEnv): ConnectionEnv {
  return {
    DATABASE_HOST: env.DATABASE_HOST,
    DATABASE_PORT: env.DATABASE_PORT,
    DATABASE_NAME: env.DATABASE_NAME,
    DATABASE_SSL: env.DATABASE_SSL,
    DATABASE_USERNAME: env.DB_MIGRATION_USERNAME ?? env.DATABASE_USERNAME,
    DATABASE_PASSWORD: env.DB_MIGRATION_PASSWORD ?? env.DATABASE_PASSWORD,
  };
}
