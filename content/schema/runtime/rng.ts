export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  bool(probability?: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  id(): string;
}

const UINT32 = 0x1_0000_0000;

function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mixSeed(...parts: readonly number[]): number {
  return parts.reduce<number>(
    (acc, part) =>
      fmix32(acc ^ Math.imul((part >>> 0) + 0x9e3779b9, 0x27d4eb2d)),
    0x6a09e667,
  );
}

export function itemSeed(
  runSeed: number,
  levelId: string,
  index: number,
): number {
  return mixSeed(runSeed, hashString(levelId), index);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * UINT32) >>> 0;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
  const int = (min: number, max: number): number => {
    if (max < min) {
      throw new RangeError(`empty range ${min}..${max}`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };
  return {
    next,
    int,
    bool: (probability = 0.5) => next() < probability,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new RangeError('cannot pick from an empty list');
      }
      return items[int(0, items.length - 1)]!;
    },
    shuffle,
    sample: <T>(items: readonly T[], count: number): T[] => {
      if (count > items.length) {
        throw new RangeError(`cannot sample ${count} of ${items.length}`);
      }
      return shuffle(items).slice(0, count);
    },
    weighted: <T>(items: readonly T[], weight: (item: T) => number): T => {
      const total = items.reduce(
        (sum, item) => sum + Math.max(weight(item), 0),
        0,
      );
      if (items.length === 0 || total <= 0) {
        throw new RangeError('weighted pick needs a positive total weight');
      }
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(weight(item), 0);
        if (roll < 0) {
          return item;
        }
      }
      return items[items.length - 1]!;
    },
    id: () =>
      (
        Math.floor(next() * UINT32).toString(36) +
        Math.floor(next() * UINT32).toString(36)
      )
        .padStart(10, '0')
        .slice(-10),
  };
}
