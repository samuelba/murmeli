import { z } from 'zod';
import { clockTimes, timeWords } from '../clock.ts';
import { currencyFor, denominationsFor } from '../money.ts';
import type { Currency, MoneyGroup } from '../money.ts';
import {
  answerMode,
  choices,
  int,
  issueIf,
  pictureList,
  pictureNeeds,
  range,
  unique,
} from './common.ts';
import { defineExerciseType } from './types.ts';
import type { FrameUse } from './types.ts';

export const TimesTableParamsSchema = z.strictObject({
  rows: z.array(int(1, 10)).min(1),
  mode: z.enum(['product', 'missing-factor', 'row']).default('product'),
  minFactor: int(0, 10).default(1),
  maxFactor: int(1, 10).default(10),
  commute: z.boolean().default(true),
  answerMode: answerMode.default('keypad'),
  choices: choices().default(3),
});
export type TimesTableParams = z.output<typeof TimesTableParamsSchema>;

export interface TimesProblem {
  readonly a: number;
  readonly b: number;
  readonly product: number;
}

export function enumerateTimes(p: TimesTableParams): TimesProblem[] {
  const factors = range(p.minFactor, p.maxFactor);
  const problems = unique(p.rows).flatMap((row) =>
    factors.flatMap((factor) => {
      const own = { a: factor, b: row, product: row * factor };
      return p.commute && factor !== row
        ? [own, { a: row, b: factor, product: own.product }]
        : [own];
    }),
  );
  return problems;
}

export const timesTable = defineExerciseType({
  id: 'times-table',
  domain: 'math',
  description:
    'Einmaleins: multiply, find the missing factor, or continue a times-table row.',
  paramsSchema: TimesTableParamsSchema,
  frames: {
    product: {
      speak: {
        'de-CH': 'Wie viel ist {number:a} mal {number:b}?',
        'en-US': 'What is {number:a} times {number:b}?',
      },
    },
    'missing-factor': {
      speak: {
        'de-CH': '{number:a} mal wie viel gibt {number:c}?',
        'en-US': '{number:a} times what makes {number:c}?',
      },
    },
    row: {
      speak: {
        'de-CH': 'Wie geht die Reihe weiter?',
        'en-US': 'What comes next in the row?',
      },
    },
  },
  requirements: () => [],
  issues: (p) => [
    ...issueIf(
      p.minFactor > p.maxFactor,
      ['minFactor'],
      'minFactor must not exceed maxFactor',
    ),
    ...issueIf(
      p.mode === 'row' && p.maxFactor - p.minFactor < 3,
      ['maxFactor'],
      'a row needs at least 4 factors',
    ),
    ...issueIf(
      p.mode === 'missing-factor' && p.minFactor === 0,
      ['minFactor'],
      'a missing factor cannot be found when a product is 0',
    ),
  ],
  frameUses: (p): FrameUse[] => {
    if (p.mode === 'row') {
      return [{ frame: 'row', slots: {} }];
    }
    const problems = enumerateTimes(p);
    return p.mode === 'product'
      ? [
          {
            frame: 'product',
            slots: {
              a: unique(problems.map((x) => x.a)),
              b: unique(problems.map((x) => x.b)),
            },
          },
        ]
      : [
          {
            frame: 'missing-factor',
            slots: {
              a: unique(problems.map((x) => x.a)),
              c: unique(problems.map((x) => x.product)),
            },
          },
        ];
  },
});

export const DivisionShareParamsSchema = z.strictObject({
  divisors: z.array(int(2, 10)).min(1),
  minQuotient: int(1, 10).default(1),
  maxQuotient: int(1, 10).default(5),
  objects: pictureList,
  answerMode: answerMode.default('choices'),
  choices: choices().default(3),
});

export const divisionShare = defineExerciseType({
  id: 'division-share',
  domain: 'math',
  description:
    'Share objects fairly onto plates and say how many each plate gets.',
  paramsSchema: DivisionShareParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH':
          '{number:total} {plural:object} auf {number:groups} Teller. Wie viele kommen auf jeden Teller?',
        'en-US':
          '{number:total} {plural:object} on {number:groups} plates. How many go on each plate?',
      },
    },
  },
  requirements: (p) => pictureNeeds(p.objects, 'objects', ['plural']),
  issues: (p) => [
    ...issueIf(
      p.minQuotient > p.maxQuotient,
      ['minQuotient'],
      'minQuotient must not exceed maxQuotient',
    ),
  ],
  frameUses: (p) => {
    const quotients = range(p.minQuotient, p.maxQuotient);
    return [
      {
        frame: 'main',
        slots: {
          total: unique(p.divisors.flatMap((d) => quotients.map((q) => d * q))),
          object: p.objects,
          groups: unique(p.divisors),
        },
      },
    ];
  },
});

export const ClockParamsSchema = z.strictObject({
  steps: z.enum(['hour', 'half', 'quarter', 'five']),
  labels: z.enum(['words', 'digital', 'both']).default('both'),
  choices: choices(4).default(3),
});

export const clock = defineExerciseType({
  id: 'clock',
  domain: 'math',
  description: 'Read an analog clock and pick the matching time.',
  paramsSchema: ClockParamsSchema,
  frames: {
    main: {
      speak: { 'de-CH': 'Wie spät ist es?', 'en-US': 'What time is it?' },
    },
  },
  requirements: () => [],
  issues: () => [],
  frameUses: () => [{ frame: 'main', slots: {} }],
  labels: (p, ctx) =>
    p.labels === 'digital'
      ? []
      : clockTimes(p.steps).map((time) => timeWords(time, ctx.locale)),
});

export const MoneyParamsSchema = z.strictObject({
  mode: z.enum(['total', 'pay', 'compare']),
  currency: z.enum(['auto', 'CHF', 'USD']).default('auto'),
  group: z.enum(['major', 'minor']).default('major'),
  minItems: int(1, 8).default(2),
  maxItems: int(1, 8).default(4),
  maxTotal: int(2, 100),
  answerMode: answerMode.default('keypad'),
  choices: choices().default(3),
});
export type MoneyParams = z.output<typeof MoneyParamsSchema>;

export function moneyFrameKey(
  mode: 'total' | 'pay',
  currency: Currency,
  group: MoneyGroup,
): string {
  return `${mode}-${currency.toLowerCase()}-${group}`;
}

const unitWords = {
  'chf-major': { de: 'Franken', en: 'francs' },
  'chf-minor': { de: 'Rappen', en: 'rappen' },
  'usd-major': { de: 'Dollar', en: 'dollars' },
  'usd-minor': { de: 'Cent', en: 'cents' },
} as const;

const moneyFrames = Object.fromEntries(
  Object.entries(unitWords).flatMap(([unit, words]) => [
    [
      `total-${unit}`,
      {
        speak: {
          'de-CH': `Wie viele ${words.de} sind das?`,
          'en-US': `How many ${words.en} is that?`,
        },
      },
    ],
    [
      `pay-${unit}`,
      {
        speak: {
          'de-CH': `Lege genau {number:amount} ${words.de} hin.`,
          'en-US': `Pay exactly {number:amount} ${words.en}.`,
        },
      },
    ],
  ]),
);

export const moneyChf = defineExerciseType({
  id: 'money-chf',
  domain: 'math',
  description:
    'Count money, pay an amount with coins and notes, or compare two purses (CHF or USD).',
  paramsSchema: MoneyParamsSchema,
  frames: {
    ...moneyFrames,
    compare: {
      speak: {
        'de-CH': 'Wo ist mehr Geld?',
        'en-US': 'Which side has more money?',
      },
    },
  },
  requirements: () => [],
  issues: (p) => {
    const currencies: Currency[] =
      p.currency === 'auto' ? ['CHF', 'USD'] : [p.currency];
    return [
      ...issueIf(
        p.minItems > p.maxItems,
        ['minItems'],
        'minItems must not exceed maxItems',
      ),
      ...issueIf(
        p.group === 'major' && p.maxTotal > 100,
        ['maxTotal'],
        'at most 100',
      ),
      ...currencies.flatMap((currency) => {
        const smallest = Math.min(
          ...denominationsFor(currency, p.group).map((d) => d.value),
        );
        const unit = p.group === 'major' ? 100 : 1;
        return issueIf(
          smallest * Math.max(p.minItems, p.mode === 'pay' ? 1 : 2) >
            p.maxTotal * unit,
          ['maxTotal'],
          `${currency} needs a larger maxTotal for ${p.minItems} pieces`,
        );
      }),
    ];
  },
  frameUses: (p, ctx) => {
    const currency = currencyFor(p.currency, ctx.locale);
    if (p.mode === 'compare') {
      return [{ frame: 'compare', slots: {} }];
    }
    if (p.mode === 'total') {
      return [{ frame: moneyFrameKey('total', currency, p.group), slots: {} }];
    }
    return [
      {
        frame: moneyFrameKey('pay', currency, p.group),
        slots: { amount: payAmounts(p, currency) },
      },
    ];
  },
});

export function payAmounts(p: MoneyParams, currency: Currency): number[] {
  const step = currency === 'CHF' && p.group === 'minor' ? 5 : 1;
  return range(2, p.maxTotal).filter((amount) => amount % step === 0);
}
