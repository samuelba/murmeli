import type { Grade, Locale, ProgressState, Stars } from '@murmeli/content';

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
}
