import type { MigrationInterface, QueryRunner } from 'typeorm';
import { narrowGrantsSql } from '../database/narrowed-grants';

/**
 * attempts is an append-only log: the runtime role keeps SELECT, INSERT and
 * DELETE from the default privileges but loses UPDATE.
 */
export const ATTEMPTS_GRANTS_SQL = narrowGrantsSql(['attempts']);

export class LearningEngine1795716581681 implements MigrationInterface {
  name = 'LearningEngine1795716581681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attempts" ("id" uuid NOT NULL DEFAULT uuidv7(), "kid_id" uuid NOT NULL, "run_id" uuid NOT NULL, "level_id" text, "skill_id" text NOT NULL, "exercise_type" text NOT NULL, "item_index" smallint NOT NULL, "attempt" smallint NOT NULL, "correct" boolean NOT NULL, "duration_ms" integer NOT NULL, "mode" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_attempts_duration_ms" CHECK ("duration_ms" >= 0), CONSTRAINT "CHK_attempts_item_index" CHECK ("item_index" >= 0), CONSTRAINT "CHK_attempts_attempt" CHECK ("attempt" BETWEEN 1 AND 2), CONSTRAINT "CHK_attempts_level_id" CHECK (("mode" = 'practice') = ("level_id" IS NULL)), CONSTRAINT "CHK_attempts_mode" CHECK ("mode" IN ('level', 'practice')), CONSTRAINT "PK_attempts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_attempts_run_item_attempt" ON "attempts" ("run_id", "item_index", "attempt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attempts_kid_created_at" ON "attempts" ("kid_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_activity" ("kid_id" uuid NOT NULL, "day" date NOT NULL, "seconds" integer NOT NULL DEFAULT '0', "runs" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_daily_activity_runs" CHECK ("runs" >= 0), CONSTRAINT "CHK_daily_activity_seconds" CHECK ("seconds" BETWEEN 0 AND 86400), CONSTRAINT "PK_daily_activity" PRIMARY KEY ("kid_id", "day"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kid_badges" ("kid_id" uuid NOT NULL, "badge_id" text NOT NULL, "earned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_kid_badges" PRIMARY KEY ("kid_id", "badge_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "level_progress" ("kid_id" uuid NOT NULL, "level_id" text NOT NULL, "stars" smallint NOT NULL DEFAULT '0', "best_score" double precision NOT NULL DEFAULT '0', "runs" integer NOT NULL DEFAULT '0', "first_passed_at" TIMESTAMP WITH TIME ZONE, "demo_seen_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_level_progress_passed" CHECK ("first_passed_at" IS NULL OR "stars" >= 2), CONSTRAINT "CHK_level_progress_runs" CHECK ("runs" >= 0), CONSTRAINT "CHK_level_progress_best_score" CHECK ("best_score" BETWEEN 0 AND 1), CONSTRAINT "CHK_level_progress_stars" CHECK ("stars" BETWEEN 0 AND 3), CONSTRAINT "PK_level_progress" PRIMARY KEY ("kid_id", "level_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "skill_mastery" ("kid_id" uuid NOT NULL, "skill_id" text NOT NULL, "mastery" double precision NOT NULL, "box" smallint NOT NULL, "next_review_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_skill_mastery_box" CHECK ("box" BETWEEN 1 AND 5), CONSTRAINT "CHK_skill_mastery_mastery" CHECK ("mastery" BETWEEN 0 AND 1), CONSTRAINT "PK_skill_mastery" PRIMARY KEY ("kid_id", "skill_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_skill_mastery_kid_next_review" ON "skill_mastery" ("kid_id", "next_review_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attempts" ADD CONSTRAINT "FK_attempts_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_activity" ADD CONSTRAINT "FK_daily_activity_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kid_badges" ADD CONSTRAINT "FK_kid_badges_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "level_progress" ADD CONSTRAINT "FK_level_progress_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill_mastery" ADD CONSTRAINT "FK_skill_mastery_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(ATTEMPTS_GRANTS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "skill_mastery" DROP CONSTRAINT "FK_skill_mastery_kid_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "level_progress" DROP CONSTRAINT "FK_level_progress_kid_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kid_badges" DROP CONSTRAINT "FK_kid_badges_kid_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_activity" DROP CONSTRAINT "FK_daily_activity_kid_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attempts" DROP CONSTRAINT "FK_attempts_kid_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_skill_mastery_kid_next_review"`,
    );
    await queryRunner.query(`DROP TABLE "skill_mastery"`);
    await queryRunner.query(`DROP TABLE "level_progress"`);
    await queryRunner.query(`DROP TABLE "kid_badges"`);
    await queryRunner.query(`DROP TABLE "daily_activity"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_attempts_kid_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_attempts_run_item_attempt"`,
    );
    await queryRunner.query(`DROP TABLE "attempts"`);
  }
}
