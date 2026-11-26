export const RUN_MODES = ['level', 'practice'] as const;
export type RunMode = (typeof RUN_MODES)[number];

export const RUN_TTL_SECONDS = 2 * 3600;
/** Longest gap between two answers that still counts as learning time */
export const MAX_ITEM_DURATION_MS = 5 * 60 * 1000;

export const SECONDS_PER_DAY = 86_400;

export const LEITNER_INTERVAL_DAYS = [1, 2, 4, 8, 16] as const;
export const LEITNER_MAX_BOX = LEITNER_INTERVAL_DAYS.length;
export const MASTERY_KEEP = 0.7;
export const MASTERY_RUN = 0.3;
export const BOX_UP_SCORE = 0.8;
export const BOX_RESET_SCORE = 0.5;

export const PRACTICE_SKILLS = 3;
export const PRACTICE_TARGET_ITEMS = 9;
export const PRACTICE_PASS_RATIO = 0.8;

export const ACTIVITY_DAYS = 14;
export const WEAK_MASTERY = 0.6;
export const WEAK_SKILLS_MAX = 5;

export const LEVEL_NOT_FOUND = 'LEVEL_NOT_FOUND';
export const LEVEL_LOCKED = 'LEVEL_LOCKED';
export const RUN_NOT_FOUND = 'RUN_NOT_FOUND';
export const ITEM_DONE = 'ITEM_DONE';
export const ITEM_NOT_FOUND = 'ITEM_NOT_FOUND';
export const NOTHING_TO_PRACTICE = 'NOTHING_TO_PRACTICE';
export const RUN_BUSY = 'RUN_BUSY';
