import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'practice_topic_progress',
  'practice_daily',
  'practice_reviews',
];

/**
 * The practice ground: an adaptive rating per kid and topic, practice
 * counts per day, and the mistakes that are asked again later.
 */
export class PracticeGround1795867200000 implements MigrationInterface {
  name = 'PracticeGround1795867200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "practice_topic_progress" ("kid_id" uuid NOT NULL, "topic_id" text NOT NULL, "rating" double precision NOT NULL, "path_step" smallint NOT NULL DEFAULT '-1', "runs" integer NOT NULL DEFAULT '0', "items" integer NOT NULL DEFAULT '0', "first_try" integer NOT NULL DEFAULT '0', "accuracy" double precision, "demo_seen_at" TIMESTAMP WITH TIME ZONE, "last_practiced_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_practice_topic_progress_rating" CHECK ("rating" >= 0 AND "rating" < 100), CONSTRAINT "CHK_practice_topic_progress_path_step" CHECK ("path_step" >= -1), CONSTRAINT "CHK_practice_topic_progress_runs" CHECK ("runs" >= 0), CONSTRAINT "CHK_practice_topic_progress_first_try" CHECK ("first_try" BETWEEN 0 AND "items"), CONSTRAINT "CHK_practice_topic_progress_accuracy" CHECK ("accuracy" BETWEEN 0 AND 1), CONSTRAINT "PK_practice_topic_progress" PRIMARY KEY ("kid_id", "topic_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "practice_daily" ("kid_id" uuid NOT NULL, "topic_id" text NOT NULL, "day" date NOT NULL, "items" integer NOT NULL DEFAULT '0', "first_try" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_practice_daily_first_try" CHECK ("first_try" BETWEEN 0 AND "items"), CONSTRAINT "PK_practice_daily" PRIMARY KEY ("kid_id", "topic_id", "day"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_practice_daily_kid_day" ON "practice_daily" ("kid_id", "day")`,
    );
    await queryRunner.query(
      `CREATE TABLE "practice_reviews" ("id" uuid NOT NULL DEFAULT uuidv7(), "kid_id" uuid NOT NULL, "topic_id" text NOT NULL, "locale" text NOT NULL, "item_key" text NOT NULL, "level_id" text NOT NULL, "generator" smallint NOT NULL, "seed" bigint NOT NULL, "source_topic" text, "tier" smallint NOT NULL, "box" smallint NOT NULL DEFAULT '0', "misses" smallint NOT NULL DEFAULT '1', "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_practice_reviews_generator" CHECK ("generator" >= 0), CONSTRAINT "CHK_practice_reviews_seed" CHECK ("seed" BETWEEN 0 AND 4294967295), CONSTRAINT "CHK_practice_reviews_tier" CHECK ("tier" >= 0), CONSTRAINT "CHK_practice_reviews_box" CHECK ("box" BETWEEN 0 AND 2), CONSTRAINT "CHK_practice_reviews_misses" CHECK ("misses" >= 0), CONSTRAINT "PK_practice_reviews_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_practice_reviews_kid_item_key" ON "practice_reviews" ("kid_id", "item_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_practice_reviews_kid_topic_due" ON "practice_reviews" ("kid_id", "topic_id", "due_at")`,
    );
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_kid_id" FOREIGN KEY ("kid_id") REFERENCES "kids"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_kid_id"`,
      );
    }
    await queryRunner.query(
      `DROP INDEX "public"."IDX_practice_reviews_kid_topic_due"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_practice_reviews_kid_item_key"`,
    );
    await queryRunner.query(`DROP TABLE "practice_reviews"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_practice_daily_kid_day"`);
    await queryRunner.query(`DROP TABLE "practice_daily"`);
    await queryRunner.query(`DROP TABLE "practice_topic_progress"`);
  }
}
