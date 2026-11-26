import type { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.session_compromised',
  'auth.password_reset',
  'auth.password_changed',
  'auth.email_changed',
  'auth.totp_enabled',
  'auth.totp_disabled',
  'account.deleted',
  'admin.user_updated',
  'admin.user_deleted',
  'admin.invite_created',
  'admin.invite_revoked',
  'admin.settings_updated',
  'kid.created',
  'kid.deleted',
  'kid.pin_locked',
];

const ACTIONS = [
  ...PREVIOUS_ACTIONS.slice(0, PREVIOUS_ACTIONS.indexOf('kid.created')),
  'admin.password_reset_link_created',
  'admin.email_verified',
  ...PREVIOUS_ACTIONS.slice(PREVIOUS_ACTIONS.indexOf('kid.created')),
];

function actionCheck(actions: readonly string[]): string {
  return `CHECK ("action" IN (${actions.map((a) => `'${a}'`).join(', ')}))`;
}

/**
 * Audit actions for the admin reset link and manual email verification, and
 * an index on attempts.created_at for the attempts retention job.
 */
export class AdminRecoveryAttemptsRetention1795720261819 implements MigrationInterface {
  name = 'AdminRecoveryAttemptsRetention1795720261819';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_log" DROP CONSTRAINT "CHK_audit_log_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "CHK_audit_log_action" ${actionCheck(ACTIONS)}`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attempts_created_at" ON "attempts" ("created_at")`,
    );
  }

  /** Keeps entries with the new actions; the old check is not re-validated. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_attempts_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "audit_log" DROP CONSTRAINT "CHK_audit_log_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "CHK_audit_log_action" ${actionCheck(PREVIOUS_ACTIONS)} NOT VALID`,
    );
  }
}
