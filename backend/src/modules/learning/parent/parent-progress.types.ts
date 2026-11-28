import type {
  Grade,
  Locale,
  PracticeTopicId,
  PracticeTopicState,
  ProgressState,
  Stars,
} from '@murmeli/content';

export interface ParentProgressLevel {
  readonly id: string;
  readonly title: string;
  readonly state: ProgressState;
  readonly stars: Stars;
  readonly bestScore: number;
  readonly runs: number;
  readonly firstPassedAt: string | null;
}

export interface ParentProgressWorld {
  readonly id: string;
  readonly title: string;
  readonly grade: Grade;
  readonly state: ProgressState;
  readonly stars: number;
  readonly maxStars: number;
  readonly levels: readonly ParentProgressLevel[];
}

export interface ParentProgressTrack {
  readonly id: string;
  readonly title: string;
  readonly worlds: readonly ParentProgressWorld[];
}

export interface ParentSkillMastery {
  readonly id: string;
  readonly title: string;
  readonly trackId: string | null;
  readonly worldId: string | null;
  /** 0–1 */
  readonly mastery: number;
  /** Leitner box 1–5 */
  readonly box: number;
  readonly nextReviewAt: string;
  readonly lastPracticedAt: string;
}

export interface ParentActivityDay {
  /** YYYY-MM-DD in APP_TIMEZONE */
  readonly day: string;
  readonly minutes: number;
  readonly runs: number;
}

export interface ParentBadge {
  readonly id: string;
  readonly title: string;
  readonly earnedAt: string;
}

/** A mistake Murmeli will ask again. */
export interface ParentPracticeMistake {
  /** What the kid heard, as one sentence */
  readonly question: string;
  /** The right answer, or null for tracing and coins */
  readonly answer: string | null;
  readonly misses: number;
  readonly dueAt: string;
}

export interface ParentPracticeTopic {
  readonly id: PracticeTopicId;
  readonly title: string;
  readonly trackId: string;
  readonly state: PracticeTopicState;
  /** 1-based step the next run trains */
  readonly level: number;
  readonly maxLevel: number;
  readonly levels: number;
  readonly runs: number;
  /** Practice items answered (repeats within a run not counted), all time */
  readonly items: number;
  /** Of those, right on the first try */
  readonly firstTry: number;
  /** Items and first-try answers in the last 14 days */
  readonly recentItems: number;
  readonly recentFirstTry: number;
  readonly lastPracticedAt: string | null;
  readonly openMistakes: number;
  /** Up to 5, most missed first */
  readonly mistakes: readonly ParentPracticeMistake[];
}

export interface ParentPracticeDay {
  /** YYYY-MM-DD in APP_TIMEZONE */
  readonly day: string;
  readonly items: number;
  readonly firstTry: number;
}

export interface ParentPractice {
  /** Topics practiced or with open mistakes, most recently practiced first */
  readonly topics: readonly ParentPracticeTopic[];
  /** The last 14 days, oldest first, including days without practice */
  readonly days: readonly ParentPracticeDay[];
}

/**
 * `GET /api/parent/kids/:id/progress`. Titles are in the kid's language.
 */
export interface ParentProgressResponse {
  readonly kidId: string;
  readonly locale: Locale;
  readonly tracks: readonly ParentProgressTrack[];
  readonly skills: readonly ParentSkillMastery[];
  /** The last 14 days, oldest first, including days without activity */
  readonly activity: readonly ParentActivityDay[];
  /** Skills practiced in the last 14 days with mastery below 0.6, weakest first */
  readonly weakSkills: readonly ParentSkillMastery[];
  readonly badges: readonly ParentBadge[];
  readonly practice: ParentPractice;
}
