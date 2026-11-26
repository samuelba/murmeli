import { Injectable } from '@nestjs/common';
import type { Stars } from '@murmeli/content';
import { DataSource, type EntityManager } from 'typeorm';
import { type RunMode, SECONDS_PER_DAY } from '../learning.constants';
import type { SkillRecord } from '../practice/practice-selection';
import type { AttemptRecord } from '../runs/run-state';
import type { MasteryUpdate, MasteryValue } from './mastery';
import type { LevelSnapshot } from './unlock';

export interface LevelProgressRow extends LevelSnapshot {
  readonly levelId: string;
  readonly bestScore: number;
  readonly runs: number;
  readonly firstPassedAt: Date | null;
  readonly demoSeen: boolean;
}

export interface MasteryRow extends SkillRecord, MasteryValue {}

export interface ActivityRow {
  readonly day: string;
  readonly seconds: number;
  readonly runs: number;
}

export interface BadgeRow {
  readonly badgeId: string;
  readonly earnedAt: Date;
}

export interface LevelResult {
  readonly levelId: string;
  readonly stars: Stars;
  readonly score: number;
  readonly passed: boolean;
}

export interface AttemptInsert extends AttemptRecord {
  readonly kidId: string;
  readonly runId: string;
  readonly mode: RunMode;
}

type Db = Pick<EntityManager, 'query'>;

interface RawLevelRow {
  level_id: string;
  stars: number;
  best_score: number;
  runs: number;
  first_passed_at: Date | null;
  demo_seen_at: Date | null;
}

interface RawMasteryRow {
  skill_id: string;
  mastery: number;
  box: number;
  next_review_at: Date;
  updated_at: Date;
}

function toLevelRow(row: RawLevelRow): LevelProgressRow {
  return {
    levelId: row.level_id,
    stars: Math.min(3, Math.max(0, row.stars)) as Stars,
    passed: row.first_passed_at !== null,
    bestScore: Number(row.best_score),
    runs: row.runs,
    firstPassedAt: row.first_passed_at,
    demoSeen: row.demo_seen_at !== null,
  };
}

function toMasteryRow(row: RawMasteryRow): MasteryRow {
  return {
    skillId: row.skill_id,
    mastery: Number(row.mastery),
    box: row.box,
    nextReviewAt: row.next_review_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Parameterized SQL for the progress tables. Writes are upserts, so they are
 * safe to repeat and need no prior read.
 */
@Injectable()
export class ProgressStore {
  constructor(private readonly dataSource: DataSource) {}

  transaction<T>(work: (db: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  async levels(
    kidId: string,
    db: Db = this.dataSource,
  ): Promise<LevelProgressRow[]> {
    const rows = await db.query<RawLevelRow[]>(
      `SELECT "level_id", "stars", "best_score", "runs", "first_passed_at", "demo_seen_at"
       FROM "level_progress" WHERE "kid_id" = $1`,
      [kidId],
    );
    return rows.map(toLevelRow);
  }

  async mastery(
    kidId: string,
    db: Db = this.dataSource,
  ): Promise<MasteryRow[]> {
    const rows = await db.query<RawMasteryRow[]>(
      `SELECT "skill_id", "mastery", "box", "next_review_at", "updated_at"
       FROM "skill_mastery" WHERE "kid_id" = $1
       ORDER BY "next_review_at", "skill_id"`,
      [kidId],
    );
    return rows.map(toMasteryRow);
  }

  async markDemoSeen(kidId: string, levelId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "level_progress" ("kid_id", "level_id", "demo_seen_at")
       VALUES ($1, $2, now())
       ON CONFLICT ("kid_id", "level_id") DO UPDATE
       SET "demo_seen_at" = COALESCE("level_progress"."demo_seen_at", EXCLUDED."demo_seen_at")`,
      [kidId, levelId],
    );
  }

  async secondsOn(kidId: string, day: string): Promise<number> {
    const rows = await this.dataSource.query<{ seconds: number }[]>(
      `SELECT "seconds" FROM "daily_activity" WHERE "kid_id" = $1 AND "day" = $2`,
      [kidId, day],
    );
    return rows[0]?.seconds ?? 0;
  }

  async addActivity(
    kidId: string,
    day: string,
    seconds: number,
    runs: number,
    db: Db = this.dataSource,
  ): Promise<void> {
    await db.query(
      `INSERT INTO "daily_activity" ("kid_id", "day", "seconds", "runs")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("kid_id", "day") DO UPDATE
       SET "seconds" = LEAST("daily_activity"."seconds" + EXCLUDED."seconds", ${SECONDS_PER_DAY}),
           "runs" = "daily_activity"."runs" + EXCLUDED."runs"`,
      [
        kidId,
        day,
        Math.min(SECONDS_PER_DAY, Math.max(0, Math.round(seconds))),
        runs,
      ],
    );
  }

  async activity(kidId: string, from: string): Promise<ActivityRow[]> {
    return this.dataSource.query<ActivityRow[]>(
      `SELECT "day"::text AS "day", "seconds", "runs" FROM "daily_activity"
       WHERE "kid_id" = $1 AND "day" >= $2 ORDER BY "day"`,
      [kidId, from],
    );
  }

  async insertAttempt(attempt: AttemptInsert): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "attempts" ("kid_id", "run_id", "level_id", "skill_id", "exercise_type",
         "item_index", "attempt", "correct", "duration_ms", "mode")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ("run_id", "item_index", "attempt") DO NOTHING`,
      [
        attempt.kidId,
        attempt.runId,
        attempt.mode === 'practice' ? null : attempt.levelId,
        attempt.skillId,
        attempt.exerciseType,
        attempt.itemIndex,
        attempt.attempt,
        attempt.correct,
        attempt.durationMs,
        attempt.mode,
      ],
    );
  }

  async recordLevel(kidId: string, result: LevelResult, db: Db): Promise<void> {
    await db.query(
      `INSERT INTO "level_progress" ("kid_id", "level_id", "stars", "best_score", "runs", "first_passed_at")
       VALUES ($1, $2, $3, $4, 1, CASE WHEN $5::boolean THEN now() END)
       ON CONFLICT ("kid_id", "level_id") DO UPDATE SET
         "stars" = GREATEST("level_progress"."stars", EXCLUDED."stars"),
         "best_score" = GREATEST("level_progress"."best_score", EXCLUDED."best_score"),
         "runs" = "level_progress"."runs" + 1,
         "first_passed_at" = COALESCE("level_progress"."first_passed_at", EXCLUDED."first_passed_at"),
         "updated_at" = now()`,
      [kidId, result.levelId, result.stars, result.score, result.passed],
    );
  }

  async saveMastery(
    kidId: string,
    skillId: string,
    update: MasteryUpdate,
    db: Db,
  ): Promise<void> {
    await db.query(
      `INSERT INTO "skill_mastery" ("kid_id", "skill_id", "mastery", "box", "next_review_at")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("kid_id", "skill_id") DO UPDATE SET
         "mastery" = EXCLUDED."mastery",
         "box" = EXCLUDED."box",
         "next_review_at" = EXCLUDED."next_review_at",
         "updated_at" = now()`,
      [kidId, skillId, update.mastery, update.box, update.nextReviewAt],
    );
  }

  async awardBadges(
    kidId: string,
    badgeIds: readonly string[],
    db: Db,
  ): Promise<string[]> {
    if (badgeIds.length === 0) {
      return [];
    }
    const rows = await db.query<{ badge_id: string }[]>(
      `INSERT INTO "kid_badges" ("kid_id", "badge_id")
       SELECT $1, unnest($2::text[])
       ON CONFLICT ("kid_id", "badge_id") DO NOTHING
       RETURNING "badge_id"`,
      [kidId, badgeIds],
    );
    const awarded = new Set(rows.map((row) => row.badge_id));
    return badgeIds.filter((id) => awarded.has(id));
  }

  async badges(kidId: string): Promise<BadgeRow[]> {
    const rows = await this.dataSource.query<
      { badge_id: string; earned_at: Date }[]
    >(
      `SELECT "badge_id", "earned_at" FROM "kid_badges"
       WHERE "kid_id" = $1 ORDER BY "earned_at", "badge_id"`,
      [kidId],
    );
    return rows.map((row) => ({
      badgeId: row.badge_id,
      earnedAt: row.earned_at,
    }));
  }

  /** Serializes concurrent finishes of the same kid. */
  async lockKid(kidId: string, db: Db): Promise<void> {
    await db.query(`SELECT 1 FROM "kids" WHERE "id" = $1 FOR NO KEY UPDATE`, [
      kidId,
    ]);
  }
}
