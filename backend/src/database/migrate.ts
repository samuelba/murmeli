import { DataSource, type DataSourceOptions } from 'typeorm';
import { errorMessage } from '../common/errors/error-message';
import {
  buildDataSourceOptions,
  withMigrationCredentials,
} from './data-source.options';
import { type DatabaseEnv, loadDatabaseEnv } from './database-env';
import { assertNarrowedGrants } from './narrowed-grants';

export type Log = Pick<Console, 'log' | 'error'>;
export type DataSourceFactory = (options: DataSourceOptions) => DataSource;

/**
 * The least-privileged role the app runs as, when it is not the migration
 * role itself.
 */
export function runtimeRole(env: DatabaseEnv): string | null {
  return env.DB_MIGRATION_USERNAME !== undefined &&
    env.DB_MIGRATION_USERNAME !== env.DATABASE_USERNAME
    ? env.DATABASE_USERNAME
    : null;
}

/**
 * Applies pending migrations, then re-asserts the narrowed grants (also after
 * a restore, when no migration is pending).
 *
 * @returns the process exit code
 */
export async function runMigrations(
  raw: Record<string, unknown>,
  createDataSource: DataSourceFactory = (options) => new DataSource(options),
  log: Log = console,
): Promise<number> {
  let env: DatabaseEnv;
  try {
    env = loadDatabaseEnv(raw);
  } catch (error) {
    log.error(errorMessage(error));
    return 1;
  }

  const dataSource = createDataSource(
    buildDataSourceOptions(withMigrationCredentials(env)),
  );
  try {
    await dataSource.initialize();
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    log.log(
      applied.length === 0
        ? 'Database schema is up to date.'
        : `Applied migrations: ${applied.map((m) => m.name).join(', ')}`,
    );
    const appRole = runtimeRole(env);
    await dataSource.transaction((manager) =>
      assertNarrowedGrants(manager, appRole),
    );
    log.log(
      appRole === null
        ? 'Narrowed grants re-asserted.'
        : `Narrowed grants re-asserted, also for ${appRole}.`,
    );
    return 0;
  } catch (error) {
    log.error(`Migration failed: ${errorMessage(error)}`);
    return 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}
