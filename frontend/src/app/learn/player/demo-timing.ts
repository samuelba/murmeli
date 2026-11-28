import type { AnyAnswer, DemoAction } from '../learn.models';
import { fiveMinuteSteps } from '../exercises/clock/clock-math';
import { modelDuration } from '../exercises/trace-letter/trace-geometry';
import type { TraceStroke } from '../exercises/trace-letter/trace-geometry';

export const DEMO_COUNT_MS = 700;
/** One object onto a plate (division-share "count along"). */
export const SHARE_STEP_MS = 320;
/** One coin into the tray ("placeCoins"). */
export const COIN_STEP_MS = 650;
/** One group of the times-table dots ("hop"). */
export const HOP_STEP_MS = 650;

interface LoosePayload {
  objects?: unknown[];
  cells?: boolean[];
  items?: unknown[];
  left?: unknown[];
  right?: unknown[];
  total?: number;
  a?: number | null;
  strokes?: TraceStroke[];
  minute?: number;
}

function countOf(type: string, payload: LoosePayload): number {
  if (type === 'clock') {
    return Math.max(1, fiveMinuteSteps(payload.minute ?? 0));
  }
  if (type === 'money-chf') {
    return (
      (payload.items?.length ?? 0) + (payload.left?.length ?? 0) + (payload.right?.length ?? 0) || 5
    );
  }
  return payload.objects?.length ?? payload.cells?.filter(Boolean).length ?? 5;
}

/** Extra time a demo step needs for its animation, on top of what Murmeli says. */
export function cueDuration(
  type: string,
  action: DemoAction,
  payload: unknown,
  answer: AnyAnswer | null,
): number {
  const loose = (payload ?? {}) as LoosePayload;
  if (action.countAlong) {
    return type === 'division-share'
      ? (loose.total ?? 5) * SHARE_STEP_MS
      : countOf(type, loose) * DEMO_COUNT_MS;
  }
  if (action.hop && type === 'times-table') {
    return (loose.a ?? loose.items?.length ?? 3) * HOP_STEP_MS;
  }
  if (action.trace) {
    return modelDuration(loose.strokes ?? []);
  }
  if (action.placeCoins) {
    const coins = answer && 'coins' in answer ? answer.coins.length : 3;
    return coins * COIN_STEP_MS;
  }
  return 0;
}
