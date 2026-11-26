import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { Env } from '../../config/env.schema';
import {
  APPLY_ENV_SETTING_SQL,
  AppSettingsBootstrap,
} from './app-settings.bootstrap';

function bootstrap(query: jest.Mock, registrationEnabled: boolean) {
  return new AppSettingsBootstrap(
    { query } as unknown as DataSource,
    { get: () => registrationEnabled } as unknown as ConfigService<Env, true>,
  );
}

describe('AppSettingsBootstrap', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([true, false])(
    'applies REGISTRATION_ENABLED=%p with a parameterized upsert',
    async (enabled) => {
      const query = jest.fn().mockResolvedValue([]);

      await bootstrap(query, enabled).onApplicationBootstrap();

      expect(query).toHaveBeenCalledWith(APPLY_ENV_SETTING_SQL, [
        'registration_enabled',
        String(enabled),
      ]);
    },
  );

  it('never overrides a value an admin changed', () => {
    expect(APPLY_ENV_SETTING_SQL).toContain(
      `WHERE "app_settings"."source" = 'env'`,
    );
  });

  it('logs instead of crashing when the table is missing', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const query = jest
      .fn()
      .mockRejectedValue(new Error('relation "app_settings" does not exist'));

    await expect(
      bootstrap(query, true).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Could not apply REGISTRATION_ENABLED'),
    );
  });
});
