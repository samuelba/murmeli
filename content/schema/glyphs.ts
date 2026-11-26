export type GlyphPoint = readonly [number, number];

export interface GlyphStroke {
  readonly points: readonly GlyphPoint[];
}

export interface Glyph {
  readonly char: string;
  readonly strokes: readonly GlyphStroke[];
}

export const GLYPH_GUIDES = {
  ascender: 10,
  xHeight: 45,
  baseline: 80,
  descender: 100,
} as const;

const round = (value: number) => Math.round(value * 10) / 10;

function line(...points: (readonly [number, number])[]): GlyphPoint[] {
  return points.map(([x, y]) => [round(x), round(y)] as const);
}

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
): GlyphPoint[] {
  const steps = Math.max(Math.ceil(Math.abs(to - from) / 15), 2);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return [
      round(cx + rx * Math.cos(angle)),
      round(cy - ry * Math.sin(angle)),
    ] as const;
  });
}

function path(...parts: GlyphPoint[][]): GlyphPoint[] {
  return parts.flat().filter((point, i, all) => {
    const previous = all[i - 1];
    return (
      previous === undefined ||
      previous[0] !== point[0] ||
      previous[1] !== point[1]
    );
  });
}

const dot = (x: number, y: number): GlyphPoint[] =>
  line([x, y - 1.5], [x, y + 1.5]);
const s = (...strokes: GlyphPoint[][]): GlyphStroke[] =>
  strokes.map((points) => ({ points }));

const UPPER: Record<string, GlyphStroke[]> = {
  A: s(
    line([50, 10], [20, 80]),
    line([50, 10], [80, 80]),
    line([31, 55], [69, 55]),
  ),
  B: s(
    line([25, 10], [25, 80]),
    path(
      line([25, 10], [52, 10]),
      arc(52, 27.5, 18, 17.5, 90, -90),
      line([52, 45], [25, 45]),
    ),
    path(
      line([25, 45], [56, 45]),
      arc(56, 62.5, 19, 17.5, 90, -90),
      line([56, 80], [25, 80]),
    ),
  ),
  C: s(arc(55, 45, 30, 35, 50, 310)),
  D: s(
    line([25, 10], [25, 80]),
    path(
      line([25, 10], [42, 10]),
      arc(42, 45, 33, 35, 90, -90),
      line([42, 80], [25, 80]),
    ),
  ),
  E: s(
    line([25, 10], [25, 80]),
    line([25, 10], [70, 10]),
    line([25, 45], [62, 45]),
    line([25, 80], [70, 80]),
  ),
  F: s(
    line([25, 10], [25, 80]),
    line([25, 10], [70, 10]),
    line([25, 45], [62, 45]),
  ),
  G: s(path(arc(55, 45, 30, 35, 50, 360), line([85, 45], [60, 45]))),
  H: s(
    line([25, 10], [25, 80]),
    line([75, 10], [75, 80]),
    line([25, 45], [75, 45]),
  ),
  I: s(line([50, 10], [50, 80])),
  J: s(path(line([65, 10], [65, 60]), arc(45, 60, 20, 20, 0, -180))),
  K: s(line([25, 10], [25, 80]), line([72, 10], [27, 48], [75, 80])),
  L: s(line([25, 10], [25, 80], [70, 80])),
  M: s(line([20, 80], [20, 10], [50, 55], [80, 10], [80, 80])),
  N: s(line([25, 80], [25, 10], [75, 80], [75, 10])),
  O: s(arc(50, 45, 30, 35, 90, 450)),
  P: s(
    line([25, 10], [25, 80]),
    path(
      line([25, 10], [50, 10]),
      arc(50, 27.5, 20, 17.5, 90, -90),
      line([50, 45], [25, 45]),
    ),
  ),
  Q: s(arc(50, 45, 30, 35, 90, 450), line([55, 62], [80, 85])),
  R: s(
    line([25, 10], [25, 80]),
    path(
      line([25, 10], [50, 10]),
      arc(50, 27.5, 20, 17.5, 90, -90),
      line([50, 45], [25, 45]),
    ),
    line([45, 45], [75, 80]),
  ),
  S: s(
    path(arc(50, 27.5, 22, 17.5, 30, 270), arc(50, 62.5, 24, 17.5, 90, -150)),
  ),
  T: s(line([20, 10], [80, 10]), line([50, 10], [50, 80])),
  U: s(
    path(
      line([25, 10], [25, 55]),
      arc(50, 55, 25, 25, 180, 360),
      line([75, 55], [75, 10]),
    ),
  ),
  V: s(line([20, 10], [50, 80], [80, 10])),
  W: s(line([12, 10], [30, 80], [50, 30], [70, 80], [88, 10])),
  X: s(line([25, 10], [75, 80]), line([75, 10], [25, 80])),
  Y: s(line([25, 10], [50, 45]), line([75, 10], [50, 45], [50, 80])),
  Z: s(line([25, 10], [75, 10], [25, 80], [75, 80])),
};

const bowl = (cx = 47): GlyphPoint[] => arc(cx, 62.5, 20, 17.5, 30, 390);

const LOWER: Record<string, GlyphStroke[]> = {
  a: s(path(bowl(), line([64.3, 53.8], [67, 80]))),
  b: s(line([28, 10], [28, 80]), arc(48, 62.5, 20, 17.5, 180, -180)),
  c: s(arc(50, 62.5, 20, 17.5, 45, 315)),
  d: s(bowl(), line([67, 10], [67, 80])),
  e: s(path(line([30, 62.5], [70, 62.5]), arc(50, 62.5, 20, 17.5, 0, 315))),
  f: s(
    path(arc(60, 22, 12, 12, 30, 180), line([48, 22], [48, 80])),
    line([35, 45], [62, 45]),
  ),
  g: s(bowl(), path(line([67, 45], [67, 88]), arc(50, 88, 17, 10, 0, -180))),
  h: s(
    line([28, 10], [28, 80]),
    path(arc(48, 62.5, 20, 17.5, 180, 0), line([68, 62.5], [68, 80])),
  ),
  i: s(line([50, 45], [50, 80]), dot(50, 30)),
  j: s(
    path(line([55, 45], [55, 88]), arc(40, 88, 15, 10, 0, -180)),
    dot(55, 30),
  ),
  k: s(line([28, 10], [28, 80]), line([65, 45], [30, 65], [68, 80])),
  l: s(line([50, 10], [50, 80])),
  m: s(
    line([20, 45], [20, 80]),
    path(arc(32, 57, 12, 12, 180, 0), line([44, 57], [44, 80])),
    path(arc(56, 57, 12, 12, 180, 0), line([68, 57], [68, 80])),
  ),
  n: s(
    line([28, 45], [28, 80]),
    path(arc(48, 62.5, 20, 17.5, 180, 0), line([68, 62.5], [68, 80])),
  ),
  o: s(arc(50, 62.5, 20, 17.5, 90, 450)),
  p: s(line([28, 45], [28, 100]), arc(48, 62.5, 20, 17.5, 180, -180)),
  q: s(bowl(), line([67, 45], [67, 100])),
  r: s(line([32, 45], [32, 80]), arc(48, 59, 16, 12, 180, 45)),
  s: s(
    path(arc(50, 53.75, 15, 8.75, 30, 270), arc(50, 71.25, 16, 8.75, 90, -150)),
  ),
  t: s(line([45, 20], [45, 80]), line([30, 45], [62, 45])),
  u: s(
    path(
      line([30, 45], [30, 63]),
      arc(48, 63, 18, 17, 180, 360),
      line([66, 63], [66, 45], [66, 80]),
    ),
  ),
  v: s(line([25, 45], [50, 80], [75, 45])),
  w: s(line([15, 45], [32, 80], [50, 55], [68, 80], [85, 45])),
  x: s(line([28, 45], [72, 80]), line([72, 45], [28, 80])),
  y: s(line([28, 45], [50, 80]), line([72, 45], [38, 100])),
  z: s(line([28, 45], [72, 45], [28, 80], [72, 80])),
};

const DIGITS: Record<string, GlyphStroke[]> = {
  '0': s(arc(50, 45, 22, 35, 90, 450)),
  '1': s(line([35, 25], [55, 10], [55, 80])),
  '2': s(
    path(arc(50, 30, 20, 20, 160, -20), line([68.8, 36.8], [28, 80], [75, 80])),
  ),
  '3': s(
    path(arc(48, 27.5, 20, 17.5, 150, -90), arc(48, 62.5, 22, 17.5, 90, -150)),
  ),
  '4': s(line([60, 10], [25, 58], [78, 58]), line([62, 35], [62, 80])),
  '5': s(
    path(line([32, 10], [30, 42]), arc(50, 60, 22, 20, 150, -150)),
    line([32, 10], [70, 10]),
  ),
  '6': s(path(arc(52, 40, 26, 30, 70, 180), arc(50, 62, 24, 18, 180, 540))),
  '7': s(line([25, 10], [75, 10], [40, 80])),
  '8': s(
    path(
      arc(50, 27.5, 18, 17.5, 30, 270),
      arc(50, 62.5, 22, 17.5, 90, -270),
      arc(50, 27.5, 18, 17.5, 270, 390),
    ),
  ),
  '9': s(path(arc(50, 30, 20, 20, 10, 370), line([69.7, 26.5], [66, 80]))),
};

const UMLAUTS: Record<string, [string, number]> = {
  Ä: ['A', 2],
  Ö: ['O', 2],
  Ü: ['U', 2],
  ä: ['a', 30],
  ö: ['o', 30],
  ü: ['u', 30],
};

const ALL: Record<string, GlyphStroke[]> = { ...UPPER, ...LOWER, ...DIGITS };
for (const [char, [base, y]] of Object.entries(UMLAUTS)) {
  ALL[char] = [...ALL[base]!, ...s(dot(38, y + 1.5), dot(62, y + 1.5))];
}

export const GLYPHS: Readonly<Record<string, Glyph>> = Object.fromEntries(
  Object.entries(ALL).map(([char, strokes]) => [char, { char, strokes }]),
);

export const GLYPH_CHARS = Object.keys(GLYPHS);

export function strokeLength(points: readonly GlyphPoint[]): number {
  return points.slice(1).reduce((sum, [x, y], i) => {
    const [px, py] = points[i]!;
    return sum + Math.hypot(x - px, y - py);
  }, 0);
}
