import type {
  ParentPractice,
  ParentPracticeDay,
  ParentPracticeTopic,
} from './parent-progress.types';

export interface PracticeTopicRow {
  readonly topic: ParentPracticeTopic;
  /** The step as a share of the reachable steps, 0–100. */
  readonly levelPercent: number;
  /** First-try answers in the last 14 days, or null without practice. */
  readonly recentPercent: number | null;
  readonly lastPracticed: string;
}

export interface PracticeSummary {
  readonly items: number;
  readonly firstTry: number;
  readonly percent: number | null;
  readonly activeDays: number;
}

export function firstTryPercent(firstTry: number, items: number): number | null {
  return items > 0 ? Math.round((Math.min(firstTry, items) / items) * 100) : null;
}

export function practiceRows(
  practice: ParentPractice | undefined,
  locale: string,
): PracticeTopicRow[] {
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return (practice?.topics ?? []).map((topic) => {
    const last = topic.lastPracticedAt ? new Date(topic.lastPracticedAt) : null;
    return {
      topic,
      levelPercent:
        topic.maxLevel > 0
          ? Math.round(Math.min(1, Math.max(0, topic.level / topic.maxLevel)) * 100)
          : 0,
      recentPercent: firstTryPercent(topic.recentFirstTry, topic.recentItems),
      lastPracticed: last && !Number.isNaN(last.getTime()) ? format.format(last) : '',
    };
  });
}

export function practiceSummary(days: readonly ParentPracticeDay[]): PracticeSummary {
  const items = days.reduce((sum, day) => sum + Math.max(0, day.items), 0);
  const firstTry = days.reduce((sum, day) => sum + Math.max(0, day.firstTry), 0);
  return {
    items,
    firstTry,
    percent: firstTryPercent(firstTry, items),
    activeDays: days.filter((day) => day.items > 0).length,
  };
}

const PRACTICE_KEYS = 'parent.progress.practice';

/** "14 Tage: 1 Aufgabe …" or "… 12 Aufgaben …". */
export function recentKey(items: number): string {
  return `${PRACTICE_KEYS}.${items === 1 ? 'recentOne' : 'recent'}`;
}

/** "1 Aufgabe in 1 Runde", "12 Aufgaben in 1 Runde" or "12 Aufgaben in 3 Runden". */
export function totalKey(items: number, runs: number): string {
  if (items === 1) {
    return `${PRACTICE_KEYS}.totalOne`;
  }
  return `${PRACTICE_KEYS}.${runs === 1 ? 'totalOneRound' : 'total'}`;
}

export function missesKey(count: number): string {
  return `${PRACTICE_KEYS}.${count === 1 ? 'missesLabelOne' : 'missesLabel'}`;
}
