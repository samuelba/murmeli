import type { Locale } from './locale.ts';

export type ClockStep = 'hour' | 'half' | 'quarter' | 'five';

export interface ClockTime {
  readonly hour: number;
  readonly minute: number;
}

const MINUTES: Readonly<Record<ClockStep, readonly number[]>> = {
  hour: [0],
  half: [0, 30],
  quarter: [0, 15, 30, 45],
  five: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
};

const HOURS: Readonly<Record<Locale, readonly string[]>> = {
  'de-CH': [
    '',
    'eins',
    'zwei',
    'drei',
    'vier',
    'fünf',
    'sechs',
    'sieben',
    'acht',
    'neun',
    'zehn',
    'elf',
    'zwölf',
  ],
  'en-US': [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ],
};

export function clockTimes(step: ClockStep): ClockTime[] {
  return Array.from({ length: 12 }, (_, i) => i + 1).flatMap((hour) =>
    MINUTES[step].map((minute) => ({ hour, minute })),
  );
}

export function digitalTime({ hour, minute }: ClockTime): string {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function german(hour: number, minute: number): string {
  const h = HOURS['de-CH'][hour]!;
  const next = HOURS['de-CH'][(hour % 12) + 1]!;
  switch (minute) {
    case 0:
      return hour === 1 ? 'ein Uhr' : `${h} Uhr`;
    case 15:
      return `Viertel nach ${h}`;
    case 25:
      return `fünf vor halb ${next}`;
    case 30:
      return `halb ${next}`;
    case 35:
      return `fünf nach halb ${next}`;
    case 45:
      return `Viertel vor ${next}`;
    default: {
      const words: Readonly<Record<number, string>> = {
        5: 'fünf',
        10: 'zehn',
        20: 'zwanzig',
      };
      return minute < 30
        ? `${words[minute]} nach ${h}`
        : `${words[60 - minute]} vor ${next}`;
    }
  }
}

function english(hour: number, minute: number): string {
  const h = HOURS['en-US'][hour]!;
  const next = HOURS['en-US'][(hour % 12) + 1]!;
  const words: Readonly<Record<number, string>> = {
    5: 'five',
    10: 'ten',
    20: 'twenty',
    25: 'twenty-five',
  };
  if (minute === 0) {
    return `${h} o'clock`;
  }
  if (minute === 15) {
    return `quarter past ${h}`;
  }
  if (minute === 30) {
    return `half past ${h}`;
  }
  if (minute === 45) {
    return `quarter to ${next}`;
  }
  return minute < 30
    ? `${words[minute]} past ${h}`
    : `${words[60 - minute]} to ${next}`;
}

export function timeWords({ hour, minute }: ClockTime, locale: Locale): string {
  return locale === 'de-CH' ? german(hour, minute) : english(hour, minute);
}
