import type { KidsService } from '../../kids/kids.service';
import { loadCurriculum } from '../content/curriculum';
import type { LearningSettings } from '../learning.settings';
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
  );
  return {
    store,
    kids,
    service: new ParentProgressService(
      kids as unknown as KidsService,
      curriculum,
      progress,
      store as unknown as ProgressStore,
      settings,
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
});
