const DAY_MS = 24 * 3600 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, format);
  }
  return format;
}

/**
 * The calendar day (`YYYY-MM-DD`) of an instant in the given IANA time zone.
 */
export function localDay(at: Date, timeZone: string): string {
  const parts = formatter(timeZone).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * The last `count` calendar days up to and including the local day of `now`,
 * oldest first.
 */
export function recentDays(
  now: Date,
  timeZone: string,
  count: number,
): string[] {
  const [year, month, day] = localDay(now, timeZone).split('-').map(Number);
  const today = Date.UTC(year, month - 1, day);
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}
