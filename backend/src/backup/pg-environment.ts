import type { Env } from '../config/env.schema';
import {
  type MigrationEnv,
  withMigrationCredentials,
} from '../database/data-source.options';

const SSL_MODES: Readonly<Record<Env['DATABASE_SSL'], string>> = {
  false: 'disable',
  true: 'require',
  'require-verify': 'verify-full',
};

/**
 * libpq settings for pg_dump. Passing them as environment variables rather
 * than arguments keeps the password off the command line and stops a
 * database name from being parsed as a connection string.
 */
export function pgEnvironment(env: MigrationEnv): Record<string, string> {
  const connection = withMigrationCredentials(env);
  return {
    PGHOST: connection.DATABASE_HOST,
    PGPORT: String(connection.DATABASE_PORT),
    PGUSER: connection.DATABASE_USERNAME,
    PGPASSWORD: connection.DATABASE_PASSWORD,
    PGDATABASE: connection.DATABASE_NAME,
    PGSSLMODE: SSL_MODES[connection.DATABASE_SSL],
    ...(connection.DATABASE_SSL === 'require-verify' && {
      PGSSLROOTCERT: 'system',
    }),
  };
}
