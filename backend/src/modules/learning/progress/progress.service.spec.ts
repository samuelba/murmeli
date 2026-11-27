import { loadCurriculum } from '../content/curriculum';
import type { LearningSettings } from '../learning.settings';
import type { RunState, RunSummary } from '../runs/run-state';
import { type LearningKid, ProgressService } from './progress.service';
import type { LevelProgressRow, ProgressStore } from './progress.store';

const curriculum = loadCurriculum(undefined);
const NOW = new Date('2026-01-14T23:30:00Z');

const kid: LearningKid = {
  id: 'kid-1',
  language: 'de-CH',
  startClass: 'KG1',
  dailyLimitMinutes: null,
};

function row(
  levelId: string,
  stars: 0 | 1 | 2 | 3,
  passed = stars >= 2,
): LevelProgressRow {
  return {
    levelId,
    stars,
    passed,
    bestScore: stars / 3,
    runs: 1,
    firstPassedAt: passed ? NOW : null,
    demoSeen: true,
  };
}

function setup(levels: LevelProgressRow[][] = [[]]) {
  const db = { query: jest.fn() };
  let call = 0;
  const store = {
    levels: jest.fn(() =>
      Promise.resolve(levels[Math.min(call++, levels.length - 1)]),
    ),
    mastery: jest.fn().mockResolvedValue([]),
    secondsOn: jest.fn().mockResolvedValue(0),
    addActivity: jest.fn().mockResolvedValue(undefined),
    markDemoSeen: jest.fn().mockResolvedValue(undefined),
    recordLevel: jest.fn().mockResolvedValue(undefined),
    saveMastery: jest.fn().mockResolvedValue(undefined),
    awardBadges: jest.fn((_k: string, ids: string[]) => Promise.resolve(ids)),
    badges: jest
      .fn()
      .mockResolvedValue([{ badgeId: 'first-level', earnedAt: NOW }]),
    lockKid: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn((work: (d: typeof db) => unknown) => work(db)),
  };
  const settings = { timeZone: 'Europe/Zurich' } as LearningSettings;
  return {
    store,
    db,
    service: new ProgressService(
      curriculum,
      store as unknown as ProgressStore,
      settings,
    ),
  };
}

function runState(overrides: Partial<RunState> = {}): RunState {
  return {
    v: 2,
    runId: 'run-1',
    kidId: kid.id,
    levelId: 'math-zahlenwiese-01',
    mode: 'level',
    locale: 'de-CH',
    seed: 1,
    startedAt: 0,
    lastAt: 0,
    activeMs: 0,
    items: [{ attempts: 1 }] as unknown as RunState['items'],
    ...overrides,
  };
}

function summary(score: number, skill = 'math.count.to5'): RunSummary {
  return { score, skillScores: new Map([[skill, score]]), activeSeconds: 95 };
}

describe('ProgressService.map', () => {
  it('builds the map from one progress query', async () => {
    const { service, store } = setup([[row('math-zahlenwiese-01', 3)]]);
    const map = await service.map(kid);
    expect(store.levels).toHaveBeenCalledTimes(1);
    expect(map.tracks.map((t) => t.id)).toEqual(['math', 'reading-de']);
    expect(map.tracks[0].worlds[0].levels[1].state).toBe('unlocked');
    expect(store.badges).toHaveBeenCalledWith(kid.id);
    expect(map.badges).toEqual(['first-level']);
  });
});

describe('ProgressService.levelAccess', () => {
  it('rejects unknown levels and levels of other languages with 404', async () => {
    const { service } = setup();
    for (const id of ['nope-01', 'reading-en-sound-garden-01']) {
      await expect(service.levelAccess(kid, id)).rejects.toMatchObject({
        status: 404,
        response: { errorCode: 'LEVEL_NOT_FOUND' },
      });
    }
  });

  it('rejects locked levels with 403', async () => {
    const { service } = setup();
    await expect(
      service.levelAccess(kid, 'math-zahlenwiese-02'),
    ).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'LEVEL_LOCKED' },
    });
  });

  it('allows open levels and reports whether the demo was seen', async () => {
    const { service } = setup([
      [{ ...row('math-zahlenwiese-01', 0), demoSeen: false }],
    ]);
    await expect(
      service.levelAccess(kid, 'math-zahlenwiese-01'),
    ).resolves.toMatchObject({
      ref: { worldId: 'math-zahlenwiese' },
      demoSeen: false,
    });
    await expect(
      setup().service.levelAccess(kid, 'math-formenwald-01'),
    ).resolves.toMatchObject({ demoSeen: false });
  });

  it('allows skipped levels of placed worlds', async () => {
    const { service } = setup();
    await expect(
      service.levelAccess({ ...kid, startClass: '1' }, 'math-zahlenbach-05'),
    ).resolves.toBeDefined();
  });
});

describe('ProgressService daily limit', () => {
  it('does not look anything up without a limit', async () => {
    const { service, store } = setup();
    await service.assertWithinDailyLimit(kid, NOW);
    expect(store.secondsOn).not.toHaveBeenCalled();
  });

  it('counts the Zurich day and refuses at the limit', async () => {
    const { service, store } = setup();
    const limited = { ...kid, dailyLimitMinutes: 10 };
    store.secondsOn.mockResolvedValueOnce(599);
    await expect(
      service.assertWithinDailyLimit(limited, NOW),
    ).resolves.toBeUndefined();
    expect(store.secondsOn).toHaveBeenCalledWith('kid-1', '2026-01-15');
    store.secondsOn.mockResolvedValueOnce(600);
    await expect(
      service.assertWithinDailyLimit(limited, NOW),
    ).rejects.toMatchObject({
      status: 403,
      response: { errorCode: 'DAILY_LIMIT_REACHED' },
    });
  });

  it('records the answer time of abandoned runs without counting a run', async () => {
    const { service, store } = setup();
    await service.recordAbandoned(runState({ activeMs: 0 }), NOW);
    expect(store.addActivity).not.toHaveBeenCalled();
    await service.recordAbandoned(runState({ activeMs: 42_000 }), NOW);
    expect(store.addActivity).toHaveBeenCalledWith(
      'kid-1',
      '2026-01-15',
      42,
      0,
    );
  });

  it('marks demos as seen', async () => {
    const { service, store } = setup();
    await service.markDemoSeen(kid, 'math-zahlenwiese-01');
    expect(store.markDemoSeen).toHaveBeenCalledWith(
      'kid-1',
      'math-zahlenwiese-01',
    );
  });
});

describe('ProgressService.finish', () => {
  it('records a passed level, mastery, activity, unlocks and badges in one transaction', async () => {
    const { service, store, db } = setup([[], [row('math-zahlenwiese-01', 3)]]);
    const result = await service.finish(kid, runState(), summary(1), NOW);

    expect(result).toEqual({
      score: 1,
      stars: 3,
      passed: true,
      unlocked: { levels: ['math-zahlenwiese-02'], worlds: [] },
      newBadges: ['first-level'],
    });
    expect(store.lockKid).toHaveBeenCalledWith('kid-1', db);
    expect(store.recordLevel).toHaveBeenCalledWith(
      'kid-1',
      { levelId: 'math-zahlenwiese-01', stars: 3, score: 1, passed: true },
      db,
    );
    expect(store.saveMastery).toHaveBeenCalledWith(
      'kid-1',
      'math.count.to5',
      expect.objectContaining({ mastery: 1, box: 2 }),
      db,
    );
    expect(store.addActivity).toHaveBeenCalledWith(
      'kid-1',
      '2026-01-15',
      95,
      1,
      db,
    );
  });

  it('reports newly opened worlds of the kid’s tracks only', async () => {
    const meadow = curriculum.content.index.worlds['math-zahlenwiese'].world;
    const allButLast = meadow.levels.slice(0, -1).map((l) => row(l.id, 2));
    const all = meadow.levels.map((l) => row(l.id, 2));
    const { service } = setup([allButLast, all]);
    const last = meadow.levels[meadow.levels.length - 1];
    const result = await service.finish(
      kid,
      runState({ levelId: last.id }),
      summary(0.8, last.skill),
      NOW,
    );
    const opened = curriculum.content.tracks
      .filter((track) => track.locales.includes(kid.language))
      .flatMap((track) => track.worlds)
      .filter((world) => world.requires.includes('math-zahlenwiese'));
    expect(opened.length).toBeGreaterThan(0);
    expect(result.unlocked).toEqual({
      levels: opened.map((world) => world.levels[0].id),
      worlds: opened.map((world) => world.id),
    });
    expect(result.newBadges).toEqual(['first-level', 'first-world']);
  });

  it('updates mastery from the previous value', async () => {
    const { service, store } = setup();
    store.mastery.mockResolvedValueOnce([
      {
        skillId: 'math.count.to5',
        mastery: 0.5,
        box: 3,
        nextReviewAt: NOW,
        updatedAt: NOW,
      },
    ]);
    await service.finish(kid, runState(), summary(0), NOW);
    expect(store.saveMastery).toHaveBeenCalledWith(
      'kid-1',
      'math.count.to5',
      expect.objectContaining({ mastery: 0.35, box: 1 }),
      expect.anything(),
    );
  });

  it('does not touch stars for practice runs', async () => {
    const { service, store } = setup();
    const result = await service.finish(
      kid,
      runState({ levelId: null, mode: 'practice' }),
      summary(0.9),
      NOW,
    );
    expect(result).toMatchObject({
      stars: 2,
      passed: false,
      newBadges: ['first-practice'],
    });
    expect(store.recordLevel).not.toHaveBeenCalled();
    expect(store.saveMastery).toHaveBeenCalled();
  });

  it('gives no practice badge for a practice run without answers', async () => {
    const { service } = setup();
    const result = await service.finish(
      kid,
      runState({
        levelId: null,
        mode: 'practice',
        items: [{ attempts: 0 }] as unknown as RunState['items'],
      }),
      summary(0),
      NOW,
    );
    expect(result.newBadges).toEqual([]);
  });
});
