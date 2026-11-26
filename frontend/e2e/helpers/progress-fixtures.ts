import type {
  ParentActivityDay,
  ParentProgressResponse,
} from '../../src/app/pages/parent/progress/parent-progress.types';

const MINUTES = [0, 12, 18, 0, 0, 25, 9, 0, 14, 0, 31, 7, 0, 16];

/** The 14 days ending 2026-11-26, oldest first, like the backend sends them. */
export function activityDays(minutes: readonly number[] = MINUTES): ParentActivityDay[] {
  return minutes.map((value, index) => {
    const date = new Date(Date.UTC(2026, 10, 13 + index));
    return {
      day: date.toISOString().slice(0, 10),
      minutes: value,
      runs: value === 0 ? 0 : Math.max(1, Math.round(value / 6)),
    };
  });
}

/** A kid one world into the math trail and just starting to read, with one weak skill. */
export function progressFixture(kidId: string): ParentProgressResponse {
  return {
    kidId,
    locale: 'de-CH',
    activity: activityDays(),
    badges: [
      { id: 'first-level', title: 'Erster Wegweiser', earnedAt: '2026-11-14T15:20:00.000Z' },
      { id: 'first-world', title: 'Erste Gipfelfahne', earnedAt: '2026-11-23T16:05:00.000Z' },
    ],
    tracks: [
      {
        id: 'math',
        title: 'Mathematik',
        worlds: [
          {
            id: 'math-zahlenwiese',
            title: 'Zahlenwiese',
            grade: 'KG1',
            state: 'passed',
            stars: 8,
            maxStars: 9,
            levels: [
              level('math-zahlenwiese-01', 'Bis 3 zählen', 'passed', 3, 2),
              level('math-zahlenwiese-02', 'Bis 5 zählen', 'passed', 3, 1),
              level('math-zahlenwiese-03', 'Punkte erkennen', 'passed', 2, 3),
            ],
          },
          {
            id: 'math-rechenberg',
            title: 'Rechenberg',
            grade: 'KG2',
            state: 'unlocked',
            stars: 2,
            maxStars: 9,
            levels: [
              level('math-rechenberg-01', 'Plus bis 5', 'passed', 2, 4),
              level('math-rechenberg-02', 'Minus bis 5', 'unlocked', 1, 2),
              level('math-rechenberg-03', 'Zahlenhaus', 'locked', 0, 0),
            ],
          },
        ],
      },
      {
        id: 'reading-de',
        title: 'Lesen und Schreiben',
        worlds: [
          {
            id: 'reading-buchstabenwald',
            title: 'Buchstabenwald',
            grade: 'KG1',
            state: 'unlocked',
            stars: 0,
            maxStars: 6,
            levels: [
              level('reading-buchstabenwald-01', 'Anlaute hören', 'unlocked', 0, 1),
              level('reading-buchstabenwald-02', 'Silben klatschen', 'locked', 0, 0),
            ],
          },
          {
            id: 'reading-silbenbach',
            title: 'Silbenbach',
            grade: 'KG2',
            state: 'locked',
            stars: 0,
            maxStars: 6,
            levels: [
              level('reading-silbenbach-01', 'Silben zählen', 'locked', 0, 0),
              level('reading-silbenbach-02', 'Wörter bauen', 'locked', 0, 0),
            ],
          },
        ],
      },
    ],
    skills: [
      skill('math.count.3', 'Bis 3 zählen', 0.96, '2026-12-10T08:00:00.000Z'),
      skill('math.count.5', 'Bis 5 zählen', 0.88, '2026-12-03T08:00:00.000Z'),
      skill('math.dots', 'Punktbilder erkennen', 0.74, '2026-11-29T08:00:00.000Z'),
      skill('math.add.5', 'Plus bis 5', 0.67, '2026-11-28T08:00:00.000Z'),
      skill('math.sub.5', 'Minus bis 5', 0.42, '2026-11-20T08:00:00.000Z'),
      skill('reading.initial', 'Anlaute', 0.55, '2026-11-27T08:00:00.000Z'),
    ],
    weakSkills: [
      skill('math.sub.5', 'Minus bis 5', 0.42, '2026-11-20T08:00:00.000Z'),
      skill('reading.initial', 'Anlaute', 0.55, '2026-11-27T08:00:00.000Z'),
    ],
  };
}

/** A kid who has not played yet. */
export function emptyProgressFixture(kidId: string): ParentProgressResponse {
  return {
    kidId,
    locale: 'de-CH',
    activity: activityDays(MINUTES.map(() => 0)),
    badges: [],
    tracks: [],
    skills: [],
    weakSkills: [],
  };
}

function level(
  id: string,
  title: string,
  state: 'locked' | 'unlocked' | 'passed',
  stars: 0 | 1 | 2 | 3,
  runs: number,
) {
  return {
    id,
    title,
    state,
    stars,
    bestScore: stars / 3,
    runs,
    firstPassedAt: state === 'passed' ? '2026-11-20T10:00:00.000Z' : null,
  };
}

function skill(id: string, title: string, mastery: number, nextReviewAt: string) {
  return {
    id,
    title,
    trackId: id.split('.')[0] === 'math' ? 'math' : 'reading-de',
    worldId: null,
    mastery,
    box: Math.max(1, Math.round(mastery * 5)),
    nextReviewAt,
    lastPracticedAt: '2026-11-25T16:00:00.000Z',
  };
}
