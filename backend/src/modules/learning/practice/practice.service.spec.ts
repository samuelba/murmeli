import { Logger } from '@nestjs/common';
import { Curriculum, loadCurriculum } from '../content/curriculum';
import type {
  LearningKid,
  ProgressService,
} from '../progress/progress.service';
import { computeStates } from '../progress/unlock';
import { PracticeService } from './practice.service';
import type { PracticeStore } from './practice.store';

const curriculum = loadCurriculum(undefined);
const NOW = new Date('2026-11-28T10:00:00Z');
const kid: LearningKid = {
  id: 'kid-1',
  language: 'de-CH',
  startClass: 'KG1',
  dailyLimitMinutes: null,
};

function setup(source: Curriculum = curriculum) {
  const progress = {
    progressOf: jest.fn(() =>
      Promise.resolve({
        rows: [],
        lookup: new Map(),
        states: computeStates(curriculum.worlds, kid.startClass, new Map()),
      }),
    ),
  };
  const store = {
    topics: jest.fn().mockResolvedValue([]),
    reviewCounts: jest.fn().mockResolvedValue([
      { topicId: 'count', due: 2, total: 3 },
      { topicId: 'plus', due: 4, total: 4 },
    ]),
    dueReviews: jest.fn().mockResolvedValue([]),
    deleteReviews: jest.fn().mockResolvedValue(undefined),
    markDemoSeen: jest.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    service: new PracticeService(
      source,
      progress as unknown as ProgressService,
      store as unknown as PracticeStore,
    ),
  };
}

describe('PracticeService.catalog', () => {
  it('lists the topics of the kid’s tracks with state, step and due mistakes', async () => {
    const { service, store } = setup();
    const catalog = await service.catalog(kid, NOW);
    expect(store.reviewCounts).toHaveBeenCalledWith('kid-1', 'de-CH', NOW);
    expect(catalog.tracks.map((track) => track.id)).toEqual([
      'math',
      'reading-de',
    ]);
    const math = catalog.tracks[0];
    expect(math).toMatchObject({
      title: 'Mathematik',
      icon: expect.any(String),
    });
    const topic = (id: string) =>
      catalog.tracks
        .flatMap((track) => track.topics)
        .find((view) => view.id === id);
    expect(topic('count')).toEqual({
      id: 'count',
      title: 'Zählen',
      state: 'open',
      level: 1,
      maxLevel: 3,
      levels: 5,
      dueReviews: 2,
      practiced: false,
    });
    expect(topic('numbers')).toMatchObject({ state: 'ahead', maxLevel: 2 });
    expect(topic('plus')).toMatchObject({
      state: 'locked',
      level: 0,
      maxLevel: 0,
      dueReviews: 0,
    });
    expect(topic('syllables')).toBeDefined();
    expect(catalog.mix).toEqual({ available: true, dueReviews: 2 });
  });

  it('shows the kid’s own step for practiced topics', async () => {
    const { service, store } = setup();
    store.topics.mockResolvedValue([
      {
        topicId: 'count',
        rating: 2.4,
        pathStep: -1,
        runs: 2,
        items: 20,
        firstTry: 18,
        accuracy: 0.9,
        demoSeen: true,
        lastPracticedAt: NOW,
      },
    ]);
    const catalog = await service.catalog(kid, NOW);
    expect(catalog.tracks[0].topics[0]).toMatchObject({
      id: 'count',
      level: 3,
      practiced: true,
    });
  });

  it('only logs when the demo cannot be marked as seen', async () => {
    const { service, store } = setup();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    store.markDemoSeen.mockRejectedValue(new Error('db down'));
    await expect(
      service.markDemoSeen(kid, {
        topic: 'count',
        rating: 0.5,
        maxStep: 2,
        pathStep: -1,
        runs: 0,
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    warn.mockRestore();
  });

  it('keeps a mistake whose exercise cannot be made right now', async () => {
    const ref = curriculum.content.index.levels['math-zahlenwiese-01'];
    const broken = new Curriculum({
      ...curriculum.content,
      index: {
        ...curriculum.content.index,
        levels: {
          ...curriculum.content.index.levels,
          [ref.level.id]: {
            ...ref,
            level: {
              ...ref.level,
              generators: [
                {
                  type: 'add-sub',
                  weight: 1,
                  params: { operations: [], max: 1, unknown: 'result' },
                },
              ] as unknown as typeof ref.level.generators,
            },
          },
        },
      },
    });
    const { service, store } = setup(broken);
    store.dueReviews.mockResolvedValue([
      {
        id: 'r1',
        topicId: 'count',
        itemKey: 'key',
        source: { levelId: ref.level.id, generator: 0, seed: 1 },
        tier: 0,
        box: 0,
        misses: 1,
        dueAt: NOW,
      },
    ]);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const plan = await service.plan(kid, 'count', 5, NOW);
    expect(plan.items).toHaveLength(10);
    expect(plan.items.some((item) => item.again === 'review')).toBe(false);
    expect(store.deleteReviews).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('r1'));
    error.mockRestore();
  });
});
