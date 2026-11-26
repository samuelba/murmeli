import {
  BOX_RESET_SCORE,
  BOX_UP_SCORE,
  LEITNER_INTERVAL_DAYS,
  LEITNER_MAX_BOX,
  MASTERY_KEEP,
  MASTERY_RUN,
} from '../learning.constants';

const DAY_MS = 24 * 3600 * 1000;

export interface MasteryValue {
  readonly mastery: number;
  readonly box: number;
}

export interface MasteryUpdate extends MasteryValue {
  readonly nextReviewAt: Date;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function nextBox(box: number, score: number): number {
  if (score >= BOX_UP_SCORE) {
    return Math.min(LEITNER_MAX_BOX, box + 1);
  }
  return score < BOX_RESET_SCORE ? 1 : box;
}

export function reviewAt(box: number, now: Date): Date {
  return new Date(now.getTime() + LEITNER_INTERVAL_DAYS[box - 1] * DAY_MS);
}

/**
 * Contract §3.6: mastery is an EWMA (0.7 · previous + 0.3 · run score); the
 * first run seeds it with its score. Spacing uses Leitner boxes 1–5 with
 * 1, 2, 4, 8 and 16 days; a new skill starts in box 1.
 */
export function nextMastery(
  previous: MasteryValue | undefined,
  runScore: number,
  now: Date,
): MasteryUpdate {
  const score = clamp01(runScore);
  const mastery = previous
    ? clamp01(MASTERY_KEEP * clamp01(previous.mastery) + MASTERY_RUN * score)
    : score;
  const startBox = previous
    ? Math.min(LEITNER_MAX_BOX, Math.max(1, Math.round(previous.box)))
    : 1;
  const box = nextBox(startBox, score);
  return { mastery, box, nextReviewAt: reviewAt(box, now) };
}
