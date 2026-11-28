import type {
  PracticeLadder,
  PracticeTopicState,
  ProgressState,
  World,
} from '@murmeli/content';
import {
  ACCURACY_KEEP,
  PLACEMENT_RUNS,
  PRACTICE_AHEAD_STEPS,
  RATING_BASE_LOGIT,
  RATING_K,
  RATING_K_PLACEMENT,
  RATING_SLOPE,
} from '../learning.constants';
import type { ProgressStates } from '../progress/unlock';

/** How far a kid may practice a topic right now. Steps are 0-based. */
export interface TopicReach {
  readonly state: PracticeTopicState;
  /** Highest reachable step, -1 when locked */
  readonly maxStep: number;
  /** Highest step whose level the trail passed (or placed), -1 for none */
  readonly pathStep: number;
}

/** What a practice run needs from the stored topic progress. */
export interface TopicRecord {
  readonly rating: number;
  /** The `pathStep` when the rating was last saved */
  readonly pathStep: number;
  readonly runs: number;
}

export interface ScoredItem {
  /** The step the item came from */
  readonly tier: number;
  /** 1 when right on the first try, else 0 */
  readonly score: number;
}

/** Just below the next step: the rating never reaches a step beyond reach. */
const STEP_TOP = 0.99;
/** A new start sits in the middle of its step, so one shaky run does not drop it. */
const STEP_MIDDLE = 0.5;

const isOpen = (state: ProgressState | undefined) =>
  state !== undefined && state !== 'locked';

const isDone = (state: ProgressState | undefined) =>
  state === 'passed' || state === 'skipped';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Locked worlds whose required worlds are all open: the next stops on the trail. */
export function worldsAhead(
  worlds: readonly World[],
  states: ProgressStates,
): ReadonlySet<string> {
  return new Set(
    worlds
      .filter(
        (world) =>
          states.worlds.get(world.id) === 'locked' &&
          world.requires.every((id) => isOpen(states.worlds.get(id))),
      )
      .map((world) => world.id),
  );
}

/**
 * A topic is open once the trail opened one of its levels, and reaches up to
 * `aheadSteps` further steps in open worlds or the worlds just ahead. A topic
 * whose first step sits in such a world can already be tried (`ahead`).
 */
export function topicReach(
  ladder: PracticeLadder,
  states: ProgressStates,
  ahead: ReadonlySet<string>,
  aheadSteps: number = PRACTICE_AHEAD_STEPS,
): TopicReach {
  let openStep = -1;
  let pathStep = -1;
  for (const step of ladder.steps) {
    const state = states.levels.get(step.level.id);
    if (isOpen(state)) {
      openStep = step.index;
    }
    if (isDone(state)) {
      pathStep = step.index;
    }
  }
  let maxStep = openStep;
  for (
    let index = openStep + 1;
    index <= openStep + aheadSteps && index < ladder.steps.length;
    index += 1
  ) {
    const worldId = ladder.steps[index].worldId;
    if (!isOpen(states.worlds.get(worldId)) && !ahead.has(worldId)) {
      break;
    }
    maxStep = index;
  }
  if (openStep >= 0) {
    return { state: 'open', maxStep, pathStep };
  }
  return maxStep >= 0
    ? { state: 'ahead', maxStep, pathStep }
    : { state: 'locked', maxStep: -1, pathStep };
}

/**
 * The rating a run starts from. A new topic starts at the highest step the
 * trail passed (in its middle). Passing more of the trail later lifts
 * the rating to it; a kid who struggles can still drop below it until the
 * trail moves again.
 */
export function startRating(
  record: Pick<TopicRecord, 'rating' | 'pathStep'> | undefined,
  reach: TopicReach,
): number {
  const fromTrail = Math.max(0, reach.pathStep) + STEP_MIDDLE;
  const rating =
    record === undefined
      ? fromTrail
      : reach.pathStep > record.pathStep
        ? Math.max(record.rating, fromTrail)
        : record.rating;
  return clamp(rating, 0, Math.max(0, reach.maxStep) + STEP_TOP);
}

export function stepOf(rating: number, maxStep: number): number {
  return clamp(Math.floor(rating), 0, Math.max(0, maxStep));
}

/** The 1-based step shown to kids and parents. */
export function levelOf(rating: number, reach: TopicReach): number {
  return reach.state === 'locked' ? 0 : stepOf(rating, reach.maxStep) + 1;
}

/**
 * The step of each new item in a run, in order: one warm-up from the step
 * below, then the kid's step with 1–3 items from the next step spread
 * towards the end. The closer the rating is to the next step, the more of
 * them.
 */
export function planSteps(
  rating: number,
  maxStep: number,
  count: number,
): number[] {
  if (count <= 0) {
    return [];
  }
  const step = stepOf(rating, maxStep);
  const fraction = clamp(rating - step, 0, STEP_TOP);
  const warmUp = step > 0 && count >= 4 ? 1 : 0;
  const rest = count - warmUp;
  const stretch =
    step < maxStep ? Math.min(1 + Math.floor(fraction * 3), rest - 1) : 0;
  const stretchAt = new Set(
    Array.from({ length: stretch }, (_, i) =>
      Math.round(((i + 1) * rest) / (stretch + 1)),
    ),
  );
  return [
    ...Array<number>(warmUp).fill(step - 1),
    ...Array.from({ length: rest }, (_, i) =>
      stretchAt.has(i) ? step + 1 : step,
    ),
  ];
}

/** Spreads `extra` evenly between `main`, never first. */
export function interleave<T>(main: readonly T[], extra: readonly T[]): T[] {
  const total = main.length + extra.length;
  const positions = new Set(
    extra.map((_, i) =>
      Math.min(
        total - 1,
        1 + Math.floor((i * Math.max(1, total - 1)) / extra.length),
      ),
    ),
  );
  const result: T[] = [];
  let m = 0;
  let e = 0;
  for (let index = 0; index < total; index += 1) {
    const takeExtra =
      e < extra.length && (positions.has(index) || m >= main.length);
    result.push(takeExtra ? extra[e++] : main[m++]);
  }
  return result;
}

/** Chance of a first-try answer at `tier` for a kid at `rating`: 0.8 in the middle of the own step. */
export function expectedScore(rating: number, tier: number): number {
  const distance = rating - (tier + STEP_MIDDLE);
  return 1 / (1 + Math.exp(-(RATING_BASE_LOGIT + RATING_SLOPE * distance)));
}

/**
 * Elo-style update: every answer moves the rating by how much better or
 * worse it went than expected. From the middle of a step, ten of ten right
 * is the next step, eight or seven of ten keep it, six or fewer drop it. The
 * first runs move faster to place the kid quickly.
 */
export function nextRating(
  rating: number,
  items: readonly ScoredItem[],
  runs: number,
  maxStep: number,
): number {
  const k = runs < PLACEMENT_RUNS ? RATING_K_PLACEMENT : RATING_K;
  const surprise = items.reduce(
    (sum, item) => sum + item.score - expectedScore(rating, item.tier),
    0,
  );
  return clamp(rating + k * surprise, 0, Math.max(0, maxStep) + STEP_TOP);
}

export function nextAccuracy(
  previous: number | undefined,
  firstTry: number,
  items: number,
): number {
  if (items === 0) {
    return previous ?? 0;
  }
  const ratio = firstTry / items;
  return previous === undefined
    ? ratio
    : ACCURACY_KEEP * previous + (1 - ACCURACY_KEEP) * ratio;
}

export interface MixCandidate {
  readonly dueReviews: number;
  readonly lastPracticedAt: Date | null;
  /** First-try accuracy, undefined when never practiced */
  readonly accuracy: number | undefined;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * "Murmeli wählt": due mistakes first, then topics not practiced for a
 * while, weak ones, and ones the kid knows from the trail but never
 * practiced. `jitter` (0–1 per topic) keeps the mix from always being the
 * same.
 */
export function mixPriority(
  candidate: MixCandidate,
  now: Date,
  jitter: number,
): number {
  const reviews = 3 * Math.min(candidate.dueReviews, 3);
  if (candidate.accuracy === undefined || candidate.lastPracticedAt === null) {
    return reviews + 1 + 0.75 * jitter;
  }
  const days = (now.getTime() - candidate.lastPracticedAt.getTime()) / DAY_MS;
  return (
    reviews +
    2 * clamp(days / 7, 0, 1) +
    2 * (1 - candidate.accuracy) +
    0.75 * jitter
  );
}
