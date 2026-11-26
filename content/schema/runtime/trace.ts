import { GLYPHS, strokeLength } from '../glyphs.ts';
import type { HintKey } from './hints.ts';

export interface TraceOptions {
  readonly tolerance: number;
  readonly strictOrder: boolean;
  readonly strictDirection: boolean;
}

export interface TraceResult {
  readonly correct: boolean;
  readonly hint?: HintKey;
  readonly distances: readonly number[];
}

export const TRACE_SAMPLES = 32;
export const TRACE_THRESHOLD = 10;
const DOT_LENGTH = 8;
const MAX_DOT_EXTENT = 20;

type Point = readonly [number, number];

export function resample(
  points: readonly Point[],
  count = TRACE_SAMPLES,
): Point[] {
  const total = strokeLength(points);
  if (points.length < 2 || total === 0) {
    return Array.from({ length: count }, () => points[0]!);
  }
  const result: Point[] = [];
  let segment = 0;
  let walked = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1);
    while (segment < points.length - 2) {
      const [ax, ay] = points[segment]!;
      const [bx, by] = points[segment + 1]!;
      const length = Math.hypot(bx - ax, by - ay);
      if (walked + length >= target) {
        break;
      }
      walked += length;
      segment += 1;
    }
    const [ax, ay] = points[segment]!;
    const [bx, by] = points[segment + 1]!;
    const length = Math.hypot(bx - ax, by - ay);
    const t =
      length === 0 ? 0 : Math.min(Math.max((target - walked) / length, 0), 1);
    result.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return result;
}

function meanDistance(a: readonly Point[], b: readonly Point[]): number {
  return (
    a.reduce(
      (sum, [x, y], i) => sum + Math.hypot(x - b[i]![0], y - b[i]![1]),
      0,
    ) / a.length
  );
}

function centroid(points: readonly Point[]): Point {
  const n = points.length;
  return [
    points.reduce((s, p) => s + p[0], 0) / n,
    points.reduce((s, p) => s + p[1], 0) / n,
  ];
}

interface Pair {
  readonly forward: number;
  readonly backward: number;
}

function comparePair(model: readonly Point[], drawn: readonly Point[]): Pair {
  if (strokeLength(model) < DOT_LENGTH) {
    const [mx, my] = centroid(model);
    const [dx, dy] = centroid(drawn);
    const xs = drawn.map(([x]) => x);
    const ys = drawn.map(([, y]) => y);
    const extent = Math.hypot(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
    const tooLong = extent > MAX_DOT_EXTENT ? 100 : 0;
    const distance = Math.hypot(mx - dx, my - dy) + tooLong;
    return { forward: distance, backward: distance };
  }
  const m = resample(model);
  const d = resample(drawn);
  return {
    forward: meanDistance(m, d),
    backward: meanDistance(m, [...d].reverse()),
  };
}

function permutations(n: number): number[][] {
  if (n <= 1) {
    return [Array.from({ length: n }, (_, i) => i)];
  }
  return permutations(n - 1).flatMap((perm) =>
    Array.from({ length: n }, (_, at) => [
      ...perm.slice(0, at),
      n - 1,
      ...perm.slice(at),
    ]),
  );
}

export function scoreTrace(
  glyph: string,
  drawn: readonly (readonly Point[])[],
  options: TraceOptions,
): TraceResult {
  const model = GLYPHS[glyph]?.strokes.map((stroke) => stroke.points);
  if (model === undefined) {
    throw new RangeError(`no stroke data for "${glyph}"`);
  }
  if (drawn.length !== model.length) {
    return { correct: false, hint: 'stroke-count', distances: [] };
  }
  const threshold = TRACE_THRESHOLD * options.tolerance;
  const pairs = model.map((stroke) =>
    drawn.map((own) => comparePair(stroke, own)),
  );
  const best = (i: number, j: number) =>
    Math.min(pairs[i]![j]!.forward, pairs[i]![j]!.backward);
  const cost = (perm: readonly number[]) =>
    perm.reduce((sum, j, i) => sum + best(i, j), 0);
  const identity = model.map((_, i) => i);
  const fits = (perm: readonly number[]) =>
    perm.every((j, i) => best(i, j) <= threshold);
  const order = options.strictOrder
    ? identity
    : permutations(model.length).reduce((a, b) => (cost(b) < cost(a) ? b : a));
  const distances = order.map((j, i) => best(i, j));
  if (!fits(order)) {
    const otherOrder =
      options.strictOrder && permutations(model.length).some(fits);
    return {
      correct: false,
      hint: otherOrder ? 'stroke-order' : 'trace-slowly',
      distances,
    };
  }
  const reversed = order.some((j, i) => pairs[i]![j]!.forward > threshold);
  if (options.strictDirection && reversed) {
    return { correct: false, hint: 'start-at-dot', distances };
  }
  return { correct: true, distances };
}
