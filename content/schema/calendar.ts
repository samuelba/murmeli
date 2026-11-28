import type { Locale } from './locale.ts';

export type CalendarUnit = 'daytime' | 'weekday' | 'season' | 'month';
export type CalendarAsk =
  'next' | 'before' | 'missing' | 'relative' | 'scene' | 'season';
export type CalendarRelation = 'tomorrow' | 'yesterday';

/** The questions each unit can ask. */
export const CALENDAR_ASKS: Readonly<
  Record<CalendarUnit, readonly CalendarAsk[]>
> = {
  daytime: ['scene'],
  weekday: ['next', 'before', 'missing', 'relative'],
  season: ['next', 'before', 'missing', 'scene'],
  month: ['next', 'before', 'missing', 'season'],
};

/** Canonical order: the week starts on Monday, the seasons on spring. */
const NAMES: Readonly<
  Record<CalendarUnit, Readonly<Record<Locale, readonly string[]>>>
> = {
  daytime: {
    'de-CH': ['Morgen', 'Mittag', 'Abend', 'Nacht'],
    'en-US': ['morning', 'noon', 'evening', 'night'],
  },
  weekday: {
    'de-CH': [
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
      'Sonntag',
    ],
    'en-US': [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
  },
  season: {
    'de-CH': ['Frühling', 'Sommer', 'Herbst', 'Winter'],
    'en-US': ['spring', 'summer', 'fall', 'winter'],
  },
  month: {
    'de-CH': [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    'en-US': [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  },
};

const SUNDAY = 6;

export function calendarNames(
  unit: CalendarUnit,
  locale: Locale,
): readonly string[] {
  return NAMES[unit][locale];
}

export function calendarSize(unit: CalendarUnit): number {
  return NAMES[unit]['de-CH'].length;
}

/** Moves around the cycle, so the day after Sunday is Monday. */
export function calendarStep(
  unit: CalendarUnit,
  index: number,
  delta: number,
): number {
  const size = calendarSize(unit);
  return (((index + delta) % size) + size) % size;
}

/** Canonical indices in the order a kid's calendar shows them. */
export function displayOrder(unit: CalendarUnit, locale: Locale): number[] {
  const size = calendarSize(unit);
  const start = unit === 'weekday' && locale === 'en-US' ? SUNDAY : 0;
  return Array.from({ length: size }, (_, i) => (start + i) % size);
}

/** Months that clearly lie inside one season, whichever start date a class teaches. */
export function isSeasonCore(month: number): boolean {
  return month % 3 !== 2;
}

/** Meteorological seasons: March to May is spring, December to February winter. */
export function seasonOfMonth(month: number): number {
  return Math.floor(((month + 10) % 12) / 3);
}
