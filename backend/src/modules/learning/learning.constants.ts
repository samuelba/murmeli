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

export const PRACTICE_PASS_RATIO = 0.8;
/** Items of a run on one topic, reviews included */
export const PRACTICE_TOPIC_ITEMS = 10;
/** "Murmeli wählt": topics mixed into one run, and new items per topic */
export const PRACTICE_MIX_TOPICS = 3;
export const PRACTICE_MIX_ITEMS_PER_TOPIC = 3;
/** Earlier mistakes asked again per run */
export const PRACTICE_MAX_REVIEWS = 3;
/** Missed items appended to the same practice run */
export const PRACTICE_MAX_REPEATS = 2;
/** Steps of a topic reachable beyond the trail */
export const PRACTICE_AHEAD_STEPS = 2;
/** Days until a review is due again after 1 and 2 right answers; the 3rd ends it */
export const REVIEW_INTERVAL_DAYS = [1, 3] as const;
export const REVIEW_DONE_BOX = REVIEW_INTERVAL_DAYS.length + 1;
/** Open mistakes kept per topic; older ones are dropped */
export const REVIEWS_PER_TOPIC = 20;
/** Rating change per unit of surprise, and during placement (the first runs) */
export const RATING_K = 0.4;
export const RATING_K_PLACEMENT = 0.8;
export const PLACEMENT_RUNS = 2;
/** Expected first-try success in the middle of the kid's own step (0.8), as a logit, and the slope per step */
export const RATING_BASE_LOGIT = 1.4;
export const RATING_SLOPE = 1.5;
export const ACCURACY_KEEP = 0.7;
export const PARENT_MISTAKES_PER_TOPIC = 5;

export const ACTIVITY_DAYS = 14;
export const WEAK_MASTERY = 0.6;
export const WEAK_SKILLS_MAX = 5;

export const LEVEL_NOT_FOUND = 'LEVEL_NOT_FOUND';
export const LEVEL_LOCKED = 'LEVEL_LOCKED';
export const RUN_NOT_FOUND = 'RUN_NOT_FOUND';
export const ITEM_DONE = 'ITEM_DONE';
export const ITEM_NOT_FOUND = 'ITEM_NOT_FOUND';
export const NOTHING_TO_PRACTICE = 'NOTHING_TO_PRACTICE';
export const TOPIC_NOT_FOUND = 'TOPIC_NOT_FOUND';
export const TOPIC_LOCKED = 'TOPIC_LOCKED';
export const RUN_BUSY = 'RUN_BUSY';
