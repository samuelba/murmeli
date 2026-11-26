import { validRawEnv } from '../../test/fixtures/env';
import { loadBackupEnv } from './backup-config';
import { pgEnvironment } from './pg-environment';

describe('pgEnvironment', () => {
  it('passes the connection as libpq variables', () => {
    expect(pgEnvironment(loadBackupEnv(validRawEnv()))).toEqual({
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'murmeli',
      PGPASSWORD: 'murmeli',
      PGDATABASE: 'murmeli',
      PGSSLMODE: 'disable',
    });
  });

  it('dumps as the migration role', () => {
    expect(
      pgEnvironment(
        loadBackupEnv(
          validRawEnv({
            DB_MIGRATION_USERNAME: 'owner',
            DB_MIGRATION_PASSWORD: 'owner-pw',
          }),
        ),
      ),
    ).toMatchObject({ PGUSER: 'owner', PGPASSWORD: 'owner-pw' });
  });

  it.each([
    ['true', { PGSSLMODE: 'require' }],
    ['require-verify', { PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system' }],
  ])('maps DATABASE_SSL=%s', (mode, expected) => {
    expect(
      pgEnvironment(loadBackupEnv(validRawEnv({ DATABASE_SSL: mode }))),
    ).toMatchObject(expected);
  });
});
