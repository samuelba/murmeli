import { productionRawEnv, validRawEnv } from '../../test/fixtures/env';
import type { AppConfigService } from '../config/app-config';
import { validateEnv } from '../config/validate-env';
import { typeOrmOptionsFactory } from './typeorm-options.factory';

function config(raw: Record<string, string | undefined>): AppConfigService {
  const env = validateEnv(raw, { warn: jest.fn() }) as Record<string, unknown>;
  return { get: (key: string) => env[key] } as unknown as AppConfigService;
}

describe('typeOrmOptionsFactory', () => {
  it('never runs migrations from the app in production', () => {
    expect(
      typeOrmOptionsFactory(
        config(productionRawEnv({ DB_MIGRATIONS_RUN: 'true' })),
      ),
    ).toMatchObject({ migrationsRun: false, synchronize: false });
  });

  it.each(['development', 'test'])(
    'runs migrations at startup in %s when enabled',
    (nodeEnv) => {
      expect(
        typeOrmOptionsFactory(config(validRawEnv({ NODE_ENV: nodeEnv })))
          .migrationsRun,
      ).toBe(true);
    },
  );

  it('respects DB_MIGRATIONS_RUN=false', () => {
    expect(
      typeOrmOptionsFactory(config(validRawEnv({ DB_MIGRATIONS_RUN: 'false' })))
        .migrationsRun,
    ).toBe(false);
  });

  it('connects as the runtime role with retries', () => {
    expect(
      typeOrmOptionsFactory(
        config(
          validRawEnv({
            DB_MIGRATION_USERNAME: 'owner',
            DB_MIGRATION_PASSWORD: 'pw',
            DATABASE_SSL: 'true',
          }),
        ),
      ),
    ).toMatchObject({
      username: 'murmeli',
      ssl: { rejectUnauthorized: false },
      retryAttempts: 10,
    });
  });
});
