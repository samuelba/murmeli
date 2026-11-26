import type { DataSource } from 'typeorm';
import { validRawEnv } from '../../test/fixtures/env';
import { runMigrations, runtimeRole } from './migrate';
import { APP_ROLE_SETTING, narrowGrantsSql } from './narrowed-grants';

function fakeDataSource(overrides: Record<string, jest.Mock> = {}) {
  const manager = { query: jest.fn().mockResolvedValue([]) };
  const dataSource = {
    isInitialized: false,
    initialize: jest.fn(function (this: { isInitialized: boolean }) {
      this.isInitialized = true;
      return Promise.resolve();
    }),
    runMigrations: jest.fn().mockResolvedValue([{ name: 'InitialSetup1' }]),
    manager,
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return dataSource;
}

const log = { log: jest.fn(), error: jest.fn() };

describe('runtimeRole', () => {
  const env = {
    DATABASE_USERNAME: 'murmeli_app',
  } as Parameters<typeof runtimeRole>[0];

  it('is the app role only when a separate migration role is set', () => {
    expect(runtimeRole({ ...env, DB_MIGRATION_USERNAME: 'murmeli' })).toBe(
      'murmeli_app',
    );
    expect(runtimeRole(env)).toBeNull();
    expect(runtimeRole({ ...env, DB_MIGRATION_USERNAME: 'murmeli_app' })).toBe(
      null,
    );
  });
});

describe('runMigrations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('migrates as the migration role in one transaction', async () => {
    const dataSource = fakeDataSource();
    const create = jest.fn(() => dataSource as unknown as DataSource);

    await expect(
      runMigrations(
        validRawEnv({
          DB_MIGRATION_USERNAME: 'owner',
          DB_MIGRATION_PASSWORD: 'pw',
        }),
        create,
        log,
      ),
    ).resolves.toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'owner', password: 'pw' }),
    );
    expect(dataSource.runMigrations).toHaveBeenCalledWith({
      transaction: 'all',
    });
    expect(log.log).toHaveBeenCalledWith('Applied migrations: InitialSetup1');
    expect(dataSource.manager.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, true)',
      [APP_ROLE_SETTING, 'murmeli'],
    );
    expect(dataSource.manager.query).toHaveBeenCalledWith(narrowGrantsSql());
    expect(log.log).toHaveBeenCalledWith(
      'Narrowed grants re-asserted, also for murmeli.',
    );
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('re-asserts the grants even when no migration is pending', async () => {
    const dataSource = fakeDataSource({
      runMigrations: jest.fn().mockResolvedValue([]),
    });

    await expect(
      runMigrations(validRawEnv(), () => dataSource as never, log),
    ).resolves.toBe(0);

    expect(dataSource.manager.query).toHaveBeenCalledWith(narrowGrantsSql());
    expect(log.log).toHaveBeenCalledWith('Narrowed grants re-asserted.');
  });

  it('fails when the grants cannot be re-asserted', async () => {
    const dataSource = fakeDataSource({
      transaction: jest.fn().mockRejectedValue(new Error('permission denied')),
    });

    await expect(
      runMigrations(validRawEnv(), () => dataSource as never, log),
    ).resolves.toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      'Migration failed: permission denied',
    );
  });

  it('reports an up-to-date schema', async () => {
    const dataSource = fakeDataSource({
      runMigrations: jest.fn().mockResolvedValue([]),
    });

    await runMigrations(validRawEnv(), () => dataSource as never, log);

    expect(log.log).toHaveBeenCalledWith('Database schema is up to date.');
  });

  it('fails when a migration fails', async () => {
    const dataSource = fakeDataSource({
      runMigrations: jest.fn().mockRejectedValue(new Error('syntax error')),
    });

    await expect(
      runMigrations(validRawEnv(), () => dataSource as never, log),
    ).resolves.toBe(1);
    expect(log.error).toHaveBeenCalledWith('Migration failed: syntax error');
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('fails when the database is unreachable', async () => {
    const dataSource = fakeDataSource({
      initialize: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });

    await expect(
      runMigrations(validRawEnv(), () => dataSource as never, log),
    ).resolves.toBe(1);
    expect(dataSource.destroy).not.toHaveBeenCalled();
  });

  it('fails on invalid configuration', async () => {
    await expect(runMigrations({}, jest.fn(), log)).resolves.toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_HOST: is required'),
    );
  });
});
