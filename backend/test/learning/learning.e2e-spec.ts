import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  type FinishRunResponse,
  type GeneratedItem,
  type MapResponse,
  type StartRunResponse,
  generateRun,
  toPublicExercise,
} from '@murmeli/content';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { Curriculum } from '../../src/modules/learning/content/curriculum';
import type { RunState } from '../../src/modules/learning/runs/run-state';
import { RUN_KEY_PREFIX } from '../../src/modules/learning/runs/run-store';
import { localDay } from '../../src/modules/learning/time/local-day';
import { type Agent, uniqueEmail } from '../support/client';
import { createE2eApp, describeWithDb } from '../support/e2e-app';
import { PASSWORD, parentClient } from '../support/flows';

type Language = 'de-CH' | 'en-US';
type StartClass = 'KG1' | 'KG2' | '1' | '2';

const FIRST = 'math-zahlenwiese-01';

interface Kid {
  readonly parent: Agent;
  readonly id: string;
}

describeWithDb('Learning engine (e2e)', () => {
  let app: NestExpressApplication;
  let redis: Redis;
  let curriculum: Curriculum;
  let db: DataSource;

  beforeAll(async () => {
    app = await createE2eApp();
    curriculum = app.get(Curriculum);
    db = app.get(DataSource);
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  async function newKid(
    options: {
      language?: Language;
      startClass?: StartClass;
      dailyLimitMinutes?: number;
      parent?: Agent;
    } = {},
  ): Promise<Kid> {
    const parent =
      options.parent ?? (await parentClient(app, uniqueEmail('learn')));
    await parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(200);
    const created = await parent
      .post('/api/kids')
      .send({
        nickname: 'Lina',
        avatar: { animal: 'marmot', accessory: null, background: '#FFD8A8' },
        startClass: options.startClass ?? 'KG1',
        language: options.language ?? 'de-CH',
        ...(options.dailyLimitMinutes !== undefined && {
          dailyLimitMinutes: options.dailyLimitMinutes,
        }),
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await parent.post(`/api/kids/${id}/activate`).send({}).expect(200);
    return { parent, id };
  }

  async function map(kid: Kid): Promise<MapResponse> {
    return (await kid.parent.get('/api/learn/map').expect(200))
      .body as MapResponse;
  }

  function levelState(response: MapResponse, levelId: string) {
    for (const track of response.tracks) {
      for (const world of track.worlds) {
        const level = world.levels.find((l) => l.id === levelId);
        if (level) {
          return level;
        }
      }
    }
    return undefined;
  }

  function worldState(response: MapResponse, worldId: string) {
    return response.tracks
      .flatMap((t) => t.worlds)
      .find((w) => w.id === worldId);
  }

  async function start(kid: Kid, levelId = FIRST): Promise<StartRunResponse> {
    return (
      await kid.parent.post(`/api/learn/levels/${levelId}/runs`).expect(201)
    ).body as StartRunResponse;
  }

  /**
   * Replays the run from its seed with the content package, as the server
   * did; the test never reads a solution from an API response.
   */
  async function replay(
    runId: string,
    language: Language = 'de-CH',
  ): Promise<GeneratedItem[]> {
    const raw = await redis.get(RUN_KEY_PREFIX + runId);
    const state = JSON.parse(raw ?? 'null') as RunState;
    const level = curriculum.content.index.levels[state.levelId!].level;
    return generateRun(level, state.seed, {
      locale: language,
      content: curriculum.content,
    });
  }

  function answer(kid: Kid, runId: string, index: number, value: unknown) {
    return kid.parent
      .post(`/api/learn/runs/${runId}/answers`)
      .send({ index, answer: value });
  }

  async function finish(kid: Kid, runId: string): Promise<FinishRunResponse> {
    return (
      await kid.parent.post(`/api/learn/runs/${runId}/finish`).expect(200)
    ).body as FinishRunResponse;
  }

  async function playPerfect(kid: Kid, levelId: string) {
    const run = await start(kid, levelId);
    const items = await replay(run.runId);
    for (const item of items) {
      await answer(kid, run.runId, item.index, item.solution.answer)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({ correct: true, attempt: 1 }),
        );
    }
    return { run, result: await finish(kid, run.runId) };
  }

  it('needs a kid session', async () => {
    const parent = await parentClient(app, uniqueEmail('nokid'));
    await parent
      .get('/api/learn/map')
      .expect(403)
      .expect(({ body }) =>
        expect(body.errorCode).toBe('KID_SESSION_REQUIRED'),
      );
  });

  it('shows a new KG1 kid the first levels of their own tracks', async () => {
    const kid = await newKid();
    const response = await map(kid);

    expect(response.tracks.map((t) => t.id)).toEqual(['math', 'reading-de']);
    expect(response.badges).toEqual([]);
    expect(worldState(response, 'math-zahlenwiese')).toMatchObject({
      title: 'Zahlenwiese',
      state: 'unlocked',
      stars: 0,
      maxStars: 21,
    });
    expect(levelState(response, FIRST)).toMatchObject({
      state: 'unlocked',
      stars: 0,
    });
    expect(levelState(response, 'math-zahlenwiese-02')?.state).toBe('locked');
    expect(levelState(response, 'math-formenwald-01')?.state).toBe('unlocked');
    expect(levelState(response, 'reading-de-lautwiese-01')?.state).toBe(
      'unlocked',
    );
    expect(worldState(response, 'math-zahlenbach')?.state).toBe('locked');
  });

  it('places a class 1 kid: kindergarten worlds are skipped and still playable', async () => {
    const kid = await newKid({ language: 'en-US', startClass: '1' });
    const response = await map(kid);

    expect(response.tracks.map((t) => t.id)).toEqual(['math', 'reading-en']);
    expect(worldState(response, 'math-zahlenwiese')?.state).toBe('skipped');
    expect(worldState(response, 'math-zahlenbach')?.state).toBe('skipped');
    expect(levelState(response, 'math-zahlenbach-05')?.state).toBe('skipped');
    expect(worldState(response, 'math-zehnerhuette')?.state).toBe('unlocked');
    expect(levelState(response, 'math-zehnerhuette-01')?.state).toBe(
      'unlocked',
    );
    expect(levelState(response, 'math-zehnerhuette-02')?.state).toBe('locked');
    expect(worldState(response, 'reading-en-blending-bay')?.state).toBe(
      'unlocked',
    );

    await start(kid, 'math-zahlenbach-05');
    await kid.parent
      .post('/api/learn/levels/math-zehnerhuette-02/runs')
      .expect(403)
      .expect(({ body }) => expect(body.errorCode).toBe('LEVEL_LOCKED'));
  });

  it('plays a level: deterministic items, 3 stars, the next level unlocks', async () => {
    const kid = await newKid();
    const run = await start(kid);
    expect(run.demoSeen).toBe(false);
    expect(run.demo).toMatchObject({ type: 'count-objects' });
    expect(run.items).toHaveLength(6);
    expect(JSON.stringify(run.items)).not.toMatch(/solution|"answer"/);

    const items = await replay(run.runId);
    expect(items.map(toPublicExercise)).toEqual(run.items);
    for (const item of items) {
      await answer(kid, run.runId, item.index, item.solution.answer)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({ correct: true, attempt: 1 }),
        );
    }
    const result = await finish(kid, run.runId);
    expect(result).toEqual({
      score: 1,
      stars: 3,
      passed: true,
      unlocked: { levels: ['math-zahlenwiese-02'], worlds: [] },
      newBadges: ['first-level'],
    });

    const after = await map(kid);
    expect(levelState(after, FIRST)).toMatchObject({
      state: 'passed',
      stars: 3,
    });
    expect(levelState(after, 'math-zahlenwiese-02')?.state).toBe('unlocked');
    expect(worldState(after, 'math-zahlenwiese')?.stars).toBe(3);
    expect(after.badges).toEqual(['first-level']);

    const again = await start(kid);
    expect(again.demoSeen).toBe(true);
    expect(again.demo).toEqual(run.demo);

    const [attempts] = await db.query<
      { n: number; correct: boolean; level: boolean; timed: boolean }[]
    >(
      `SELECT count(*)::int AS "n", bool_and("correct") AS "correct",
              bool_and("level_id" = $2) AS "level", bool_and("duration_ms" >= 0) AS "timed"
       FROM "attempts" WHERE "kid_id" = $1`,
      [kid.id, FIRST],
    );
    expect(attempts).toEqual({ n: 6, correct: true, level: true, timed: true });
    const [activity] = await db.query<{ runs: number }[]>(
      `SELECT "runs" FROM "daily_activity" WHERE "kid_id" = $1`,
      [kid.id],
    );
    expect(activity.runs).toBe(1);
  });

  it('gives a hint, then the solution, and protects finished items and runs', async () => {
    const kid = await newKid();
    const run = await start(kid);
    const [first] = await replay(run.runId);
    const right = first.solution.answer as { value: number };
    const wrong = { value: right.value + 1 };

    await answer(kid, run.runId, 0, { value: 'three' })
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('VALIDATION_FAILED'));
    await answer(kid, run.runId, 6, wrong).expect(400);
    await answer(kid, run.runId, 99, wrong).expect(400);
    await kid.parent
      .post(`/api/learn/runs/${run.runId}/answers`)
      .send({ index: 0 })
      .expect(400);

    await answer(kid, run.runId, 0, wrong)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ correct: false, attempt: 1 });
        expect(typeof body.hint).toBe('string');
        expect(body).not.toHaveProperty('solution');
      });
    await answer(kid, run.runId, 0, wrong)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({ correct: false, attempt: 2, solution: right }),
      );
    await answer(kid, run.runId, 0, right)
      .expect(409)
      .expect(({ body }) => expect(body.errorCode).toBe('ITEM_DONE'));

    const result = await finish(kid, run.runId);
    expect(result).toMatchObject({ score: 0, stars: 0, passed: false });
    expect(result.unlocked).toEqual({ levels: [], worlds: [] });
    await kid.parent
      .post(`/api/learn/runs/${run.runId}/finish`)
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('RUN_NOT_FOUND'));
    await answer(kid, run.runId, 1, wrong).expect(404);
  });

  it('validates level and run ids', async () => {
    const kid = await newKid();
    await kid.parent
      .post('/api/learn/levels/math-nope-99/runs')
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('LEVEL_NOT_FOUND'));
    await kid.parent
      .post('/api/learn/levels/reading-en-sound-garden-01/runs')
      .expect(404);
    await kid.parent
      .post('/api/learn/levels/Not_A_Level/runs')
      .expect(400)
      .expect(({ body }) => expect(body.errorCode).toBe('VALIDATION_FAILED'));
    await kid.parent.post('/api/learn/runs/not-a-uuid/finish').expect(400);
  });

  it('keeps one active run per kid', async () => {
    const kid = await newKid();
    const first = await start(kid);
    expect((await start(kid)).runId).toBe(first.runId);

    const second = await start(kid, 'math-formenwald-01');
    expect(second.runId).not.toBe(first.runId);
    await answer(kid, first.runId, 0, { value: 1 }).expect(404);
    const [item] = await replay(second.runId);
    await answer(kid, second.runId, 0, item.solution.answer).expect(200);
  });

  it('does not let kid B use kid A’s run', async () => {
    const a = await newKid();
    const b = await newKid();
    const run = await start(a);
    await answer(b, run.runId, 0, { value: 1 })
      .expect(404)
      .expect(({ body }) => expect(body.errorCode).toBe('RUN_NOT_FOUND'));
    await b.parent.post(`/api/learn/runs/${run.runId}/finish`).expect(404);

    const sibling = await newKid({ parent: a.parent });
    await answer(sibling, run.runId, 0, { value: 1 }).expect(404);
    await sibling.parent
      .post(`/api/learn/runs/${run.runId}/finish`)
      .expect(404);
    expect(await redis.exists(RUN_KEY_PREFIX + run.runId)).toBe(1);
  });

  it('practices open skills, updating mastery but not stars', async () => {
    const kid = await newKid();
    await playPerfect(kid, FIRST);
    const practice = (
      await kid.parent.post('/api/learn/practice/runs').expect(201)
    ).body as StartRunResponse;
    expect(practice.items.length).toBeGreaterThanOrEqual(8);
    expect(practice.items.length).toBeLessThanOrEqual(10);
    expect(practice.demoSeen).toBe(true);
    expect(practice).not.toHaveProperty('demo');

    const state = JSON.parse(
      (await redis.get(RUN_KEY_PREFIX + practice.runId))!,
    ) as RunState;
    expect(state).toMatchObject({ mode: 'practice', levelId: null });
    const answered = state.items[0];
    await answer(kid, practice.runId, 0, answered.solution.answer).expect(200);

    const result = await finish(kid, practice.runId);
    expect(result.newBadges).toEqual(['first-practice']);
    expect(result.passed).toBe(false);
    expect(result.unlocked).toEqual({ levels: [], worlds: [] });

    const levels = await db.query<
      { level_id: string; stars: number; runs: number }[]
    >(
      `SELECT "level_id", "stars", "runs" FROM "level_progress" WHERE "kid_id" = $1 AND "runs" > 0`,
      [kid.id],
    );
    expect(levels).toEqual([{ level_id: FIRST, stars: 3, runs: 1 }]);
    const attempts = await db.query<
      { level_id: string | null; mode: string }[]
    >(`SELECT "level_id", "mode" FROM "attempts" WHERE "run_id" = $1`, [
      practice.runId,
    ]);
    expect(attempts).toEqual([{ level_id: null, mode: 'practice' }]);
    const skills = await db.query<{ skill_id: string }[]>(
      `SELECT "skill_id" FROM "skill_mastery" WHERE "kid_id" = $1`,
      [kid.id],
    );
    expect(skills.map((s) => s.skill_id)).toContain(answered.skillId);
  });

  it('refuses new runs once the daily limit is reached', async () => {
    const kid = await newKid({ dailyLimitMinutes: 5 });
    await start(kid);
    await db.query(
      `INSERT INTO "daily_activity" ("kid_id", "day", "seconds", "runs") VALUES ($1, $2, 300, 0)`,
      [
        kid.id,
        localDay(new Date(), process.env.APP_TIMEZONE ?? 'Europe/Zurich'),
      ],
    );
    for (const path of [
      `/api/learn/levels/${FIRST}/runs`,
      '/api/learn/practice/runs',
    ]) {
      await kid.parent
        .post(path)
        .expect(403)
        .expect(({ body }) =>
          expect(body.errorCode).toBe('DAILY_LIMIT_REACHED'),
        );
    }
    await kid.parent.get('/api/learn/map').expect(200);
  });

  it('shows the parent the progress of their own kid only, behind the gate', async () => {
    const kid = await newKid();
    await playPerfect(kid, FIRST);
    await kid.parent
      .get(`/api/parent/kids/${kid.id}/progress`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.errorCode).toBe('PARENT_GATE_REQUIRED'),
      );
    await kid.parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(200);

    const { body } = await kid.parent
      .get(`/api/parent/kids/${kid.id}/progress`)
      .expect(200);
    expect(body.kidId).toBe(kid.id);
    expect(body.tracks[0].worlds[0].levels[0]).toMatchObject({
      id: FIRST,
      state: 'passed',
      stars: 3,
      bestScore: 1,
      runs: 1,
    });
    expect(body.skills).toEqual([
      expect.objectContaining({ id: 'math.count.to5', mastery: 1, box: 2 }),
    ]);
    expect(body.activity).toHaveLength(14);
    expect(body.activity[13].runs).toBe(1);
    expect(body.weakSkills).toEqual([]);
    expect(body.badges).toEqual([
      expect.objectContaining({ id: 'first-level' }),
    ]);

    const other = await newKid();
    await other.parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(200);
    await other.parent
      .get(`/api/parent/kids/${kid.id}/progress`)
      .expect(404)
      .expect(({ body: error }) =>
        expect(error.errorCode).toBe('KID_NOT_FOUND'),
      );
  });

  it('limits how many runs a kid starts per window', async () => {
    const kid = await newKid({ language: 'en-US' });
    const limit = Number(process.env.RATE_LIMIT_LEARN_RUN_LIMIT ?? 20);
    for (let i = 0; i < limit; i += 1) {
      await kid.parent.post(`/api/learn/levels/${FIRST}/runs`).expect(201);
    }
    await kid.parent
      .post('/api/learn/practice/runs')
      .expect(429)
      .expect((response) => {
        expect(response.body.errorCode).toBe('LEARN_RATE_LIMITED');
        expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      });
  });

  it('exports the progress and deletes it with the kid', async () => {
    const kid = await newKid();
    await playPerfect(kid, FIRST);
    await kid.parent
      .post('/api/auth/parent-gate')
      .send({ password: PASSWORD })
      .expect(200);

    const { body } = await kid.parent.get('/api/account/export').expect(200);
    expect(body.progress).toEqual([
      expect.objectContaining({
        kidId: kid.id,
        levels: [expect.objectContaining({ levelId: FIRST, stars: 3 })],
        skills: [expect.objectContaining({ skillId: 'math.count.to5' })],
        activity: [expect.objectContaining({ runs: 1 })],
        badges: [expect.objectContaining({ badgeId: 'first-level' })],
        attempts: [
          expect.objectContaining({
            skillId: 'math.count.to5',
            mode: 'level',
            attempts: 6,
            correct: 6,
          }),
        ],
      }),
    ]);

    await kid.parent.delete(`/api/kids/${kid.id}`).expect(204);
    for (const table of [
      'level_progress',
      'skill_mastery',
      'attempts',
      'daily_activity',
      'kid_badges',
    ]) {
      const [row] = await db.query<{ n: number }[]>(
        `SELECT count(*)::int AS "n" FROM "${table}" WHERE "kid_id" = $1`,
        [kid.id],
      );
      expect([table, row.n]).toEqual([table, 0]);
    }
  });
});
