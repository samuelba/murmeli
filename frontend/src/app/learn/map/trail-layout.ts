import type { MapLevel, MapTrack, MapWorld } from '../learn.models';

export const ROW_HEIGHT = 172;
export const COLUMN_WIDTH = 150;
export const MAX_COLUMNS = 4;
/** A world climbs at least this many rows, so it reads as a hike and not a flat line. */
export const MIN_ROWS = 3;
export const TOP_PADDING = 96;
export const BOTTOM_PADDING = 40;
/** From the top of a signpost to the foot of its pole, where the trail runs. */
export const POST_FOOT = 70;
/** A signpost with its plaque, pole and stars. */
export const POST_HEIGHT = 112;
/** How far a signpost may stray up or down from its row, in px. */
export const JITTER_Y = 24;
/** How far a signpost may stray sideways, as a share of its column. */
export const JITTER_X = 0.15;

export interface PlacedLevel {
  readonly level: MapLevel;
  readonly number: number;
  /** Horizontal center in % of the trail width. */
  readonly x: number;
  /** Top of the signpost in px from the top of the trail. */
  readonly y: number;
  /** The plaque points the way to the next level. */
  readonly pointsLeft: boolean;
  /** There is more room to the left of the signpost than to its right. */
  readonly openLeft: boolean;
}

export interface WorldLayout {
  readonly levels: readonly PlacedLevel[];
  readonly height: number;
  readonly path: string;
  /** Where the trail ends at the top, in % of the trail width. */
  readonly summitX: number;
}

/** As many columns as the width allows, spread evenly over at least {@link MIN_ROWS} rows. */
export function columnsFor(width: number, levelCount: number): number {
  const count = Math.max(1, levelCount);
  const fit = Math.max(1, Math.min(MAX_COLUMNS, count, Math.floor(width / COLUMN_WIDTH)));
  const rows = Math.min(count, MIN_ROWS);
  let columns = fit;
  while (columns > 1 && Math.ceil(count / columns) < rows) {
    columns -= 1;
  }
  return columns;
}

/** A repeatable random sequence in [0, 1) per seed (FNV-1a hash into mulberry32). */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) {
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Levels climb row by row from the bottom and turn at the end of each row, like switchbacks.
 * The seed (the world id) picks the side the trail starts on and nudges every signpost a little,
 * so each world has its own trail that stays the same on every visit.
 */
export function placeLevels(
  levels: readonly MapLevel[],
  columns: number,
  seed = '',
): PlacedLevel[] {
  const rows = Math.ceil(levels.length / columns);
  const random = seededRandom(seed);
  const spread = () => random() * 2 - 1;
  const mirrored = random() < 0.5;
  const goesLeft = (row: number) => (row % 2 === 1) !== mirrored;
  const share = 100 / columns;
  const spots = levels.map((_, index) => {
    const row = Math.floor(index / columns);
    const step = index % columns;
    const column = goesLeft(row) ? columns - 1 - step : step;
    const x = (column + 0.5) * share + spread() * JITTER_X * share;
    const y = (rows - 1 - row) * ROW_HEIGHT + TOP_PADDING + JITTER_Y + spread() * JITTER_Y;
    return { row, column, x: Math.round(x * 10) / 10, y: Math.round(y) };
  });
  return levels.map((level, index) => {
    const spot = spots[index]!;
    const next = spots[index + 1];
    let pointsLeft = goesLeft(spot.row);
    if (next) {
      pointsLeft = next.column === spot.column ? goesLeft(next.row) : next.column < spot.column;
    }
    const row = spots.filter((other) => other.row === spot.row);
    const left = row.find((other) => other.column === spot.column - 1)?.x ?? 0;
    const right = row.find((other) => other.column === spot.column + 1)?.x ?? 100;
    return {
      level,
      number: index + 1,
      x: spot.x,
      y: spot.y,
      pointsLeft,
      openLeft: spot.x - left > right - spot.x,
    };
  });
}

export function trailHeight(levelCount: number, columns: number): number {
  const rows = Math.max(1, Math.ceil(levelCount / columns));
  return (rows - 1) * ROW_HEIGHT + TOP_PADDING + 2 * JITTER_Y + POST_HEIGHT + BOTTOM_PADDING;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** How far a step between two signposts sags or rises, in px. */
const BEND = 22;
/** How far a turn swings out past the end of its row, as a share of the row's last step. */
const SWING = 0.45;

/**
 * A smooth SVG path (viewBox width 100, height in px) from the bottom edge through the
 * signposts' feet up to the summit. Steps along a row sag and rise in turn, and every turn
 * swings out past the end of its row in a round hairpin.
 */
export function trailPath(placed: readonly PlacedLevel[], height: number): string {
  if (placed.length === 0) {
    return '';
  }
  const feet = placed.map((item) => ({ x: item.x, y: item.y + POST_FOOT }));
  const points: Point[] = [{ x: feet[0]!.x, y: height }];
  feet.forEach((foot, index) => {
    const previous = feet[index - 1];
    if (previous) {
      points.push(
        Math.abs(foot.y - previous.y) > ROW_HEIGHT / 2
          ? hairpin(previous, feet[index - 2], foot)
          : {
              x: (previous.x + foot.x) / 2,
              y: (previous.y + foot.y) / 2 + (index % 2 ? BEND : -BEND),
            },
      );
    }
    points.push(foot);
  });
  points.push({ x: feet.at(-1)!.x, y: TOP_PADDING / 2 });
  return smooth(points);
}

function hairpin(end: Point, before: Point | undefined, next: Point): Point {
  const step = before ? end.x - before.x : end.x - 50;
  const outward = Math.sign(step) || 1;
  const reach = Math.max(8, Math.abs(step) * SWING);
  return { x: Math.min(94, Math.max(6, end.x + outward * reach)), y: (end.y + next.y) / 2 };
}

/** A Catmull-Rom spline through the points, as cubic Bézier segments. */
function smooth(points: readonly Point[]): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  let path = `M ${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const before = points[index - 1] ?? from;
    const after = points[index + 2] ?? to;
    const c1x = round(from.x + (to.x - before.x) / 6);
    const c1y = round(from.y + (to.y - before.y) / 6);
    const c2x = round(to.x - (after.x - from.x) / 6);
    const c2y = round(to.y - (after.y - from.y) / 6);
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}

export function layoutWorld(world: MapWorld, width: number): WorldLayout {
  const columns = columnsFor(width, world.levels.length);
  const levels = placeLevels(world.levels, columns, world.id);
  const height = trailHeight(world.levels.length, columns);
  return { levels, height, path: trailPath(levels, height), summitX: levels.at(-1)?.x ?? 50 };
}

/** The level the kid plays next: the first unlocked one that is not passed yet. */
export function currentLevelId(track: MapTrack | null): string | null {
  const levels = track?.worlds.flatMap((world) => world.levels) ?? [];
  return levels.find((level) => level.state === 'unlocked')?.id ?? null;
}

/** The world the map opens on: the one with the next level, else the furthest open one. */
export function currentWorldIndex(track: MapTrack | null): number {
  const worlds = track?.worlds ?? [];
  const current = currentLevelId(track);
  const withCurrent = worlds.findIndex((world) =>
    world.levels.some((level) => level.id === current),
  );
  if (withCurrent >= 0) {
    return withCurrent;
  }
  const unlocked = worlds.findIndex((world) => world.state === 'unlocked');
  if (unlocked >= 0) {
    return unlocked;
  }
  return worlds.reduce((last, world, index) => (world.state === 'locked' ? last : index), 0);
}

export function worldComplete(world: MapWorld): boolean {
  return world.state === 'passed' || world.state === 'skipped';
}
