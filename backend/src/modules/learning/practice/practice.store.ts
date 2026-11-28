import { Injectable } from '@nestjs/common';
import {
  type ItemSource,
  type Locale,
  type PracticeTopicId,
  isPracticeTopicId,
} from '@murmeli/content';
import { DataSource, type EntityManager } from 'typeorm';
import {
  REVIEW_DONE_BOX,
  REVIEW_INTERVAL_DAYS,
  REVIEWS_PER_TOPIC,
} from '../learning.constants';

type Db = Pick<EntityManager, 'query'>;

export interface TopicProgressRow {
  readonly topicId: PracticeTopicId;
  readonly rating: number;
  readonly pathStep: number;
  readonly runs: number;
  readonly items: number;
  readonly firstTry: number;
  readonly accuracy: number | undefined;
  readonly demoSeen: boolean;
  readonly lastPracticedAt: Date | null;
}

export interface TopicUpdate {
  readonly topicId: PracticeTopicId;
  readonly rating: number;
  readonly pathStep: number;
  readonly items: number;
  readonly firstTry: number;
  readonly accuracy: number;
}

export interface ReviewRow {
  readonly id: string;
  readonly topicId: PracticeTopicId;
  readonly itemKey: string;
  readonly source: ItemSource;
  readonly tier: number;
  readonly box: number;
  readonly misses: number;
  readonly dueAt: Date;
}

export interface ReviewCount {
  readonly topicId: PracticeTopicId;
  readonly due: number;
  readonly total: number;
}

export interface MissedItem {
  readonly topicId: PracticeTopicId;
  readonly itemKey: string;
  readonly source: ItemSource;
  readonly tier: number;
}

export interface PracticeDayRow {
  readonly day: string;
  readonly topicId: string;
  readonly items: number;
  readonly firstTry: number;
}

interface RawTopicRow {
  topic_id: string;
  rating: number;
  path_step: number;
  runs: number;
  items: number;
  first_try: number;
  accuracy: number | null;
  demo_seen_at: Date | null;
  last_practiced_at: Date | null;
}

interface RawReviewRow {
  id: string;
  topic_id: string;
  item_key: string;
  level_id: string;
  generator: number;
  seed: string;
  source_topic: string | null;
  tier: number;
  box: number;
  misses: number;
  due_at: Date;
}

const REVIEW_COLUMNS = `"id", "topic_id", "item_key", "level_id", "generator", "seed",
  "source_topic", "tier", "box", "misses", "due_at"`;

function toTopicRow(row: RawTopicRow): TopicProgressRow {
  return {
    topicId: row.topic_id as PracticeTopicId,
    rating: Number(row.rating),
    pathStep: row.path_step,
    runs: row.runs,
    items: row.items,
    firstTry: row.first_try,
    accuracy: row.accuracy === null ? undefined : Number(row.accuracy),
    demoSeen: row.demo_seen_at !== null,
    lastPracticedAt: row.last_practiced_at,
  };
}

function toReviewRow(row: RawReviewRow): ReviewRow {
  const sourceTopic = row.source_topic;
  return {
    id: row.id,
    topicId: row.topic_id as PracticeTopicId,
    itemKey: row.item_key,
    source: {
      levelId: row.level_id,
      generator: row.generator,
      seed: Number(row.seed),
      ...(sourceTopic !== null && isPracticeTopicId(sourceTopic)
        ? { topic: sourceTopic }
        : {}),
    },
    tier: row.tier,
    box: row.box,
    misses: row.misses,
    dueAt: row.due_at,
  };
}

/** The last occurrence of each key wins. */
function uniqueByKey<T extends { readonly itemKey: string }>(
  items: readonly T[],
): T[] {
  return [...new Map(items.map((item) => [item.itemKey, item])).values()];
}

/**
 * Parameterized SQL for the practice ground: topic ratings, practice per
 * day and the mistakes asked again later.
 */
@Injectable()
export class PracticeStore {
  constructor(private readonly dataSource: DataSource) {}

  async topics(
    kidId: string,
    db: Db = this.dataSource,
  ): Promise<TopicProgressRow[]> {
    const rows = await db.query<RawTopicRow[]>(
      `SELECT "topic_id", "rating", "path_step", "runs", "items", "first_try", "accuracy",
         "demo_seen_at", "last_practiced_at"
       FROM "practice_topic_progress" WHERE "kid_id" = $1 ORDER BY "topic_id"`,
      [kidId],
    );
    return rows
      .filter((row) => isPracticeTopicId(row.topic_id))
      .map(toTopicRow);
  }

  /** Creates the topic row with its start rating if needed. */
  async markDemoSeen(
    kidId: string,
    topicId: PracticeTopicId,
    rating: number,
    pathStep: number,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "practice_topic_progress" ("kid_id", "topic_id", "rating", "path_step", "demo_seen_at")
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT ("kid_id", "topic_id") DO UPDATE
       SET "demo_seen_at" = COALESCE("practice_topic_progress"."demo_seen_at", EXCLUDED."demo_seen_at")`,
      [kidId, topicId, rating, pathStep],
    );
  }

  async saveTopic(
    kidId: string,
    update: TopicUpdate,
    now: Date,
    db: Db,
  ): Promise<void> {
    await db.query(
      `INSERT INTO "practice_topic_progress" ("kid_id", "topic_id", "rating", "path_step", "runs",
         "items", "first_try", "accuracy", "last_practiced_at")
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8)
       ON CONFLICT ("kid_id", "topic_id") DO UPDATE SET
         "rating" = EXCLUDED."rating",
         "path_step" = EXCLUDED."path_step",
         "runs" = "practice_topic_progress"."runs" + 1,
         "items" = "practice_topic_progress"."items" + EXCLUDED."items",
         "first_try" = "practice_topic_progress"."first_try" + EXCLUDED."first_try",
         "accuracy" = EXCLUDED."accuracy",
         "last_practiced_at" = EXCLUDED."last_practiced_at",
         "updated_at" = now()`,
      [
        kidId,
        update.topicId,
        update.rating,
        update.pathStep,
        update.items,
        update.firstTry,
        update.accuracy,
        now,
      ],
    );
  }

  async addDaily(
    kidId: string,
    topicId: PracticeTopicId,
    day: string,
    items: number,
    firstTry: number,
    db: Db,
  ): Promise<void> {
    await db.query(
      `INSERT INTO "practice_daily" ("kid_id", "topic_id", "day", "items", "first_try")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("kid_id", "topic_id", "day") DO UPDATE SET
         "items" = "practice_daily"."items" + EXCLUDED."items",
         "first_try" = "practice_daily"."first_try" + EXCLUDED."first_try"`,
      [kidId, topicId, day, items, firstTry],
    );
  }

  async daily(kidId: string, from: string): Promise<PracticeDayRow[]> {
    const rows = await this.dataSource.query<
      { day: string; topic_id: string; items: number; first_try: number }[]
    >(
      `SELECT "day"::text AS "day", "topic_id", "items", "first_try" FROM "practice_daily"
       WHERE "kid_id" = $1 AND "day" >= $2 ORDER BY "day", "topic_id"`,
      [kidId, from],
    );
    return rows.map((row) => ({
      day: row.day,
      topicId: row.topic_id,
      items: row.items,
      firstTry: row.first_try,
    }));
  }

  async reviewCounts(
    kidId: string,
    locale: Locale,
    now: Date,
  ): Promise<ReviewCount[]> {
    const rows = await this.dataSource.query<
      { topic_id: string; due: number; total: number }[]
    >(
      `SELECT "topic_id", count(*) FILTER (WHERE "due_at" <= $3)::int AS "due",
         count(*)::int AS "total"
       FROM "practice_reviews" WHERE "kid_id" = $1 AND "locale" = $2
       GROUP BY "topic_id" ORDER BY "topic_id"`,
      [kidId, locale, now],
    );
    return rows
      .filter((row) => isPracticeTopicId(row.topic_id))
      .map((row) => ({
        topicId: row.topic_id as PracticeTopicId,
        due: row.due,
        total: row.total,
      }));
  }

  /** Due mistakes, the most missed first; all topics when `topics` is null. */
  async dueReviews(
    kidId: string,
    locale: Locale,
    now: Date,
    topics: readonly PracticeTopicId[] | null,
    limit: number,
  ): Promise<ReviewRow[]> {
    const rows = await this.dataSource.query<RawReviewRow[]>(
      `SELECT ${REVIEW_COLUMNS} FROM "practice_reviews"
       WHERE "kid_id" = $1 AND "locale" = $2 AND "due_at" <= $3
         AND ($4::text[] IS NULL OR "topic_id" = ANY($4::text[]))
       ORDER BY "misses" DESC, "due_at", "id" LIMIT $5`,
      [kidId, locale, now, topics, limit],
    );
    return rows
      .filter((row) => isPracticeTopicId(row.topic_id))
      .map(toReviewRow);
  }

  async reviews(kidId: string, locale: Locale): Promise<ReviewRow[]> {
    const rows = await this.dataSource.query<RawReviewRow[]>(
      `SELECT ${REVIEW_COLUMNS} FROM "practice_reviews"
       WHERE "kid_id" = $1 AND "locale" = $2
       ORDER BY "topic_id", "misses" DESC, "due_at", "id"`,
      [kidId, locale],
    );
    return rows
      .filter((row) => isPracticeTopicId(row.topic_id))
      .map(toReviewRow);
  }

  async deleteReviews(kidId: string, ids: readonly string[]): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "practice_reviews" WHERE "kid_id" = $1 AND "id" = ANY($2::uuid[])`,
      [kidId, ids],
    );
  }

  /**
   * Mistakes start over: due now, so the next run asks them again. Keeps
   * the newest `REVIEWS_PER_TOPIC` per topic and language. `clock_timestamp()`
   * (not the transaction start) orders two finishes that waited on each other.
   */
  async recordMisses(
    kidId: string,
    locale: Locale,
    missed: readonly MissedItem[],
    now: Date,
    db: Db,
  ): Promise<number> {
    const items = uniqueByKey(missed);
    if (items.length === 0) {
      return 0;
    }
    await db.query(
      `INSERT INTO "practice_reviews" ("kid_id", "locale", "topic_id", "item_key", "level_id",
         "generator", "seed", "source_topic", "tier", "box", "misses", "due_at")
       SELECT $1, $2, t."topic_id", t."item_key", t."level_id", t."generator", t."seed",
         t."source_topic", t."tier", 0, 1, $3
       FROM unnest($4::text[], $5::text[], $6::text[], $7::smallint[], $8::bigint[],
         $9::text[], $10::smallint[])
         AS t("topic_id", "item_key", "level_id", "generator", "seed", "source_topic", "tier")
       ON CONFLICT ("kid_id", "item_key") DO UPDATE SET
         "box" = 0,
         "misses" = LEAST("practice_reviews"."misses" + 1, 32767),
         "due_at" = EXCLUDED."due_at",
         "updated_at" = clock_timestamp()`,
      [
        kidId,
        locale,
        now,
        items.map((item) => item.topicId),
        items.map((item) => item.itemKey),
        items.map((item) => item.source.levelId),
        items.map((item) => item.source.generator),
        items.map((item) => item.source.seed),
        items.map((item) => item.source.topic ?? null),
        items.map((item) => item.tier),
      ],
    );
    await db.query(
      `DELETE FROM "practice_reviews" WHERE "id" IN (
         SELECT "id" FROM (
           SELECT "id", row_number() OVER (
             PARTITION BY "topic_id", "locale" ORDER BY "updated_at" DESC, "id" DESC
           ) AS "rank"
           FROM "practice_reviews" WHERE "kid_id" = $1
         ) AS "ranked" WHERE "rank" > $2
       )`,
      [kidId, REVIEWS_PER_TOPIC],
    );
    return items.length;
  }

  /**
   * Due mistakes answered right on the first try move up a box (due again
   * after 1, then 3 days); the third right answer removes them. A mistake
   * that is not due yet keeps its spacing. Returns how many were answered.
   */
  async recordSolved(
    kidId: string,
    itemKeys: readonly string[],
    now: Date,
    db: Db,
  ): Promise<number> {
    const keys = [...new Set(itemKeys)];
    if (keys.length === 0) {
      return 0;
    }
    const [, done] = await db.query<[unknown, number | undefined]>(
      `DELETE FROM "practice_reviews"
       WHERE "kid_id" = $1 AND "item_key" = ANY($2::text[]) AND "box" >= $3
         AND "due_at" <= $4`,
      [kidId, keys, REVIEW_DONE_BOX - 1, now],
    );
    const [, moved] = await db.query<[unknown, number | undefined]>(
      `UPDATE "practice_reviews" SET
         "box" = "box" + 1,
         "due_at" = $3::timestamptz + make_interval(days => CASE "box"
           WHEN 0 THEN ${REVIEW_INTERVAL_DAYS[0]} ELSE ${REVIEW_INTERVAL_DAYS[1]} END),
         "updated_at" = clock_timestamp()
       WHERE "kid_id" = $1 AND "item_key" = ANY($2::text[]) AND "box" < $4
         AND "due_at" <= $3`,
      [kidId, keys, now, REVIEW_DONE_BOX - 1],
    );
    return (done ?? 0) + (moved ?? 0);
  }
}
