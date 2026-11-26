import { mkdir } from 'node:fs/promises';
import { errorMessage } from '../common/errors/error-message';
import {
  buildDataSourceOptions,
  withMigrationCredentials,
} from '../database/data-source.options';
import { type BackupEnv, loadBackupEnv } from './backup-config';
import { hasPendingMigrations } from './pending-migrations';
import { createBackup } from './pg-dump';
import { type RetentionPolicy, pruneBackups } from './retention';

export type Log = Pick<Console, 'log' | 'warn' | 'error'>;

export interface BackupDeps {
  readonly hasPendingMigrations: (env: BackupEnv) => Promise<boolean>;
  readonly createBackup: (env: BackupEnv) => Promise<string>;
  readonly pruneBackups: (
    dir: string,
    policy: RetentionPolicy,
  ) => Promise<string[]>;
  readonly ensureDir: (dir: string) => Promise<unknown>;
}

export const defaultBackupDeps: BackupDeps = {
  hasPendingMigrations: (env) =>
    hasPendingMigrations(buildDataSourceOptions(withMigrationCredentials(env))),
  createBackup: (env) => createBackup(env),
  pruneBackups: (dir, policy) => pruneBackups(dir, policy),
  ensureDir: (dir) => mkdir(dir, { recursive: true, mode: 0o700 }),
};

async function backupIfPending(env: BackupEnv, deps: BackupDeps, log: Log) {
  if (!(await deps.hasPendingMigrations(env))) {
    log.log('No pending migrations. Skipping backup.');
    return;
  }
  log.log('Pending migrations detected. Creating backup...');
  log.log(`Backup created: ${await deps.createBackup(env)}`);
}

async function applyRetention(env: BackupEnv, deps: BackupDeps, log: Log) {
  try {
    const removed = await deps.pruneBackups(env.BACKUP_DIR, {
      keepCount: env.BACKUP_KEEP_COUNT,
      maxAgeDays: env.BACKUP_MAX_AGE_DAYS,
    });
    removed.forEach((name) => log.log(`Deleted old backup: ${name}`));
  } catch (error) {
    log.warn(`Could not prune old backups: ${errorMessage(error)}`);
  }
}

/**
 * @returns the process exit code: 1 only when the backup failed and
 * BACKUP_MANDATORY is on
 */
export async function runPreMigrationBackup(
  raw: Record<string, unknown>,
  deps: BackupDeps = defaultBackupDeps,
  log: Log = console,
): Promise<number> {
  let env: BackupEnv;
  try {
    env = loadBackupEnv(raw);
  } catch (error) {
    log.error(errorMessage(error));
    return 1;
  }

  log.log(
    `Pre-migration backup of ${env.DATABASE_NAME}@${env.DATABASE_HOST}:${env.DATABASE_PORT} into ${env.BACKUP_DIR}`,
  );
  let code = 0;
  try {
    await deps.ensureDir(env.BACKUP_DIR);
    await backupIfPending(env, deps, log);
  } catch (error) {
    log.error(`Backup failed: ${errorMessage(error)}`);
    if (env.BACKUP_MANDATORY) {
      log.error('BACKUP_MANDATORY is on. Refusing to migrate.');
      code = 1;
    } else {
      log.warn('BACKUP_MANDATORY=false, continuing without a backup.');
    }
  }
  await applyRetention(env, deps, log);
  return code;
}
