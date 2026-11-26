import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface KidProgressExport {
  readonly kidId: string;
  readonly levels: readonly {
    readonly levelId: string;
    readonly stars: number;
    readonly bestScore: number;
    readonly runs: number;
    readonly firstPassedAt: string | null;
    readonly demoSeenAt: string | null;
    readonly updatedAt: string;
  }[];
  readonly skills: readonly {
    readonly skillId: string;
    readonly mastery: number;
    readonly box: number;
    readonly nextReviewAt: string;
    readonly updatedAt: string;
  }[];
  readonly activity: readonly {
    readonly day: string;
    readonly seconds: number;
    readonly runs: number;
  }[];
  readonly badges: readonly {
    readonly badgeId: string;
    readonly earnedAt: string;
  }[];
  /** Attempts summarized per skill and mode */
  readonly attempts: readonly {
    readonly skillId: string;
    readonly mode: string;
    readonly attempts: number;
    readonly correct: number;
    readonly firstAt: string;
    readonly lastAt: string;
  }[];
}

type Row = Record<string, unknown> & { kid_id: string };

const iso = (value: unknown): string => (value as Date).toISOString();
const isoOrNull = (value: unknown): string | null =>
  value === null ? null : iso(value);

const QUERIES = {
  levels: `SELECT "kid_id", "level_id", "stars", "best_score", "runs", "first_passed_at", "demo_seen_at", "updated_at"
    FROM "level_progress" WHERE "kid_id" = ANY($1::uuid[]) ORDER BY "kid_id", "level_id"`,
  skills: `SELECT "kid_id", "skill_id", "mastery", "box", "next_review_at", "updated_at"
    FROM "skill_mastery" WHERE "kid_id" = ANY($1::uuid[]) ORDER BY "kid_id", "skill_id"`,
  activity: `SELECT "kid_id", "day"::text AS "day", "seconds", "runs"
    FROM "daily_activity" WHERE "kid_id" = ANY($1::uuid[]) ORDER BY "kid_id", "day"`,
  badges: `SELECT "kid_id", "badge_id", "earned_at"
    FROM "kid_badges" WHERE "kid_id" = ANY($1::uuid[]) ORDER BY "kid_id", "earned_at", "badge_id"`,
  attempts: `SELECT "kid_id", "skill_id", "mode", count(*)::int AS "attempts",
      count(*) FILTER (WHERE "correct")::int AS "correct",
      min("created_at") AS "first_at", max("created_at") AS "last_at"
    FROM "attempts" WHERE "kid_id" = ANY($1::uuid[])
    GROUP BY "kid_id", "skill_id", "mode" ORDER BY "kid_id", "skill_id", "mode"`,
} as const;

/**
 * Learning data of a parent's kids for the account export (GDPR / nFADP).
 */
@Injectable()
export class ProgressExportService {
  constructor(private readonly dataSource: DataSource) {}

  async forKids(kidIds: readonly string[]): Promise<KidProgressExport[]> {
    if (kidIds.length === 0) {
      return [];
    }
    const [levels, skills, activity, badges, attempts] = await Promise.all(
      Object.values(QUERIES).map((sql) =>
        this.dataSource.query<Row[]>(sql, [kidIds]),
      ),
    );
    const of = (rows: Row[], kidId: string) =>
      rows.filter((row) => row.kid_id === kidId);
    return kidIds.map((kidId) => ({
      kidId,
      levels: of(levels, kidId).map((row) => ({
        levelId: row.level_id as string,
        stars: row.stars as number,
        bestScore: Number(row.best_score),
        runs: row.runs as number,
        firstPassedAt: isoOrNull(row.first_passed_at),
        demoSeenAt: isoOrNull(row.demo_seen_at),
        updatedAt: iso(row.updated_at),
      })),
      skills: of(skills, kidId).map((row) => ({
        skillId: row.skill_id as string,
        mastery: Number(row.mastery),
        box: row.box as number,
        nextReviewAt: iso(row.next_review_at),
        updatedAt: iso(row.updated_at),
      })),
      activity: of(activity, kidId).map((row) => ({
        day: row.day as string,
        seconds: row.seconds as number,
        runs: row.runs as number,
      })),
      badges: of(badges, kidId).map((row) => ({
        badgeId: row.badge_id as string,
        earnedAt: iso(row.earned_at),
      })),
      attempts: of(attempts, kidId).map((row) => ({
        skillId: row.skill_id as string,
        mode: row.mode as string,
        attempts: row.attempts as number,
        correct: row.correct as number,
        firstAt: iso(row.first_at),
        lastAt: iso(row.last_at),
      })),
    }));
  }
}
