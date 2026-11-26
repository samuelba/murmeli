const UNIT_SECONDS: Readonly<Record<string, number>> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

/**
 * Converts an env duration like `15m`, `12h` or `30d` to whole seconds
 * (at least 1).
 */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const seconds = Number(match[1]) * UNIT_SECONDS[match[2]];
  return Math.max(1, Math.ceil(seconds));
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
