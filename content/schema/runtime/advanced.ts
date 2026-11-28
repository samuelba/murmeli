import {
  calendarNames,
  calendarSize,
  calendarStep,
  displayOrder,
  seasonOfMonth,
} from '../calendar.ts';
import type {
  CalendarAsk,
  CalendarRelation,
  CalendarUnit,
} from '../calendar.ts';
import { clockTimes, digitalTime, timeWords } from '../clock.ts';
import type { ClockTime } from '../clock.ts';
import {
  enumerateTimes,
  moneyFrameKey,
  payAmounts,
} from '../exercises/advanced.ts';
import type { TimesProblem } from '../exercises/advanced.ts';
import { range, unique } from '../exercises/common.ts';
import { renderPrompt } from '../exercises/frames.ts';
import type { ExerciseParams, ExerciseTypeId } from '../exercises/registry.ts';
import { currencyFor, denominationsFor } from '../money.ts';
import type { Currency, Denomination, MoneyGroup } from '../money.ts';
import {
  ChoiceAnswerSchema,
  MoneyAnswerSchema,
  ValueAnswerSchema,
} from './answers.ts';
import type {
  ChoiceAnswer,
  CoinsAnswer,
  RelationAnswer,
  ValueAnswer,
} from './answers.ts';
import type { HintKey } from './hints.ts';
import { near, numberChoices, pickFocus, withIds } from './helpers.ts';
import type { Rng } from './rng.ts';
import type {
  AnswerMode,
  Choice,
  ExerciseRuntime,
  RuntimeContext,
} from './types.ts';

type Params<K extends ExerciseTypeId> = ExerciseParams<K>;

function valueChoices(
  rng: Rng,
  mode: AnswerMode,
  answer: number,
  count: number,
  pool: number[],
) {
  return mode === 'choices'
    ? { choices: numberChoices(rng, answer, count, pool) }
    : {};
}

export interface TimesTablePayload {
  readonly mode: 'product' | 'missing-factor' | 'row';
  readonly a: number | null;
  readonly b: number | null;
  readonly product: number | null;
  readonly row?: number;
  readonly items?: readonly (number | null)[];
  readonly answerMode: AnswerMode;
  readonly choices?: readonly Choice[];
}

const timesCache = new WeakMap<object, TimesProblem[]>();

export const timesTableRuntime: ExerciseRuntime<
  Params<'times-table'>,
  TimesTablePayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const target = ctx.demo?.target;
    if (p.mode === 'row') {
      const runs = unique(p.rows).flatMap((row) =>
        range(p.minFactor, p.maxFactor - 3).map((k) => ({
          row,
          k,
          answer: row * (k + 3),
        })),
      );
      const run =
        ctx.demo !== undefined
          ? (runs.find((r) => r.answer === target) ?? runs[0]!)
          : rng.pick(runs);
      return {
        prompt: renderPrompt(ctx.content, 'times-table', 'row', ctx.locale, {}),
        payload: {
          mode: 'row',
          a: null,
          b: null,
          product: null,
          row: run.row,
          items: [...[0, 1, 2].map((i) => run.row * (run.k + i)), null],
          answerMode: p.answerMode,
          ...valueChoices(rng, p.answerMode, run.answer, p.choices, [
            run.answer - run.row,
            run.answer + run.row,
            ...near(run.answer, 3),
          ]),
        },
        solution: { answer: { value: run.answer }, hint: 'look-at-the-steps' },
        focus: run.answer,
      };
    }
    const problems = timesCache.get(p) ?? enumerateTimes(p);
    timesCache.set(p, problems);
    const missing = p.mode === 'missing-factor';
    const answerOf = (x: TimesProblem) => (missing ? x.b : x.product);
    const problem =
      ctx.demo !== undefined
        ? (problems.find((x) => answerOf(x) === target) ?? problems[0]!)
        : rng.pick(problems);
    const answer = answerOf(problem);
    const pool = [
      answer - problem.a,
      answer + problem.a,
      answer - 1,
      answer + 1,
      ...near(answer, 4),
    ];
    return {
      prompt: missing
        ? renderPrompt(
            ctx.content,
            'times-table',
            'missing-factor',
            ctx.locale,
            {
              a: problem.a,
              c: problem.product,
            },
          )
        : renderPrompt(ctx.content, 'times-table', 'product', ctx.locale, {
            a: problem.a,
            b: problem.b,
          }),
      payload: {
        mode: p.mode,
        a: problem.a,
        b: missing ? null : problem.b,
        product: missing ? problem.product : null,
        answerMode: p.answerMode,
        ...valueChoices(rng, p.answerMode, answer, p.choices, pool),
      },
      solution: {
        answer: { value: answer },
        hint: missing ? 'times-row' : 'skip-count',
      },
      focus: answer,
    };
  },
};

export interface DivisionSharePayload {
  readonly total: number;
  readonly groups: number;
  readonly pictureId: string;
  readonly answerMode: AnswerMode;
  readonly choices?: readonly Choice[];
}

export const divisionShareRuntime: ExerciseRuntime<
  Params<'division-share'>,
  DivisionSharePayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const quotient = pickFocus(rng, range(p.minQuotient, p.maxQuotient), ctx);
    const groups =
      ctx.demo !== undefined ? p.divisors[0]! : rng.pick(p.divisors);
    const pictureId =
      ctx.demo !== undefined ? p.objects[0]! : rng.pick(p.objects);
    const total = quotient * groups;
    return {
      prompt: renderPrompt(ctx.content, 'division-share', 'main', ctx.locale, {
        total,
        object: pictureId,
        groups,
      }),
      payload: {
        total,
        groups,
        pictureId,
        answerMode: p.answerMode,
        ...valueChoices(
          rng,
          p.answerMode,
          quotient,
          p.choices,
          near(quotient, 3, 1, 10),
        ),
      },
      solution: { answer: { value: quotient }, hint: 'share-one-by-one' },
      focus: quotient,
    };
  },
};

export interface ClockChoice extends Choice {
  readonly label: string;
  readonly digital?: string;
}

export interface ClockPayload {
  readonly hour: number;
  readonly minute: number;
  readonly choices: readonly ClockChoice[];
}

function confusables({ hour, minute }: ClockTime): ClockTime[] {
  const next = (hour % 12) + 1;
  const previous = ((hour + 10) % 12) + 1;
  return [
    { hour: next, minute },
    { hour: previous, minute },
    { hour, minute: (60 - minute) % 60 },
    { hour, minute: (minute + 30) % 60 },
    { hour: next, minute: 0 },
  ];
}

export const clockRuntime: ExerciseRuntime<
  Params<'clock'>,
  ClockPayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const times = clockTimes(p.steps);
    const key = (time: ClockTime) => digitalTime(time);
    const keys = times.map(key);
    const targetKey = pickFocus(rng, keys, ctx);
    const target = times[keys.indexOf(targetKey)]!;
    const near = unique(confusables(target).map(key)).filter(
      (k) => k !== targetKey && keys.includes(k),
    );
    const rest = keys.filter((k) => k !== targetKey && !near.includes(k));
    const others = [...rng.shuffle(near), ...rng.shuffle(rest)].slice(
      0,
      p.choices - 1,
    );
    const label = (time: ClockTime): Omit<ClockChoice, 'id'> => {
      const words = timeWords(time, ctx.locale);
      const digital = digitalTime(time);
      if (p.labels === 'digital') {
        return { label: digital };
      }
      return p.labels === 'words'
        ? { label: words }
        : { label: words, digital };
    };
    const options = rng.shuffle([targetKey, ...others]);
    const choices = withIds(
      rng,
      options.map((k) => label(times[keys.indexOf(k)]!)),
    );
    return {
      prompt: renderPrompt(ctx.content, 'clock', 'main', ctx.locale, {}),
      payload: { hour: target.hour, minute: target.minute, choices },
      solution: {
        answer: { choiceId: choices[options.indexOf(targetKey)]!.id },
        hint: 'clock-hands',
      },
      focus: targetKey,
    };
  },
};

export interface CalendarCard {
  readonly index: number;
  /** null for the gap the kid has to fill */
  readonly label: string | null;
}

export interface CalendarChoice extends Choice {
  readonly label: string;
}

export interface CalendarPayload {
  readonly unit: CalendarUnit;
  readonly ask: CalendarAsk;
  /** The whole cycle in display order, or empty when the strip is hidden */
  readonly ring: readonly CalendarCard[];
  /** The named day, month or season the question starts from */
  readonly focus: number | null;
  readonly name: string | null;
  readonly gap: number | null;
  /** The time of day or season to draw */
  readonly scene: number | null;
  readonly relation: CalendarRelation | null;
  readonly choices: readonly CalendarChoice[];
}

function calendarHint(unit: CalendarUnit, ask: CalendarAsk): HintKey {
  if (ask === 'season') {
    return 'month-season';
  }
  if (unit === 'season') {
    return ask === 'scene' ? 'season-signs' : 'season-order';
  }
  return unit === 'daytime'
    ? 'look-at-the-sky'
    : unit === 'weekday'
      ? 'say-the-days'
      : 'say-the-months';
}

function calendarDelta(
  ask: CalendarAsk,
  relation: CalendarRelation | null,
): number {
  if (ask === 'next' || relation === 'tomorrow') {
    return 1;
  }
  return ask === 'before' || relation === 'yesterday' ? -1 : 0;
}

export const calendarRuntime: ExerciseRuntime<
  Params<'calendar'>,
  CalendarPayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const subject = pickFocus(rng, range(0, calendarSize(p.unit) - 1), ctx);
    const relation: CalendarRelation | null =
      p.ask !== 'relative'
        ? null
        : p.relation === 'both'
          ? rng.pick(['tomorrow', 'yesterday'] as const)
          : p.relation;
    const delta = calendarDelta(p.ask, relation);
    const answerUnit: CalendarUnit = p.ask === 'season' ? 'season' : p.unit;
    const wrap = (index: number) => calendarStep(answerUnit, index, 0);
    const answer =
      p.ask === 'season'
        ? seasonOfMonth(subject)
        : calendarStep(p.unit, subject, delta);
    const confusable =
      delta === 0
        ? [answer - 1, answer + 1, answer + 2]
        : [subject, subject - delta, answer + delta];
    const nearby = unique(confusable.map(wrap)).filter((i) => i !== answer);
    const rest = range(0, calendarSize(answerUnit) - 1).filter(
      (i) => i !== answer && !nearby.includes(i),
    );
    const others = [...rng.shuffle(nearby), ...rng.shuffle(rest)].slice(
      0,
      p.choices - 1,
    );
    const options = rng.shuffle([answer, ...others]);
    const answerNames = calendarNames(answerUnit, ctx.locale);
    const choices = withIds(
      rng,
      options.map((index) => ({ label: answerNames[index]! })),
    );
    const names = calendarNames(p.unit, ctx.locale);
    const gap = p.ask === 'missing' ? subject : null;
    const ring =
      p.strip && p.ask !== 'scene'
        ? displayOrder(p.unit, ctx.locale).map((index) => ({
            index,
            label: index === gap ? null : names[index]!,
          }))
        : [];
    const named = p.ask !== 'missing' && p.ask !== 'scene';
    const frame =
      relation === null ? `${p.unit}-${p.ask}` : `${p.unit}-${relation}`;
    return {
      prompt: renderPrompt(
        ctx.content,
        'calendar',
        frame,
        ctx.locale,
        named ? { name: names[subject]! } : {},
      ),
      payload: {
        unit: p.unit,
        ask: p.ask,
        ring,
        focus: named ? subject : null,
        name: named ? names[subject]! : null,
        gap,
        scene: p.ask === 'scene' ? subject : null,
        relation,
        choices,
      },
      solution: {
        answer: { choiceId: choices[options.indexOf(answer)]!.id },
        hint: calendarHint(p.unit, p.ask),
      },
      focus: subject,
    };
  },
};

export interface MoneyItem {
  readonly denomination: string;
  readonly label: string;
  readonly kind: 'coin' | 'note';
  readonly file: string;
}

export type MoneyPayload =
  | {
      readonly mode: 'total';
      readonly currency: Currency;
      readonly group: MoneyGroup;
      readonly items: readonly MoneyItem[];
      readonly answerMode: AnswerMode;
      readonly choices?: readonly Choice[];
    }
  | {
      readonly mode: 'pay';
      readonly currency: Currency;
      readonly group: MoneyGroup;
      readonly amount: number;
      readonly wallet: readonly MoneyItem[];
    }
  | {
      readonly mode: 'compare';
      readonly currency: Currency;
      readonly group: MoneyGroup;
      readonly left: readonly MoneyItem[];
      readonly right: readonly MoneyItem[];
    };

const item = (d: Denomination): MoneyItem => ({
  denomination: d.id,
  label: d.label,
  kind: d.kind,
  file: d.file,
});

function purse(
  rng: Rng,
  p: Params<'money-chf'>,
  denominations: readonly Denomination[],
  limit: number,
) {
  for (let tries = 0; tries < 200; tries += 1) {
    const count = rng.int(p.minItems, p.maxItems);
    const picked: Denomination[] = [];
    let total = 0;
    for (let i = 0; i < count; i += 1) {
      const fitting = denominations.filter((d) => total + d.value <= limit);
      if (fitting.length === 0) {
        break;
      }
      const d = rng.pick(fitting);
      picked.push(d);
      total += d.value;
    }
    if (picked.length === count) {
      return { picked, total };
    }
  }
  const smallest = denominations.reduce((a, b) => (a.value <= b.value ? a : b));
  const picked = Array.from({ length: p.minItems }, () => smallest);
  return { picked, total: smallest.value * p.minItems };
}

export function greedyCoins(
  amount: number,
  denominations: readonly Denomination[],
): string[] {
  const sorted = [...denominations].sort((a, b) => b.value - a.value);
  const coins: string[] = [];
  let rest = amount;
  for (const d of sorted) {
    while (d.value <= rest) {
      coins.push(d.id);
      rest -= d.value;
    }
  }
  return coins;
}

export const moneyRuntime: ExerciseRuntime<
  Params<'money-chf'>,
  MoneyPayload,
  ValueAnswer | CoinsAnswer | RelationAnswer
> = {
  answerSchema: MoneyAnswerSchema,
  generate(rng, p, ctx: RuntimeContext) {
    const currency = currencyFor(p.currency, ctx.locale);
    const denominations = denominationsFor(currency, p.group);
    const unit = p.group === 'major' ? 100 : 1;
    const limit = p.maxTotal * unit;
    const base = { currency, group: p.group };
    const hint = 'count-the-money' as const;
    if (p.mode === 'pay') {
      const amount = pickFocus(rng, payAmounts(p, currency), ctx);
      return {
        prompt: renderPrompt(
          ctx.content,
          'money-chf',
          moneyFrameKey('pay', currency, p.group),
          ctx.locale,
          {
            amount,
          },
        ),
        payload: {
          mode: 'pay',
          ...base,
          amount,
          wallet: denominations.map(item),
        },
        solution: {
          answer: { coins: greedyCoins(amount * unit, denominations) },
          hint,
          rule: {
            kind: 'coin-sum',
            amount: amount * unit,
            values: Object.fromEntries(
              denominations.map((d) => [d.id, d.value]),
            ),
          },
        },
        focus: amount,
      };
    }
    if (p.mode === 'compare') {
      const left = purse(rng, p, denominations, limit);
      const right = purse(rng, p, denominations, limit);
      const relation =
        left.total < right.total
          ? 'lt'
          : left.total > right.total
            ? 'gt'
            : 'eq';
      return {
        prompt: renderPrompt(
          ctx.content,
          'money-chf',
          'compare',
          ctx.locale,
          {},
        ),
        payload: {
          mode: 'compare',
          ...base,
          left: left.picked.map(item),
          right: right.picked.map(item),
        },
        solution: { answer: { relation }, hint },
        focus: relation,
      };
    }
    const target = ctx.demo?.target;
    let drawn = purse(rng, p, denominations, limit);
    for (
      let tries = 0;
      ctx.demo !== undefined && tries < 500 && drawn.total / unit !== target;
      tries += 1
    ) {
      if (typeof target !== 'number') {
        break;
      }
      drawn = purse(rng, p, denominations, limit);
    }
    const answer = drawn.total / unit;
    const step = currency === 'CHF' && p.group === 'minor' ? 5 : 1;
    const pool = range(
      Math.max(step, answer - 4 * step),
      answer + 4 * step,
      step,
    );
    return {
      prompt: renderPrompt(
        ctx.content,
        'money-chf',
        moneyFrameKey('total', currency, p.group),
        ctx.locale,
        {},
      ),
      payload: {
        mode: 'total',
        ...base,
        items: drawn.picked.map(item),
        answerMode: p.answerMode,
        ...valueChoices(rng, p.answerMode, answer, p.choices, pool),
      },
      solution: { answer: { value: answer }, hint },
      focus: answer,
    };
  },
};
