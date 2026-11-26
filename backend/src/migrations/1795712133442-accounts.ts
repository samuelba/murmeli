import type { MigrationInterface, QueryRunner } from 'typeorm';

export const AUDIT_LOG_GRANTS_SQL = `
DO $$
DECLARE grantee_name text;
BEGIN
  FOR grantee_name IN
    SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND privilege_type = 'UPDATE' AND grantee <> current_user
  LOOP
    EXECUTE format('REVOKE UPDATE ON "audit_log" FROM %I', grantee_name);
    EXECUTE format(
      'GRANT UPDATE ("actor_id", "ip", "target_id") ON "audit_log" TO %I',
      grantee_name
    );
  END LOOP;
END
$$`;

export class Accounts1795712133442 implements MigrationInterface {
  name = 'Accounts1795712133442';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuidv7(), "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_id" uuid, "action" text NOT NULL, "target_type" text, "target_id" text, "ip" text, "meta" jsonb, CONSTRAINT "CHK_audit_log_target_type" CHECK ("target_type" IS NULL OR "target_type" IN ('user', 'kid', 'invite', 'setting')), CONSTRAINT "CHK_audit_log_action" CHECK ("action" IN ('auth.login', 'auth.login_failed', 'auth.logout', 'auth.session_compromised', 'auth.password_reset', 'auth.password_changed', 'auth.email_changed', 'auth.totp_enabled', 'auth.totp_disabled', 'account.deleted', 'admin.user_updated', 'admin.user_deleted', 'admin.invite_created', 'admin.invite_revoked', 'admin.settings_updated', 'kid.created', 'kid.deleted', 'kid.pin_locked')), CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_actor_id" ON "audit_log" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "email" citext NOT NULL, "password_hash" text NOT NULL, "role" text NOT NULL DEFAULT 'parent', "locale" text NOT NULL DEFAULT 'de-CH', "theme" text, "email_verified_at" TIMESTAMP WITH TIME ZONE, "totp_enabled" boolean NOT NULL DEFAULT false, "disabled" boolean NOT NULL DEFAULT false, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "CHK_users_theme" CHECK ("theme" IS NULL OR "theme" IN ('light', 'dark', 'system')), CONSTRAINT "CHK_users_locale" CHECK ("locale" IN ('de-CH', 'en-US')), CONSTRAINT "CHK_users_role" CHECK ("role" IN ('parent', 'admin')), CONSTRAINT "PK_users_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_active_admins" ON "users" ("id") WHERE "role" = 'admin' AND "disabled" = false`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_tokens" ("id" uuid NOT NULL DEFAULT uuidv7(), "user_id" uuid NOT NULL, "type" text NOT NULL, "token_hash" text NOT NULL, "new_email" citext, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_email_tokens_token_hash" UNIQUE ("token_hash"), CONSTRAINT "CHK_email_tokens_new_email" CHECK (("type" = 'email_change') = ("new_email" IS NOT NULL)), CONSTRAINT "CHK_email_tokens_type" CHECK ("type" IN ('registration', 'password_reset', 'email_change')), CONSTRAINT "PK_email_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_tokens_expires_at" ON "email_tokens" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_tokens_user_id" ON "email_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_email_tokens_open" ON "email_tokens" ("user_id", "type") WHERE "used_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "invites" ("id" uuid NOT NULL DEFAULT uuidv7(), "email" citext NOT NULL, "role" text NOT NULL DEFAULT 'parent', "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "accepted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_invites_token_hash" UNIQUE ("token_hash"), CONSTRAINT "CHK_invites_role" CHECK ("role" IN ('parent', 'admin')), CONSTRAINT "PK_invites_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invites_expires_at" ON "invites" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invites_created_by" ON "invites" ("created_by")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invites_pending_email" ON "invites" ("email") WHERE "accepted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "recovery_codes" ("id" uuid NOT NULL DEFAULT uuidv7(), "user_id" uuid NOT NULL, "code_hash" text NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_recovery_codes_user_id_code_hash" UNIQUE ("user_id", "code_hash"), CONSTRAINT "PK_recovery_codes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuidv7(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" text NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "revoked_reason" text, "replaced_by" uuid, "user_agent" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"), CONSTRAINT "CHK_refresh_tokens_revoked_reason" CHECK ("revoked_reason" IS NULL OR "revoked_reason" IN ('rotated', 'logout', 'compromised', 'password_changed', 'password_reset', 'email_changed', 'disabled', 'role_changed', 'deleted')), CONSTRAINT "CHK_refresh_tokens_user_agent_length" CHECK (char_length("user_agent") <= 200), CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_active_user" ON "refresh_tokens" ("user_id", "family_id") WHERE "revoked" = false`,
    );
    await queryRunner.query(
      `CREATE TABLE "totp_secrets" ("user_id" uuid NOT NULL, "secret_encrypted" text NOT NULL, "confirmed_at" TIMESTAMP WITH TIME ZONE, "last_used_step" bigint, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_totp_secrets_user_id" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kids" ("id" uuid NOT NULL DEFAULT uuidv7(), "user_id" uuid NOT NULL, "nickname" text NOT NULL, "avatar" jsonb NOT NULL, "start_class" text NOT NULL, "birth_year" smallint, "language" text NOT NULL, "pin_hash" text, "daily_limit_minutes" smallint, "sound_enabled" boolean NOT NULL DEFAULT true, "read_aloud" text NOT NULL DEFAULT 'auto', "last_active_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_kids_daily_limit_minutes" CHECK ("daily_limit_minutes" IS NULL OR "daily_limit_minutes" BETWEEN 5 AND 240), CONSTRAINT "CHK_kids_birth_year" CHECK ("birth_year" IS NULL OR "birth_year" BETWEEN 2000 AND 2100), CONSTRAINT "CHK_kids_read_aloud" CHECK ("read_aloud" IN ('auto', 'on', 'off')), CONSTRAINT "CHK_kids_language" CHECK ("language" IN ('de-CH', 'en-US')), CONSTRAINT "CHK_kids_start_class" CHECK ("start_class" IN ('KG1', 'KG2', '1', '2')), CONSTRAINT "CHK_kids_nickname_length" CHECK (char_length("nickname") BETWEEN 1 AND 20), CONSTRAINT "CHK_kids_nickname_not_blank" CHECK (btrim("nickname") <> ''), CONSTRAINT "PK_kids_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kids_user_id" ON "kids" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_tokens" ADD CONSTRAINT "FK_email_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" ADD CONSTRAINT "FK_invites_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recovery_codes" ADD CONSTRAINT "FK_recovery_codes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "totp_secrets" ADD CONSTRAINT "FK_totp_secrets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kids" ADD CONSTRAINT "FK_kids_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_active_family" ON "refresh_tokens" ("family_id") INCLUDE ("expires_at") WHERE "revoked" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_at_id" ON "audit_log" ("at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_action_at_id" ON "audit_log" ("action", "at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `INSERT INTO "app_settings" ("key", "value", "source") VALUES ('require_admin_totp', 'false'::jsonb, 'env') ON CONFLICT ("key") DO NOTHING`,
    );
    await queryRunner.query(AUDIT_LOG_GRANTS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "app_settings" WHERE "key" = 'require_admin_totp'`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_action_at_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_at_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_active_family"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kids" DROP CONSTRAINT "FK_kids_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "totp_secrets" DROP CONSTRAINT "FK_totp_secrets_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recovery_codes" DROP CONSTRAINT "FK_recovery_codes_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" DROP CONSTRAINT "FK_invites_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_tokens" DROP CONSTRAINT "FK_email_tokens_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_kids_user_id"`);
    await queryRunner.query(`DROP TABLE "kids"`);
    await queryRunner.query(`DROP TABLE "totp_secrets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_active_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "recovery_codes"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_invites_pending_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invites_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invites_expires_at"`);
    await queryRunner.query(`DROP TABLE "invites"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_email_tokens_open"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_email_tokens_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_email_tokens_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "email_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_active_admins"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_actor_id"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
  }
}
