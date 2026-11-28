import type { Prompt } from '../exercises/frames.ts';
import { hashString } from './rng.ts';

/** Fields that change between two instances of the same exercise without changing the task. */
const NOISE = new Set(['id', 'x', 'y', 'rotation', 'scale', 'choices']);

function hasIds(items: readonly unknown[]): boolean {
  return (
    items.length > 0 &&
    items.every(
      (item) => item !== null && typeof item === 'object' && 'id' in item,
    )
  );
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonical);
    return hasIds(value)
      ? items.map((item) => JSON.stringify(item)).sort()
      : items;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NOISE.has(key))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/**
 * What the kid sees as "the same exercise": the type, the spoken prompt and
 * the payload without random ids, positions, shuffled tile order or
 * distractor choices. Two instances with the same key ask the same question.
 */
export function exerciseKey(exercise: {
  readonly type: string;
  readonly prompt: Prompt;
  readonly payload: unknown;
}): string {
  const text = [
    exercise.type,
    exercise.prompt.speak.join('␟'),
    JSON.stringify(canonical(exercise.payload)),
  ].join('␞');
  const reversed = [...text].reverse().join('');
  return (
    hashString(text).toString(36).padStart(7, '0') +
    hashString(reversed).toString(36).padStart(7, '0')
  );
}
