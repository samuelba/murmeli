import type { KidsService } from '../../kids/kids.service';
import { loadCurriculum } from '../content/curriculum';
import type { LearningSettings } from '../learning.settings';
import type { PracticeRecorder } from '../practice/practice-recorder';
import { PracticeService } from '../practice/practice.service';
import type { PracticeStore, ReviewRow } from '../practice/practice.store';
import { ProgressService } from '../progress/progress.service';
import type { ProgressStore } from '../progress/progress.store';
import { ParentProgressService } from './parent-progress.service';

const curriculum = loadCurriculum(undefined);
const NOW = new Date('2026-03-10T10:00:00Z');
const kid = {
  id: 'kid-1',
  userId: 'u1',
  language: 'en-US' as const,
  startClass: 'KG1' as const,
  dailyLimitMinutes: null,
};

function setup() {
  const passedAt = new Date('2026-03-09T08:00:00Z');
  const store = {
    levels: jest.fn().mockResolvedValue([
      {
        levelId: 'math-zahlenwiese-01',
        stars: 3,
        passed: true,
        bestScore: 1,
        runs: 2,
        firstPassedAt: passedAt,
        demoSeen: true,
      },
    ]),
    mastery: jest.fn().mockResolvedValue([
      {
        skillId: 'math.count.to5',
        mastery: 0.9,
        box: 2,
        nextReviewAt: new Date('2026-03-11T08:00:00Z'),
        updatedAt: passedAt,
      },
      {
        skillId: 'math.shapes.basic',
        mastery: 0.3,
        box: 1,
        nextReviewAt: new Date('2026-03-10T08:00:00Z'),
        updatedAt: passedAt,
      },
      {
        skillId: 'math.compare.to10',
        mastery: 0.1,
        box: 1,
        nextReviewAt: new Date('2026-01-10T08:00:00Z'),
        updatedAt: new Date('2026-01-09T08:00:00Z'),
      },
      {
        skillId: 'retired.skill',
        mastery: 0.2,
        box: 1,
        nextReviewAt: passedAt,
        updatedAt: passedAt,
      },
    ]),
    activity: jest.fn().mockResolvedValue([
      { day: '2026-03-09', seconds: 61, runs: 2 },
      { day: '2026-03-10', seconds: 30, runs: 1 },
    ]),
    badges: jest.fn().mockResolvedValue([
      { badgeId: 'first-level', earnedAt: passedAt },
      { badgeId: 'retired-badge', earnedAt: passedAt },
    ]),
  };
  const kids = { requireOwned: jest.fn().mockResolvedValue(kid) };
  const settings = { timeZone: 'Europe/Zurich' } as LearningSettings;
  const progress = new ProgressService(
    curriculum,
    store as unknown as ProgressStore,
    settings,
    {} as PracticeRecorder,
  );
  const practiceStore = {
    topics: jest.fn().mockResolvedValue([]),
    reviews: jest.fn().mockResolvedValue([]),
    daily: jest.fn().mockResolvedValue([]),
  };
  const practice = new PracticeService(
    curriculum,
    progress,
    practiceStore as unknown as PracticeStore,
  );
  return {
    store,
    kids,
    practiceStore,
    service: new ParentProgressService(
      kids as unknown as KidsService,
      curriculum,
      progress,
      store as unknown as ProgressStore,
      settings,
      practice,
      practiceStore as unknown as PracticeStore,
    ),
  };
}

describe('ParentProgressService', () => {
  it('checks that the kid belongs to the parent', async () => {
    const { service, kids } = setup();
    kids.requireOwned.mockRejectedValue(new Error('KID_NOT_FOUND'));
    await expect(service.forKid('u2', 'kid-1', NOW)).rejects.toThrow(
      'KID_NOT_FOUND',
    );
  });

  it('reports levels, skills, 14 days of activity, weak skills and badges', async () => {
    const { service, kids, store } = setup();
    const result = await service.forKid('u1', 'kid-1', NOW);

    expect(kids.requireOwned).toHaveBeenCalledWith('u1', 'kid-1');
    expect(result.kidId).toBe('kid-1');
    expect(result.locale).toBe('en-US');
    expect(result.tracks.map((t) => t.id)).toEqual(['math', 'reading-en']);
    expect(result.tracks[0].worlds[0].levels[0]).toEqual({
      id: 'math-zahlenwiese-01',
      title: expect.any(String),
      state: 'passed',
      stars: 3,
      bestScore: 1,
      runs: 2,
      firstPassedAt: '2026-03-09T08:00:00.000Z',
    });
    expect(result.tracks[0].worlds[0].levels[1]).toMatchObject({
      state: 'unlocked',
      runs: 0,
      firstPassedAt: null,
    });

    expect(result.skills[0]).toEqual({
      id: 'math.count.to5',
      title: 'Counting to 5',
      trackId: 'math',
      worldId: 'math-zahlenwiese',
      mastery: 0.9,
      box: 2,
      nextReviewAt: '2026-03-11T08:00:00.000Z',
      lastPracticedAt: '2026-03-09T08:00:00.000Z',
    });
    expect(result.skills[3]).toMatchObject({
      title: 'retired.skill',
      trackId: null,
    });

    expect(store.activity).toHaveBeenCalledWith('kid-1', '2026-02-25');
    expect(result.activity).toHaveLength(14);
    expect(result.activity[0]).toEqual({
      day: '2026-02-25',
      minutes: 0,
      runs: 0,
    });
    expect(result.activity.slice(-2)).toEqual([
      { day: '2026-03-09', minutes: 2, runs: 2 },
      { day: '2026-03-10', minutes: 1, runs: 1 },
    ]);

    expect(result.weakSkills.map((s) => s.id)).toEqual([
      'retired.skill',
      'math.shapes.basic',
    ]);
    expect(result.badges).toEqual([
      {
        id: 'first-level',
        title: 'First Signpost',
        earnedAt: '2026-03-09T08:00:00.000Z',
      },
    ]);
  });

  it('reports the practice ground: steps, recent accuracy and open mistakes', async () => {
    const { service, practiceStore } = setup();
    const practicedAt = new Date('2026-03-09T09:00:00Z');
    practiceStore.topics.mockResolvedValue([
      {
        topicId: 'count',
        rating: 1.6,
        pathStep: 0,
        runs: 3,
        items: 30,
        firstTry: 24,
        accuracy: 0.8,
        demoSeen: true,
        lastPracticedAt: practicedAt,
      },
      {
        topicId: 'shapes',
        rating: 0.5,
        pathStep: -1,
        runs: 0,
        items: 0,
        firstTry: 0,
        accuracy: undefined,
        demoSeen: true,
        lastPracticedAt: null,
      },
    ]);
    const review = (
      topicId: ReviewRow['topicId'],
      levelId: string,
      misses: number,
    ): ReviewRow => ({
      id: `r-${levelId}`,
      topicId,
      itemKey: `key-${levelId}`,
      source: { levelId, generator: 0, seed: 7 },
      tier: 0,
      box: 0,
      misses,
      dueAt: NOW,
    });
    practiceStore.reviews.mockResolvedValue([
      review('count', 'math-zahlenwiese-01', 2),
      review('count', 'gone-level', 1),
      review('patterns', 'math-formenwald-05', 1),
    ]);
    practiceStore.daily.mockResolvedValue([
      { day: '2026-03-09', topicId: 'count', items: 10, firstTry: 8 },
      { day: '2026-03-09', topicId: 'shapes', items: 2, firstTry: 1 },
    ]);

    const { practice } = await service.forKid('u1', 'kid-1', NOW);

    expect(practiceStore.daily).toHaveBeenCalledWith('kid-1', '2026-02-25');
    expect(practice.topics.map((topic) => topic.id)).toEqual([
      'count',
      'patterns',
    ]);
    expect(practice.topics[0]).toMatchObject({
      title: 'Counting',
      trackId: 'math',
      state: 'open',
      level: 2,
      runs: 3,
      items: 30,
      firstTry: 24,
      recentItems: 10,
      recentFirstTry: 8,
      lastPracticedAt: '2026-03-09T09:00:00.000Z',
      openMistakes: 2,
    });
    expect(practice.topics[0].mistakes).toEqual([
      {
        question: expect.stringMatching(/^How many/),
        answer: expect.stringMatching(/^[1-3]$/),
        misses: 2,
        dueAt: NOW.toISOString(),
      },
    ]);
    expect(practice.topics[1]).toMatchObject({
      id: 'patterns',
      runs: 0,
      openMistakes: 1,
      lastPracticedAt: null,
    });
    expect(practice.topics[1].mistakes[0].answer).toEqual(expect.any(String));
    expect(practice.days).toHaveLength(14);
    expect(practice.days.at(-2)).toEqual({
      day: '2026-03-09',
      items: 12,
      firstTry: 9,
    });
  });
});
