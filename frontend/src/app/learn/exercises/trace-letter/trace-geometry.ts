/** Pure geometry for tracing: the 0–100 glyph box (y down) of content/README.md "Stroke format". */

export type TracePoint = readonly [number, number];
export type TraceStroke = readonly TracePoint[];

/** Limits of the answer schema (`StrokesAnswerSchema`). */
export const MAX_STROKES = 6;
export const MAX_POINTS = 200;
export const COORD_MIN = -20;
export const COORD_MAX = 120;

/** The drawing area around the box, with room for start dots and numbers. */
export const VIEW_MIN = -6;
export const VIEW_SIZE = 112;

/** New points closer than this (box units) to the last one are skipped while drawing. */
export const MIN_STEP = 0.8;
/** Strokes shorter than this are dots (i, j, umlauts). */
export const DOT_LENGTH = 8;

export const TRACE_STROKE_MIN_MS = 650;
export const TRACE_STROKE_MAX_MS = 1600;
export const TRACE_MS_PER_UNIT = 14;
export const TRACE_GAP_MS = 350;

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function strokeLength(points: TraceStroke): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return total;
}

/** A client position (CSS pixels) inside an element showing the view box, in box units. */
export function toBox(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): TracePoint {
  const size = Math.min(rect.width, rect.height) || 1;
  const offsetX = (rect.width - size) / 2;
  const offsetY = (rect.height - size) / 2;
  const x = VIEW_MIN + ((clientX - rect.left - offsetX) / size) * VIEW_SIZE;
  const y = VIEW_MIN + ((clientY - rect.top - offsetY) / size) * VIEW_SIZE;
  return [round(clamp(x, COORD_MIN, COORD_MAX)), round(clamp(y, COORD_MIN, COORD_MAX))];
}

/** A box position as a client position (the inverse of `toBox`), for tests and the e2e. */
export function toClient(
  point: TracePoint,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): { x: number; y: number } {
  const size = Math.min(rect.width, rect.height);
  return {
    x: rect.left + (rect.width - size) / 2 + ((point[0] - VIEW_MIN) / VIEW_SIZE) * size,
    y: rect.top + (rect.height - size) / 2 + ((point[1] - VIEW_MIN) / VIEW_SIZE) * size,
  };
}

/** Adds a point unless it is (almost) where the stroke already is. */
export function appendPoint(stroke: TraceStroke, point: TracePoint): TraceStroke {
  const last = stroke.at(-1);
  if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP) {
    return stroke;
  }
  return [...stroke, point];
}

/** `count` points evenly spaced by arc length (first and last point kept). */
export function resample(points: TraceStroke, count: number): TracePoint[] {
  const total = strokeLength(points);
  if (points.length < 2 || total === 0 || count < 2) {
    return points.slice(0, Math.max(1, Math.min(count, points.length)));
  }
  const result: TracePoint[] = [];
  let segment = 0;
  let walked = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1);
    const segmentLength = (index: number) =>
      Math.hypot(
        points[index + 1]![0] - points[index]![0],
        points[index + 1]![1] - points[index]![1],
      );
    while (segment < points.length - 2 && walked + segmentLength(segment) < target) {
      walked += segmentLength(segment);
      segment += 1;
    }
    const length = segmentLength(segment);
    const [ax, ay] = points[segment]!;
    const [bx, by] = points[segment + 1]!;
    const t = length === 0 ? 0 : clamp((target - walked) / length, 0, 1);
    result.push([round(ax + (bx - ax) * t), round(ay + (by - ay) * t)]);
  }
  return result;
}

/** A finished stroke within the answer limits. */
export function finishStroke(stroke: TraceStroke): TracePoint[] {
  return stroke.length > MAX_POINTS ? resample(stroke, MAX_POINTS) : [...stroke];
}

/** A smooth SVG path through the points (quadratic curves through the midpoints). */
export function smoothPath(points: TraceStroke): string {
  if (points.length === 0) {
    return '';
  }
  const [x0, y0] = points[0]!;
  if (points.length === 1) {
    return `M${x0} ${y0}l0.01 0`;
  }
  if (points.length === 2) {
    return `M${x0} ${y0}L${points[1]![0]} ${points[1]![1]}`;
  }
  let d = `M${x0} ${y0}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    d += `Q${x} ${y} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`;
  }
  const [lx, ly] = points.at(-1)!;
  return `${d}L${lx} ${ly}`;
}

/** A straight polyline (model strokes are already sampled every 15 degrees). */
export function linePath(points: TraceStroke): string {
  if (points.length === 1) {
    return `M${points[0]![0]} ${points[0]![1]}l0.01 0`;
  }
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');
}

export function isDot(points: TraceStroke): boolean {
  return strokeLength(points) < DOT_LENGTH;
}

export function centroid(points: TraceStroke): TracePoint {
  const n = points.length || 1;
  return [
    round(points.reduce((sum, p) => sum + p[0], 0) / n),
    round(points.reduce((sum, p) => sum + p[1], 0) / n),
  ];
}

/** The part of a stroke from its start up to `progress` (0–1) of its length, and the tip. */
export function partialStroke(
  points: TraceStroke,
  progress: number,
): { points: TracePoint[]; tip: TracePoint } {
  const total = strokeLength(points);
  if (points.length < 2 || total === 0) {
    return { points: [...points], tip: points[0] ?? [0, 0] };
  }
  const target = total * clamp(progress, 0, 1);
  const result: TracePoint[] = [points[0]!];
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const length = Math.hypot(bx - ax, by - ay);
    if (walked + length >= target) {
      const t = length === 0 ? 0 : (target - walked) / length;
      const tip: TracePoint = [round(ax + (bx - ax) * t), round(ay + (by - ay) * t)];
      result.push(tip);
      return { points: result, tip };
    }
    walked += length;
    result.push(points[i]!);
  }
  return { points: result, tip: points.at(-1)! };
}

/** How long the model animation draws one stroke. */
export function strokeDuration(points: TraceStroke): number {
  return clamp(strokeLength(points) * TRACE_MS_PER_UNIT, TRACE_STROKE_MIN_MS, TRACE_STROKE_MAX_MS);
}

/** The whole model animation: every stroke plus a short pause before each next one. */
export function modelDuration(strokes: readonly TraceStroke[]): number {
  return strokes.reduce((sum, stroke) => sum + strokeDuration(stroke) + TRACE_GAP_MS, 0);
}

/** Where a stroke's direction arrow sits (about a third of the way) and its angle in degrees. */
export function arrowOf(points: TraceStroke): { at: TracePoint; angle: number } | null {
  if (isDot(points)) {
    return null;
  }
  const { tip } = partialStroke(points, 0.38);
  const ahead = partialStroke(points, 0.46).tip;
  const angle = (Math.atan2(ahead[1] - tip[1], ahead[0] - tip[0]) * 180) / Math.PI;
  return { at: tip, angle: round(angle) };
}

/** Where the number next to a start dot goes: behind the start, against the drawing direction. */
export function labelOf(points: TraceStroke): TracePoint {
  const start = points[0]!;
  if (isDot(points)) {
    const [cx, cy] = centroid(points);
    return [cx, round(cy - 9)];
  }
  const ahead = partialStroke(points, Math.min(1, 6 / strokeLength(points))).tip;
  const dx = ahead[0] - start[0];
  const dy = ahead[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  return [
    round(clamp(start[0] - (dx / length) * 9, VIEW_MIN + 4, VIEW_MIN + VIEW_SIZE - 4)),
    round(clamp(start[1] - (dy / length) * 9, VIEW_MIN + 4, VIEW_MIN + VIEW_SIZE - 4)),
  ];
}

/** The shortest distance from a point to any of the strokes (a stroke of one point is a dot). */
export function distanceToStrokes(point: TracePoint, strokes: readonly TraceStroke[]): number {
  const [px, py] = point;
  let best = Infinity;
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      best = Math.min(best, Math.hypot(px - stroke[0]![0], py - stroke[0]![1]));
    }
    for (let i = 1; i < stroke.length; i += 1) {
      const [ax, ay] = stroke[i - 1]!;
      const [bx, by] = stroke[i]!;
      const length = (bx - ax) ** 2 + (by - ay) ** 2;
      const t =
        length === 0 ? 0 : clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length, 0, 1);
      best = Math.min(best, Math.hypot(px - (ax + (bx - ax) * t), py - (ay + (by - ay) * t)));
    }
  }
  return best;
}
