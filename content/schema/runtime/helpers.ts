import { range, unique } from '../exercises/common.ts';
import type { Rng } from './rng.ts';
import type { Choice, Point, RuntimeContext } from './types.ts';

export function withIds<T extends object>(
  rng: Rng,
  items: readonly T[],
): (T & { id: string })[] {
  const used = new Set<string>();
  return items.map((item) => {
    let id = rng.id();
    while (used.has(id)) {
      id = rng.id();
    }
    used.add(id);
    return { ...item, id };
  });
}

export function numberChoices(
  rng: Rng,
  answer: number,
  count: number,
  candidates: readonly number[],
): Choice[] {
  const pool = unique(
    candidates.filter((value) => value !== answer && value >= 0),
  );
  for (let reach = 1; pool.length < count - 1; reach += 1) {
    for (const value of [answer + reach, answer - reach]) {
      if (value >= 0 && !pool.includes(value)) {
        pool.push(value);
      }
    }
  }
  const nearest = rng
    .shuffle(pool)
    .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer))
    .slice(0, 2 * (count - 1));
  const values = rng.shuffle([answer, ...rng.sample(nearest, count - 1)]);
  return withIds(
    rng,
    values.map((value) => ({ value, label: String(value) })),
  );
}

export function near(
  answer: number,
  radius: number,
  min = 0,
  max = 100,
): number[] {
  return range(Math.max(answer - radius, min), Math.min(answer + radius, max));
}

export function pickFocus<T extends string | number>(
  rng: Rng,
  candidates: readonly T[],
  ctx: RuntimeContext,
): T {
  const target = ctx.demo?.target;
  if (ctx.demo !== undefined) {
    const match = candidates.find((candidate) => candidate === target);
    return match ?? candidates[0]!;
  }
  return rng.pick(candidates);
}

export function orderFor<T>(
  rng: Rng,
  items: readonly T[],
  ctx: RuntimeContext,
): T[] {
  return ctx.demo !== undefined ? [...items] : rng.shuffle(items);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function grid(index: number, columns: number, rows: number): Point {
  return {
    x: round(((index % columns) + 0.5) / columns),
    y: round((Math.floor(index / columns) + 0.5) / rows),
  };
}

const DICE: readonly (readonly [number, number])[][] = [
  [],
  [[0.5, 0.5]],
  [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  [
    [0.25, 0.2],
    [0.75, 0.2],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.8],
    [0.75, 0.8],
  ],
];

export function layout(
  arrangement: 'line' | 'dice' | 'scattered' | 'ten-frame',
  count: number,
  rng: Rng,
): Point[] {
  if (arrangement === 'dice' && count <= 6) {
    return DICE[count]!.map(([x, y]) => ({ x, y }));
  }
  if (arrangement === 'scattered') {
    const columns = 6;
    const rows = 4;
    return rng.sample(range(0, columns * rows - 1), count).map((cell) => {
      const point = grid(cell, columns, rows);
      return {
        x: round(point.x + (rng.next() - 0.5) * (0.3 / columns)),
        y: round(point.y + (rng.next() - 0.5) * (0.3 / rows)),
      };
    });
  }
  const rows = Math.max(
    Math.ceil(count / 5),
    arrangement === 'ten-frame' ? 2 : 1,
  );
  return range(0, count - 1).map((index) => grid(index, 5, rows));
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object'
  ) {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    return (
      deepEqual(keysA, keysB) &&
      keysA.every((key) =>
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    );
  }
  return false;
}
