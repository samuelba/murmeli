import { TRACE_GAP_MS, TraceStroke, strokeDuration } from './trace-geometry';

export interface TraceFrame {
  /** Strokes already complete. */
  readonly done: number;
  /** The stroke being drawn and how far (0–1), or null between strokes and at the end. */
  readonly current: { readonly index: number; readonly progress: number } | null;
  readonly finished: boolean;
}

/**
 * Where the model animation is after `elapsed` ms. With `stepwise` (reduced motion) each stroke
 * appears at once, in order, so the order still shows without movement.
 */
export function frameAt(
  strokes: readonly TraceStroke[],
  elapsed: number,
  stepwise = false,
): TraceFrame {
  let start = 0;
  for (const [index, stroke] of strokes.entries()) {
    const duration = strokeDuration(stroke);
    if (elapsed < start + duration) {
      const progress = stepwise ? 1 : Math.max(0, (elapsed - start) / duration);
      return { done: index, current: { index, progress }, finished: false };
    }
    if (elapsed < start + duration + TRACE_GAP_MS) {
      return { done: index + 1, current: null, finished: false };
    }
    start += duration + TRACE_GAP_MS;
  }
  return { done: strokes.length, current: null, finished: true };
}
