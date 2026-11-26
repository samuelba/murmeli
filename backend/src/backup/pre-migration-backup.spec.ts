import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validRawEnv } from '../../test/fixtures/env';
import {
  type BackupDeps,
  defaultBackupDeps,
  runPreMigrationBackup,
} from './pre-migration-backup';

function deps(overrides: Partial<BackupDeps> = {}): BackupDeps {
  return {
    hasPendingMigrations: jest.fn().mockResolvedValue(true),
    createBackup: jest.fn().mockResolvedValue('/backups/backup_1.sql.gz'),
    pruneBackups: jest.fn().mockResolvedValue(['backup_0.sql.gz']),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const log = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('runPreMigrationBackup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('backs up and applies retention when migrations are pending', async () => {
    const d = deps();

    await expect(
      runPreMigrationBackup(
        validRawEnv({
          BACKUP_DIR: '/backups',
          BACKUP_KEEP_COUNT: '3',
          BACKUP_MAX_AGE_DAYS: '14',
        }),
        d,
        log,
      ),
    ).resolves.toBe(0);
    expect(d.ensureDir).toHaveBeenCalledWith('/backups');
    expect(d.createBackup).toHaveBeenCalled();
    expect(d.pruneBackups).toHaveBeenCalledWith('/backups', {
      keepCount: 3,
      maxAgeDays: 14,
    });
    expect(log.log).toHaveBeenCalledWith('Deleted old backup: backup_0.sql.gz');
  });

  it('still applies retention when nothing is pending', async () => {
    const d = deps({
      hasPendingMigrations: jest.fn().mockResolvedValue(false),
    });

    await expect(runPreMigrationBackup(validRawEnv(), d, log)).resolves.toBe(0);
    expect(d.createBackup).not.toHaveBeenCalled();
    expect(d.pruneBackups).toHaveBeenCalled();
  });

  it('fails when the backup fails and BACKUP_MANDATORY is on', async () => {
    const d = deps({
      createBackup: jest.fn().mockRejectedValue(new Error('disk full')),
    });

    await expect(runPreMigrationBackup(validRawEnv(), d, log)).resolves.toBe(1);
    expect(log.error).toHaveBeenCalledWith('Backup failed: disk full');
    expect(d.pruneBackups).toHaveBeenCalled();
  });

  it('continues when BACKUP_MANDATORY=false', async () => {
    const d = deps({
      hasPendingMigrations: jest.fn().mockRejectedValue(new Error('28P01')),
    });

    await expect(
      runPreMigrationBackup(validRawEnv({ BACKUP_MANDATORY: 'false' }), d, log),
    ).resolves.toBe(0);
    expect(log.warn).toHaveBeenCalled();
  });

  it('only warns when retention fails', async () => {
    const d = deps({
      hasPendingMigrations: jest.fn().mockResolvedValue(false),
      pruneBackups: jest.fn().mockRejectedValue(new Error('EACCES')),
    });

    await expect(runPreMigrationBackup(validRawEnv(), d, log)).resolves.toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      'Could not prune old backups: EACCES',
    );
  });

  it('fails on invalid configuration', async () => {
    await expect(runPreMigrationBackup({}, deps(), log)).resolves.toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_HOST: is required'),
    );
  });
});

describe('defaultBackupDeps', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'murmeli-deps-'));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('creates the backup directory with mode 0700', async () => {
    const target = join(dir, 'backups');

    await defaultBackupDeps.ensureDir(target);

    expect((await stat(target)).mode & 0o777).toBe(0o700);
  });

  it('prunes an empty directory', async () => {
    await expect(
      defaultBackupDeps.pruneBackups(dir, { keepCount: 1, maxAgeDays: 1 }),
    ).resolves.toEqual([]);
  });
});
