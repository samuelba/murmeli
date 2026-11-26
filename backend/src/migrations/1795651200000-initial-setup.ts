import type { MigrationInterface, QueryRunner } from 'typeorm';
import { REGISTRATION_ENABLED_SETTING } from '../modules/settings/app-setting.keys';

export class InitialSetup1795651200000 implements MigrationInterface {
  name = 'InitialSetup1795651200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "key" text NOT NULL,
        "value" jsonb NOT NULL,
        "source" text NOT NULL DEFAULT 'env',
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings_key" PRIMARY KEY ("key"),
        CONSTRAINT "CHK_app_settings_source" CHECK ("source" IN ('env', 'admin'))
      )
    `);
    await queryRunner.query(
      `INSERT INTO "app_settings" ("key", "value", "source")
       VALUES ($1, 'false'::jsonb, 'env')
       ON CONFLICT ("key") DO NOTHING`,
      [REGISTRATION_ENABLED_SETTING],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_settings"`);
  }
}
