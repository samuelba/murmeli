import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { errorMessage } from '../../common/errors/error-message';
import type { Env } from '../../config/env.schema';
import { REGISTRATION_ENABLED_SETTING } from './app-setting.keys';

export const APPLY_ENV_SETTING_SQL = `
  INSERT INTO "app_settings" ("key", "value", "source")
  VALUES ($1, $2::jsonb, 'env')
  ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value", "updated_at" = now()
    WHERE "app_settings"."source" = 'env'
      AND "app_settings"."value" IS DISTINCT FROM EXCLUDED."value"`;

/**
 * Applies REGISTRATION_ENABLED until an admin changes the setting; from then
 * on (source = 'admin') the stored value wins.
 */
@Injectable()
export class AppSettingsBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppSettingsBootstrap.name);
  private readonly registrationEnabled: boolean;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService<Env, true>,
  ) {
    this.registrationEnabled = config.get('REGISTRATION_ENABLED', {
      infer: true,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.dataSource.query(APPLY_ENV_SETTING_SQL, [
        REGISTRATION_ENABLED_SETTING,
        JSON.stringify(this.registrationEnabled),
      ]);
    } catch (error) {
      this.logger.error(
        `Could not apply REGISTRATION_ENABLED: ${errorMessage(error)}`,
      );
    }
  }
}
