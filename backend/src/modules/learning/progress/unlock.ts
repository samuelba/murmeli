import {
  type Grade,
  type ProgressState,
  type Stars,
  type World,
  gradeRank,
} from '@murmeli/content';

export interface LevelSnapshot {
  readonly stars: Stars;
  readonly passed: boolean;
}

export type ProgressLookup = ReadonlyMap<string, LevelSnapshot>;

export interface ProgressStates {
  readonly levels: ReadonlyMap<string, ProgressState>;
  readonly worlds: ReadonlyMap<string, ProgressState>;
}

export interface Unlocked {
  readonly levels: string[];
  readonly worlds: string[];
}

/**
 * Worlds below the kid's start class are placed: they count as completed for
 * `requires` and all their levels are open (`skipped` until passed).
 */
export function isPlaced(world: Pick<World, 'grade'>, startClass: Grade) {
  return gradeRank(world.grade) < gradeRank(startClass);
}

function isPassed(progress: ProgressLookup, levelId: string): boolean {
  return progress.get(levelId)?.passed === true;
}

function completionOf(
  worlds: readonly World[],
  startClass: Grade,
  progress: ProgressLookup,
): (worldId: string) => boolean {
  const byId = new Map(worlds.map((world) => [world.id, world]));
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();
  const completed = (worldId: string): boolean => {
    const known = memo.get(worldId);
    if (known !== undefined) {
      return known;
    }
    const world = byId.get(worldId);
    if (!world || visiting.has(worldId)) {
      return false;
    }
    visiting.add(worldId);
    const result =
      isPlaced(world, startClass) ||
      world.levels.every((level) => isPassed(progress, level.id));
    visiting.delete(worldId);
    memo.set(worldId, result);
    return result;
  };
  return completed;
}

function levelStates(
  world: World,
  placed: boolean,
  open: boolean,
  progress: ProgressLookup,
): ProgressState[] {
  return world.levels.map((level, index) => {
    if (isPassed(progress, level.id)) {
      return 'passed';
    }
    if (placed) {
      return 'skipped';
    }
    const previous = world.levels[index - 1];
    const reachable = previous === undefined || isPassed(progress, previous.id);
    return open && reachable ? 'unlocked' : 'locked';
  });
}

function worldState(
  states: readonly ProgressState[],
  placed: boolean,
  open: boolean,
): ProgressState {
  if (states.every((state) => state === 'passed')) {
    return 'passed';
  }
  if (placed) {
    return 'skipped';
  }
  return open ? 'unlocked' : 'locked';
}

/**
 * The state of every world and level, following contract §3.4: the first
 * level of a world opens once every required world is completed, the others
 * open in order. A passed level always stays passed.
 */
export function computeStates(
  worlds: readonly World[],
  startClass: Grade,
  progress: ProgressLookup,
): ProgressStates {
  const completed = completionOf(worlds, startClass, progress);
  const levels = new Map<string, ProgressState>();
  const worldStates = new Map<string, ProgressState>();
  for (const world of worlds) {
    const placed = isPlaced(world, startClass);
    const open = placed || world.requires.every((id) => completed(id));
    const states = levelStates(world, placed, open, progress);
    world.levels.forEach((level, index) => levels.set(level.id, states[index]));
    worldStates.set(world.id, worldState(states, placed, open));
  }
  return { levels, worlds: worldStates };
}

function openAll(
  states: ReadonlyMap<string, ProgressState>,
): Map<string, ProgressState> {
  return new Map(
    [...states].map(([id, state]) => [
      id,
      state === 'locked' ? 'unlocked' : state,
    ]),
  );
}

/** Testing aid behind `LEARNING_UNLOCK_ALL`: nothing stays locked. */
export function unlockAll(states: ProgressStates): ProgressStates {
  return { levels: openAll(states.levels), worlds: openAll(states.worlds) };
}

function opened(
  before: ReadonlyMap<string, ProgressState>,
  after: ReadonlyMap<string, ProgressState>,
): string[] {
  return [...after]
    .filter(([id, state]) => state !== 'locked' && before.get(id) === 'locked')
    .map(([id]) => id);
}

export function unlockedBetween(
  before: ProgressStates,
  after: ProgressStates,
): Unlocked {
  return {
    levels: opened(before.levels, after.levels),
    worlds: opened(before.worlds, after.worlds),
  };
}

export function isOpen(state: ProgressState | undefined): boolean {
  return state !== undefined && state !== 'locked';
}
