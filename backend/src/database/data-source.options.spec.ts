import { validRawEnv } from '../../test/fixtures/env';
import {
  ENTITIES_GLOB,
  MIGRATIONS_GLOB,
  buildDataSourceOptions,
  typeOrmSsl,
  withMigrationCredentials,
} from './data-source.options';
import { loadDatabaseEnv } from './database-env';

describe('buildDataSourceOptions', () => {
  it('never synchronizes and loads migrations from src/migrations', () => {
    const options = buildDataSourceOptions(loadDatabaseEnv(validRawEnv()));

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'murmeli',
      ssl: false,
      synchronize: false,
      migrations: [MIGRATIONS_GLOB],
      entities: [ENTITIES_GLOB],
    });
    expect(MIGRATIONS_GLOB).toMatch(/[/\\]migrations[/\\]\*\.ts$/);
    expect(ENTITIES_GLOB).toMatch(/\*\.entity\.ts$/);
  });

  it('never runs migrations on initialize, so backups come first', () => {
    const options = buildDataSourceOptions(
      loadDatabaseEnv(validRawEnv({ DB_MIGRATIONS_RUN: 'true' })),
    );

    expect(options).not.toHaveProperty('migrationsRun');
  });
});

describe('typeOrmSsl', () => {
  it.each([
    ['false', false],
    ['true', { rejectUnauthorized: false }],
    ['require-verify', { rejectUnauthorized: true }],
  ] as const)('%s -> %p', (mode, expected) => {
    expect(typeOrmSsl(mode)).toEqual(expected);
  });
});

describe('withMigrationCredentials', () => {
  it('uses the migration role when configured', () => {
    const env = loadDatabaseEnv(
      validRawEnv({
        DB_MIGRATION_USERNAME: 'owner',
        DB_MIGRATION_PASSWORD: 'owner-pw',
      }),
    );

    expect(withMigrationCredentials(env)).toMatchObject({
      DATABASE_USERNAME: 'owner',
      DATABASE_PASSWORD: 'owner-pw',
    });
  });

  it('falls back to the runtime role', () => {
    expect(
      withMigrationCredentials(loadDatabaseEnv(validRawEnv())),
    ).toMatchObject({ DATABASE_USERNAME: 'murmeli' });
  });
});

describe('loadDatabaseEnv', () => {
  it('only needs the database variables', () => {
    expect(
      loadDatabaseEnv({
        DATABASE_HOST: 'db',
        DATABASE_USERNAME: 'u',
        DATABASE_PASSWORD: 'p',
      }),
    ).toEqual({
      DATABASE_HOST: 'db',
      DATABASE_PORT: 5432,
      DATABASE_USERNAME: 'u',
      DATABASE_PASSWORD: 'p',
      DATABASE_NAME: 'murmeli',
      DATABASE_SSL: 'false',
      DB_MIGRATIONS_RUN: true,
    });
  });

  it('fails with a clear message', () => {
    expect(() => loadDatabaseEnv({})).toThrow(/DATABASE_HOST: is required/);
  });

  it('requires both migration credentials', () => {
    expect(() =>
      loadDatabaseEnv(validRawEnv({ DB_MIGRATION_USERNAME: 'owner' })),
    ).toThrow(/must be set together/);
  });
});
