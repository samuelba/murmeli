import type { DataSource, DataSourceOptions } from 'typeorm';
import { hasPendingMigrations, isConnectionError } from './pending-migrations';

function fakeDataSource(
  overrides: Partial<Record<'initialize' | 'showMigrations', jest.Mock>>,
) {
  return {
    isInitialized: false,
    initialize: jest.fn(function (this: { isInitialized: boolean }) {
      this.isInitialized = true;
      return Promise.resolve();
    }),
    showMigrations: jest.fn().mockResolvedValue(false),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const options = { type: 'postgres' } as DataSourceOptions;
const withCode = (code: string) =>
  Object.assign(new Error(`failed with ${code}`), { code });

describe('isConnectionError', () => {
  it.each(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '08006', '57P03'])(
    'treats %s as a connection error',
    (code) => {
      expect(isConnectionError(withCode(code))).toBe(true);
    },
  );

  it('looks inside aggregate errors', () => {
    expect(
      isConnectionError(
        new AggregateError([withCode('ECONNREFUSED')], 'connect failed'),
      ),
    ).toBe(true);
  });

  it.each([
    ['bad credentials', withCode('28P01')],
    ['a missing database', withCode('3D000')],
    ['an error without code', new Error('migration name is wrong')],
    ['a non-object', 'ECONNREFUSED'],
    ['null', null],
  ])('does not treat %s as a connection error', (_label, error) => {
    expect(isConnectionError(error)).toBe(false);
  });
});

describe('hasPendingMigrations', () => {
  it('asks TypeORM and closes the connection', async () => {
    const dataSource = fakeDataSource({
      showMigrations: jest.fn().mockResolvedValue(true),
    });

    await expect(
      hasPendingMigrations(options, () => dataSource as unknown as DataSource),
    ).resolves.toBe(true);
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('assumes pending migrations when the database is unreachable', async () => {
    const dataSource = fakeDataSource({
      initialize: jest.fn().mockRejectedValue(withCode('ECONNREFUSED')),
    });

    await expect(
      hasPendingMigrations(options, () => dataSource as unknown as DataSource),
    ).resolves.toBe(true);
    expect(dataSource.destroy).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong credentials', withCode('28P01')],
    ['a broken migration list', new Error('migration name is wrong')],
  ])('rethrows %s', async (_label, error) => {
    const dataSource = fakeDataSource({
      showMigrations: jest.fn().mockRejectedValue(error),
    });

    await expect(
      hasPendingMigrations(options, () => dataSource as unknown as DataSource),
    ).rejects.toBe(error);
    expect(dataSource.destroy).toHaveBeenCalled();
  });

  it('creates a real DataSource by default', async () => {
    await expect(
      hasPendingMigrations({
        type: 'postgres',
        host: '127.0.0.1',
        port: 1,
        connectTimeoutMS: 200,
      }),
    ).resolves.toBe(true);
  });
});
