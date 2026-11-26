import type { MapLevel, MapTrack, MapWorld } from '../learn.models';

export const ROW_HEIGHT = 124;
export const TRAIL_PADDING = 40;

export interface PlacedLevel {
  readonly level: MapLevel;
  readonly number: number;
  /** Horizontal center in % of the trail width. */
  readonly x: number;
  /** Top of the signpost in px from the top of the trail. */
  readonly y: number;
  /** The plaque points the way to the next level. */
  readonly pointsLeft: boolean;
}

/** Levels climb from the bottom of a world's band to its top along a winding trail. */
export function placeLevels(levels: readonly MapLevel[], worldIndex: number): PlacedLevel[] {
  const count = levels.length;
  const phase = worldIndex * 1.7;
  const xs = levels.map((_, index) => 50 + 26 * Math.sin(index * 1.15 + phase));
  return levels.map((level, index) => {
    const next = xs[index + 1] ?? xs[index]! + (index % 2 === 0 ? 1 : -1);
    return {
      level,
      number: index + 1,
      x: Math.round(xs[index]! * 10) / 10,
      y: (count - 1 - index) * ROW_HEIGHT + TRAIL_PADDING,
      pointsLeft: next < xs[index]!,
    };
  });
}

export function trailHeight(levelCount: number): number {
  return Math.max(1, levelCount) * ROW_HEIGHT + TRAIL_PADDING * 2;
}

/** A smooth SVG path (viewBox width 100, height in px) through the signposts' feet. */
export function trailPath(placed: readonly PlacedLevel[], height: number): string {
  const points = placed.map((item) => ({ x: item.x, y: item.y + 70 }));
  if (points.length === 0) {
    return '';
  }
  const start = { x: points[0]!.x, y: height };
  const segments = [start, ...points, { x: points[points.length - 1]!.x, y: 0 }];
  let path = `M ${start.x} ${start.y}`;
  for (let index = 1; index < segments.length; index += 1) {
    const from = segments[index - 1]!;
    const to = segments[index]!;
    const middle = (from.y + to.y) / 2;
    path += ` C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
  }
  return path;
}

/** The level the kid plays next: the first unlocked one that is not passed yet. */
export function currentLevelId(track: MapTrack | null): string | null {
  const levels = track?.worlds.flatMap((world) => world.levels) ?? [];
  return levels.find((level) => level.state === 'unlocked')?.id ?? null;
}

export function worldComplete(world: MapWorld): boolean {
  return world.state === 'passed' || world.state === 'skipped';
}
