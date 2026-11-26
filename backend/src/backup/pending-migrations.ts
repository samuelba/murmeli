import { DataSource, type DataSourceOptions } from 'typeorm';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

/**
 * Postgres SQLSTATE class 08 (connection exception) and 57P01-57P03
 * (shutdown in progress, cannot connect now).
 */
function isPostgresConnectionState(code: string): boolean {
  return code.startsWith('08') || /^57P0[1-3]$/.test(code);
}

export function isConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, errors } = error as { code?: unknown; errors?: unknown };
  if (Array.isArray(errors) && errors.some(isConnectionError)) {
    return true;
  }
  return (
    typeof code === 'string' &&
    (NETWORK_ERROR_CODES.has(code) || isPostgresConnectionState(code))
  );
}

/**
 * @returns true when migrations are pending. An unreachable database counts
 * as pending, so the backup is still attempted and fails loudly; every other
 * error (bad credentials, a broken migration list) is rethrown.
 */
export async function hasPendingMigrations(
  options: DataSourceOptions,
  createDataSource: (options: DataSourceOptions) => DataSource = (o) =>
    new DataSource(o),
): Promise<boolean> {
  const dataSource = createDataSource(options);
  try {
    await dataSource.initialize();
    return await dataSource.showMigrations();
  } catch (error) {
    if (isConnectionError(error)) {
      return true;
    }
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}
