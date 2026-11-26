import { Logger } from '@nestjs/common';
import type { AttemptLimiter } from '../../auth/limits/attempt-limiter.service';
import { loadCurriculum } from '../content/curriculum';
import type { LearningSettings } from '../learning.settings';
import type {
  LearningKid,
  ProgressService,
} from '../progress/progress.service';
import type { ProgressStore } from '../progress/progress.store';
import { computeStates } from '../progress/unlock';
import type { RunState } from './run-state';
import type { RunStore, StoredRun } from './run-store';
import { RunService } from './run.service';

const curriculum = loadCurriculum(undefined);
const LEVEL = 'math-zahlenwiese-01';
const kid: LearningKid = {
  id: 'kid-1',
  language: 'de-CH',
  startClass: 'KG1',
  dailyLimitMinutes: null,
};

/** In-memory RunStore with the same compare-and-set semantics as Redis. */
class FakeRunStore {
  readonly runs = new Map<string, string>();
  readonly active = new Map<string, string>();
  conflicts = 0;

  start(state: RunState): Promise<RunState | null> {
    const previousId = this.active.get(state.kidId);
    const previous = previousId ? this.runs.get(previousId) : undefined;
    if (previousId) {
      this.runs.delete(previousId);
    }
    this.runs.set(state.runId, JSON.stringify(state));
    this.active.set(state.kidId, state.runId);
    return Promise.resolve(
      previous ? (JSON.parse(previous) as RunState) : null,
    );
  }

  get(runId: string): Promise<StoredRun | null> {
    const raw = this.runs.get(runId);
    return Promise.resolve(
      raw ? { raw, state: JSON.parse(raw) as RunState } : null,
    );
  }

  update(current: StoredRun, next: RunState): Promise<boolean> {
    if (this.conflicts > 0) {
      this.conflicts -= 1;
      return Promise.resolve(false);
    }
    if (this.runs.get(current.state.runId) !== current.raw) {
      return Promise.resolve(false);
    }
    this.runs.set(next.runId, JSON.stringify(next));
    return Promise.resolve(true);
  }

  restore(taken: StoredRun): Promise<boolean> {
    if (this.runs.has(taken.state.runId)) {
      return Promise.resolve(false);
    }
    this.runs.set(taken.state.runId, taken.raw);
    return Promise.resolve(true);
  }

  take(current: StoredRun): Promise<boolean> {
    if (this.conflicts > 0) {
      this.conflicts -= 1;
      return Promise.resolve(false);
    }
    if (this.runs.get(current.state.runId) !== current.raw) {
      return Promise.resolve(false);
    }
    this.runs.delete(current.state.runId);
    return Promise.resolve(true);
  }
}

function setup(options: { demoSeen?: boolean; allowed?: boolean } = {}) {
  const runs = new FakeRunStore();
  const progress = {
    levelAccess: jest.fn((_kid: LearningKid, levelId: string) =>
      Promise.resolve({
        ref: curriculum.content.index.levels[levelId],
        demoSeen: options.demoSeen ?? false,
      }),
    ),
    assertWithinDailyLimit: jest.fn().mockResolvedValue(undefined),
    markDemoSeen: jest.fn().mockResolvedValue(undefined),
    progressOf: jest.fn(() =>
      Promise.resolve({
        rows: [],
        lookup: new Map(),
        states: computeStates(curriculum.worlds, kid.startClass, new Map()),
      }),
    ),
    recordAbandoned: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn(
      (_k: unknown, state: RunState, summary: { score: number }) =>
        Promise.resolve({ state, summary }),
    ),
  };
  const store = {
    mastery: jest.fn().mockResolvedValue([]),
    insertAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const limiter = {
    attempt: jest.fn().mockResolvedValue({
      allowed: options.allowed ?? true,
      retryAfterSeconds: options.allowed === false ? 42 : 0,
      justLocked: false,
    }),
  };
  const settings = {
    timeZone: 'Europe/Zurich',
    answers: { name: 'learn-answer' },
    runs: { name: 'learn-run' },
  } as unknown as LearningSettings;
  const service = new RunService(
    curriculum,
    progress as unknown as ProgressService,
    store as unknown as ProgressStore,
    runs as unknown as RunStore,
    limiter as unknown as AttemptLimiter,
    settings,
  );
  return { service, runs, progress, store, limiter };
}

async function solutionOf(runs: FakeRunStore, runId: string, index: number) {
  return (await runs.get(runId))!.state.items[index].solution.answer;
}

describe('RunService.startLevel', () => {
  it('starts a run with public items only and the demo the first time', async () => {
    const { service, runs, progress, limiter } = setup();
    const response = await service.startLevel(kid, LEVEL);

    expect(response.items).toHaveLength(6);
    for (const item of response.items) {
      expect(Object.keys(item).sort()).toEqual([
        'index',
        'payload',
        'prompt',
        'type',
      ]);
    }
    expect(JSON.stringify(response.items)).not.toContain('solution');
    expect(response.demoSeen).toBe(false);
    expect(response.demo).toMatchObject({ type: 'count-objects' });
    expect(progress.markDemoSeen).toHaveBeenCalledWith(kid, LEVEL);
    expect(limiter.attempt).toHaveBeenCalledWith(
      { name: 'learn-run' },
      'kid-1',
    );
    const stored = (await runs.get(response.runId))!.state;
    expect(stored).toMatchObject({
      kidId: 'kid-1',
      levelId: LEVEL,
      mode: 'level',
    });
    expect(stored.items[0].solution).toBeDefined();
  });

  it('still sends the demo for a replay once seen', async () => {
    const { service, progress } = setup({ demoSeen: true });
    const response = await service.startLevel(kid, LEVEL);
    expect(response.demoSeen).toBe(true);
    expect(response.demo).toMatchObject({ type: 'count-objects' });
    expect(progress.markDemoSeen).not.toHaveBeenCalled();
  });

  it('replaces the previous run and counts its time', async () => {
    const { service, runs, progress } = setup();
    const first = await service.startLevel(kid, LEVEL);
    const second = await service.startLevel(kid, LEVEL);
    expect(await runs.get(first.runId)).toBeNull();
    expect(await runs.get(second.runId)).not.toBeNull();
    expect(progress.recordAbandoned).toHaveBeenCalledWith(
      expect.objectContaining({ runId: first.runId }),
      expect.any(Date),
    );
  });

  it('logs but survives a failure to record the abandoned run', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, progress } = setup();
    progress.recordAbandoned.mockRejectedValue(new Error('db down'));
    await service.startLevel(kid, LEVEL);
    await expect(service.startLevel(kid, LEVEL)).resolves.toBeDefined();
    expect(Logger.prototype.warn).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('answers 429 with Retry-After when a kid starts too many runs', async () => {
    const { service } = setup({ allowed: false });
    await expect(service.startLevel(kid, LEVEL)).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 42,
      response: { errorCode: 'LEARN_RATE_LIMITED' },
    });
  });

  it('checks the daily limit', async () => {
    const { service, progress } = setup();
    progress.assertWithinDailyLimit.mockRejectedValue(new Error('limit'));
    await expect(service.startLevel(kid, LEVEL)).rejects.toThrow('limit');
  });
});

describe('RunService.answer', () => {
  it('checks the answer, stores the attempt and reveals the solution after the last try', async () => {
    const { service, runs, store } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    const correct = (await solutionOf(runs, runId, 0)) as { value: number };

    await expect(service.answer(kid, runId, 0, correct)).resolves.toEqual({
      correct: true,
      attempt: 1,
    });
    expect(store.insertAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        kidId: 'kid-1',
        runId,
        mode: 'level',
        itemIndex: 0,
        attempt: 1,
        correct: true,
      }),
    );
    await expect(service.answer(kid, runId, 0, correct)).rejects.toMatchObject({
      status: 409,
      response: { errorCode: 'ITEM_DONE' },
    });

    const wrong = {
      value:
        ((await solutionOf(runs, runId, 1)) as { value: number }).value + 1,
    };
    const first = await service.answer(kid, runId, 1, wrong);
    expect(first).toMatchObject({ correct: false, attempt: 1 });
    expect(first.hint).toBeDefined();
    const second = await service.answer(kid, runId, 1, wrong);
    expect(second).toEqual({
      correct: false,
      attempt: 2,
      solution: await solutionOf(runs, runId, 1),
    });
  });

  it('hides other kids’ runs and unknown runs behind 404', async () => {
    const { service } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    await expect(
      service.answer({ ...kid, id: 'kid-2' }, runId, 0, { value: 1 }),
    ).rejects.toMatchObject({
      status: 404,
      response: { errorCode: 'RUN_NOT_FOUND' },
    });
    await expect(
      service.answer(kid, '00000000-0000-4000-8000-000000000000', 0, {}),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects bad indexes and answers with 400', async () => {
    const { service } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    await expect(
      service.answer(kid, runId, 6, { value: 1 }),
    ).rejects.toMatchObject({
      status: 400,
      response: { errorCode: 'VALIDATION_FAILED' },
    });
    await expect(
      service.answer(kid, runId, 0, { value: 'x' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { details: [expect.objectContaining({ field: 'answer' })] },
    });
  });

  it('retries after a concurrent change and gives up with 409 RUN_BUSY', async () => {
    const { service, runs } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    runs.conflicts = 1;
    await expect(
      service.answer(kid, runId, 0, { value: 1 }),
    ).resolves.toBeDefined();
    runs.conflicts = 3;
    await expect(
      service.answer(kid, runId, 1, { value: 1 }),
    ).rejects.toMatchObject({
      status: 409,
      response: { errorCode: 'RUN_BUSY' },
    });
  });

  it('does not turn a concurrent duplicate answer into a second attempt', async () => {
    const { service, runs } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    const original = runs.update.bind(runs);
    jest.spyOn(runs, 'update').mockImplementationOnce(async (current, next) => {
      await original(current, next);
      return false;
    });
    await expect(
      service.answer(kid, runId, 0, { value: 99 }),
    ).rejects.toMatchObject({
      status: 409,
      response: { errorCode: 'RUN_BUSY' },
    });
  });

  it('still answers when the attempt log cannot be written', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, runs, store } = setup();
    store.insertAttempt.mockRejectedValue(new Error('db down'));
    const { runId } = await service.startLevel(kid, LEVEL);
    const correct = await solutionOf(runs, runId, 0);
    await expect(service.answer(kid, runId, 0, correct)).resolves.toEqual({
      correct: true,
      attempt: 1,
    });
    expect(Logger.prototype.error).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('still starts the run when the demo cannot be marked as seen', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, progress } = setup();
    progress.markDemoSeen.mockRejectedValue(new Error('db down'));
    await expect(service.startLevel(kid, LEVEL)).resolves.toMatchObject({
      demoSeen: false,
    });
    jest.restoreAllMocks();
  });

  it('rate-limits answers per kid', async () => {
    const { service } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    const limited = setup({ allowed: false });
    await expect(
      limited.service.answer(kid, runId, 0, {}),
    ).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe('RunService.finish', () => {
  it('finishes a run exactly once', async () => {
    const { service, runs, progress } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    const correct = await solutionOf(runs, runId, 0);
    await service.answer(kid, runId, 0, correct);

    const result = (await service.finish(kid, runId)) as unknown as {
      summary: { score: number };
    };
    expect(result.summary.score).toBeCloseTo(1 / 6);
    expect(progress.finish).toHaveBeenCalledTimes(1);
    await expect(service.finish(kid, runId)).rejects.toMatchObject({
      status: 404,
      response: { errorCode: 'RUN_NOT_FOUND' },
    });
  });

  it('puts the run back when saving the result fails, so finish can be retried', async () => {
    const { service, runs, progress } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    progress.finish.mockRejectedValueOnce(new Error('deadlock'));
    await expect(service.finish(kid, runId)).rejects.toThrow('deadlock');
    expect(await runs.get(runId)).not.toBeNull();
    await expect(service.finish(kid, runId)).resolves.toBeDefined();
  });

  it('does not let another kid finish the run', async () => {
    const { service, runs } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    await expect(
      service.finish({ ...kid, id: 'kid-2' }, runId),
    ).rejects.toMatchObject({ status: 404 });
    expect(await runs.get(runId)).not.toBeNull();
  });

  it('gives up with 409 when the run keeps changing', async () => {
    const { service, runs } = setup();
    const { runId } = await service.startLevel(kid, LEVEL);
    runs.conflicts = 3;
    await expect(service.finish(kid, runId)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('RunService.startPractice', () => {
  it('builds 8 to 10 items from open levels, without a demo', async () => {
    const { service, runs } = setup();
    const response = await service.startPractice(kid);
    expect(response.items.length).toBeGreaterThanOrEqual(8);
    expect(response.items.length).toBeLessThanOrEqual(10);
    expect(response.demoSeen).toBe(true);
    expect(response).not.toHaveProperty('demo');
    const state = (await runs.get(response.runId))!.state;
    expect(state).toMatchObject({ mode: 'practice', levelId: null });
    const open = new Set([
      'math-zahlenwiese-01',
      'math-formenwald-01',
      'reading-de-lautwiese-01',
    ]);
    for (const item of state.items) {
      expect(open.has(item.levelId)).toBe(true);
    }
    expect(response.items.map((item) => item.index)).toEqual(
      response.items.map((_, i) => i),
    );
  });

  it('prefers due skills', async () => {
    const { service, runs, store } = setup();
    store.mastery.mockResolvedValue([
      {
        skillId: 'math.shapes.basic',
        mastery: 0.2,
        box: 1,
        nextReviewAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);
    const response = await service.startPractice(kid);
    const state = (await runs.get(response.runId))!.state;
    expect(state.items[0].skillId).toBe('math.shapes.basic');
    expect(new Set(state.items.map((item) => item.skillId)).size).toBe(3);
  });

  it('answers 409 when nothing is open', async () => {
    const { service, progress } = setup();
    progress.progressOf.mockResolvedValue({
      rows: [],
      lookup: new Map(),
      states: { levels: new Map(), worlds: new Map() },
    });
    await expect(service.startPractice(kid)).rejects.toMatchObject({
      status: 409,
      response: { errorCode: 'NOTHING_TO_PRACTICE' },
    });
  });
});
