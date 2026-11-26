import { range } from '../exercises/common.ts';
import { renderPrompt } from '../exercises/frames.ts';
import { bondCount, crossesTen, enumerateAddSub } from '../exercises/math.ts';
import type { AddSubParams, AddSubProblem } from '../exercises/math.ts';
import type { ExerciseParams, ExerciseTypeId } from '../exercises/registry.ts';
import {
  CellsAnswerSchema,
  ChoiceAnswerSchema,
  RelationAnswerSchema,
  SequenceAnswerSchema,
  ValueAnswerSchema,
  ValuesAnswerSchema,
} from './answers.ts';
import type {
  CellsAnswer,
  ChoiceAnswer,
  RelationAnswer,
  ValueAnswer,
  ValuesAnswer,
} from './answers.ts';
import {
  layout,
  near,
  numberChoices,
  orderFor,
  pickFocus,
  withIds,
} from './helpers.ts';
import type { Rng } from './rng.ts';
import type {
  AddSubPayload,
  ComparePayload,
  CountObjectsPayload,
  ExerciseRuntime,
  NumberBondPayload,
  NumberLinePayload,
  NumberRecognitionPayload,
  NumberWallPayload,
  RuntimeContext,
  SequencePayload,
  ShapeChoice,
  ShapePickPayload,
  TenFramePayload,
  WallCell,
} from './types.ts';

type Params<K extends ExerciseTypeId> = ExerciseParams<K>;

function pickPicture(
  rng: Rng,
  pictures: readonly string[],
  ctx: RuntimeContext,
): string {
  return pickFocus(rng, pictures, ctx);
}

function valueChoices(
  rng: Rng,
  mode: 'choices' | 'keypad',
  answer: number,
  count: number,
  pool: number[],
) {
  return mode === 'choices'
    ? { choices: numberChoices(rng, answer, count, pool) }
    : {};
}

export const countObjectsRuntime: ExerciseRuntime<
  Params<'count-objects'>,
  CountObjectsPayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const count = pickFocus(rng, range(p.min, p.max), ctx);
    const pictureId =
      ctx.demo !== undefined ? p.objects[0]! : rng.pick(p.objects);
    const objects = layout(p.arrangement, count, rng).map((point) => ({
      pictureId,
      ...point,
    }));
    return {
      prompt: renderPrompt(ctx.content, 'count-objects', 'main', ctx.locale, {
        object: pictureId,
      }),
      payload: {
        arrangement: p.arrangement,
        objects,
        answerMode: p.answerMode,
        ...valueChoices(
          rng,
          p.answerMode,
          count,
          p.choices,
          near(count, 4, 0, 20),
        ),
      },
      solution: { answer: { value: count }, hint: 'touch-each' },
      focus: count,
    };
  },
};

export const numberRecognitionRuntime: ExerciseRuntime<
  Params<'number-recognition'>,
  NumberRecognitionPayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const target = pickFocus(rng, range(p.min, p.max), ctx);
    const hear = p.mode === 'hear';
    const pictureId =
      !hear && p.representation === 'objects' && p.objects?.length
        ? rng.pick(p.objects)
        : undefined;
    return {
      prompt: renderPrompt(
        ctx.content,
        'number-recognition',
        hear ? 'hear' : 'match',
        ctx.locale,
        {
          target,
        },
      ),
      payload: {
        mode: p.mode,
        representation: hear ? 'numeral' : p.representation,
        ...(pictureId !== undefined ? { pictureId } : {}),
        choices: numberChoices(rng, target, p.choices, range(p.min, p.max)),
      },
      solution: {
        answer: { value: target },
        hint: hear ? 'listen-again' : 'count-dots',
      },
      focus: target,
    };
  },
};

export const tenFrameRuntime: ExerciseRuntime<
  Params<'ten-frame'>,
  TenFramePayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const count = pickFocus(rng, range(p.min, p.max), ctx);
    const filled = new Set(
      p.fill === 'ordered'
        ? range(0, count - 1)
        : rng.sample(range(0, p.frame - 1), count),
    );
    return {
      prompt: renderPrompt(ctx.content, 'ten-frame', 'main', ctx.locale, {}),
      payload: {
        frame: p.frame,
        cells: range(0, p.frame - 1).map((cell) => filled.has(cell)),
        answerMode: p.answerMode,
        ...valueChoices(
          rng,
          p.answerMode,
          count,
          p.choices,
          near(count, 4, 0, p.frame),
        ),
      },
      solution: { answer: { value: count }, hint: 'power-of-five' },
      focus: count,
    };
  },
};

function comparePair(rng: Rng, p: Params<'compare'>): [number, number] {
  if (p.min === p.max) {
    return [p.min, p.min];
  }
  if (p.allowEqual && rng.bool(0.25)) {
    const value = rng.int(p.min, p.max);
    return [value, value];
  }
  for (let tries = 0; tries < 200; tries += 1) {
    const a = rng.int(p.min, p.max);
    const b = rng.int(p.min, p.max);
    if (
      a !== b &&
      (p.maxDifference === undefined || Math.abs(a - b) <= p.maxDifference)
    ) {
      return [a, b];
    }
  }
  return rng.shuffle([p.min, p.min + 1]) as [number, number];
}

export const compareRuntime: ExerciseRuntime<
  Params<'compare'>,
  ComparePayload,
  RelationAnswer
> = {
  answerSchema: RelationAnswerSchema,
  generate(rng, p, ctx) {
    const [a, b] = comparePair(rng, p);
    const relation = a < b ? 'lt' : a > b ? 'gt' : 'eq';
    const numbers = p.mode === 'numbers';
    const pictureId =
      !numbers && p.objects?.length ? rng.pick(p.objects) : undefined;
    const side = (value: number) =>
      numbers
        ? { value }
        : { count: value, ...(pictureId !== undefined ? { pictureId } : {}) };
    return {
      prompt: numbers
        ? renderPrompt(ctx.content, 'compare', 'numbers', ctx.locale, { a, b })
        : renderPrompt(ctx.content, 'compare', 'quantities', ctx.locale, {}),
      payload: { mode: p.mode, left: side(a), right: side(b) },
      solution: {
        answer: { relation },
        hint: numbers ? 'crocodile' : 'match-pairs',
      },
      focus: relation,
    };
  },
};

function lineLabels(
  p: Params<'number-line'>,
  values: readonly number[],
): number[] {
  switch (p.labels) {
    case 'all':
      return [...values];
    case 'ends':
      return [p.start, p.end];
    case 'tens':
      return values.filter(
        (value) => value % 10 === 0 || value === p.start || value === p.end,
      );
    case 'none':
      return [];
  }
}

export const numberLineRuntime: ExerciseRuntime<
  Params<'number-line'>,
  NumberLinePayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const values = range(p.start, p.end, p.step);
    const labels = lineLabels(p, values);
    const base = { mode: p.mode, start: p.start, end: p.end, step: p.step };
    if (p.mode === 'place') {
      const open = values.filter((value) => !labels.includes(value));
      const target = pickFocus(rng, open.length > 0 ? open : values, ctx);
      return {
        prompt: renderPrompt(ctx.content, 'number-line', 'place', ctx.locale, {
          target,
        }),
        payload: { ...base, labels },
        solution: { answer: { value: target }, hint: 'count-the-steps' },
        focus: target,
      };
    }
    const target = pickFocus(
      rng,
      values.length > 2 ? values.slice(1, -1) : values,
      ctx,
    );
    return {
      prompt: renderPrompt(
        ctx.content,
        'number-line',
        'missing',
        ctx.locale,
        {},
      ),
      payload: {
        ...base,
        labels: labels.filter((value) => value !== target),
        markedTick: values.indexOf(target),
        choices: numberChoices(rng, target, p.choices, values),
      },
      solution: { answer: { value: target }, hint: 'look-at-neighbors' },
      focus: target,
    };
  },
};

const problemCache = new WeakMap<object, AddSubProblem[]>();

function problemsFor(p: AddSubParams): AddSubProblem[] {
  const cached = problemCache.get(p);
  if (cached !== undefined) {
    return cached;
  }
  const problems = enumerateAddSub(p);
  problemCache.set(p, problems);
  return problems;
}

export const addSubRuntime: ExerciseRuntime<
  Params<'add-sub'>,
  AddSubPayload,
  ValueAnswer
> = {
  answerSchema: ValueAnswerSchema,
  generate(rng, p, ctx) {
    const problems = problemsFor(p);
    if (problems.length === 0) {
      throw new RangeError('add-sub params allow no problem');
    }
    const missing = p.unknown === 'operand';
    const answerOf = (x: AddSubProblem) => (missing ? x.b : x.result);
    const target = ctx.demo?.target;
    const problem =
      ctx.demo !== undefined
        ? (problems.find((x) => answerOf(x) === target) ?? problems[0]!)
        : rng.pick(problems);
    const answer = answerOf(problem);
    const pictureId =
      p.manipulatives === 'objects' && p.objects?.length
        ? ctx.demo !== undefined
          ? p.objects[0]!
          : rng.pick(p.objects)
        : undefined;
    const hint = crossesTen(problem.op, problem.a, problem.b)
      ? 'make-ten'
      : problem.op === 'add'
        ? 'count-on'
        : 'count-back';
    return {
      prompt: missing
        ? renderPrompt(ctx.content, 'add-sub', 'add-missing', ctx.locale, {
            a: problem.a,
            c: problem.result,
          })
        : renderPrompt(ctx.content, 'add-sub', problem.op, ctx.locale, {
            a: problem.a,
            b: problem.b,
          }),
      payload: {
        op: problem.op,
        a: problem.a,
        b: missing ? null : problem.b,
        result: missing ? problem.result : null,
        manipulatives: p.manipulatives,
        ...(pictureId !== undefined ? { pictureId } : {}),
        answerMode: p.answerMode,
        ...valueChoices(
          rng,
          p.answerMode,
          answer,
          p.choices,
          near(answer, 5, 0, p.max),
        ),
      },
      solution: { answer: { value: answer }, hint },
      focus: answer,
    };
  },
};

export const numberBondRuntime: ExerciseRuntime<
  Params<'number-bond'>,
  NumberBondPayload,
  ValuesAnswer
> = {
  answerSchema: ValuesAnswerSchema,
  generate(rng, p, ctx) {
    const totals = range(p.min, p.max).filter(
      (total) => bondCount(total, p.allowZero) >= p.rows,
    );
    const whole = pickFocus(rng, totals, ctx);
    const lowest = p.allowZero ? 0 : 1;
    const splits = rng.sample(range(lowest, whole - lowest), p.rows);
    const missing =
      p.missing === 'mixed' ? rng.pick(['part', 'whole'] as const) : p.missing;
    const values: number[] = [];
    const rows = splits.map((left) => {
      const right = whole - left;
      if (missing === 'whole') {
        return { left, right };
      }
      if (rng.bool()) {
        values.push(left);
        return { left: null, right };
      }
      values.push(right);
      return { left, right: null };
    });
    if (missing === 'whole') {
      values.push(whole);
    }
    return {
      prompt: renderPrompt(
        ctx.content,
        'number-bond',
        values.length === 1 ? 'one' : 'many',
        ctx.locale,
        {},
      ),
      payload: {
        whole: missing === 'whole' ? null : whole,
        rows,
        representation: p.representation,
      },
      solution: { answer: { values }, hint: 'parts-make-whole' },
      focus: whole,
    };
  },
};

function wallBase(
  rng: Rng,
  rows: 2 | 3,
  max: number,
  lowest: number,
): number[] {
  if (rows === 2) {
    const a = rng.int(lowest, max - lowest);
    return [a, rng.int(lowest, max - a)];
  }
  const b = rng.int(lowest, Math.floor((max - 2 * lowest) / 2));
  const a = rng.int(lowest, max - 2 * b - lowest);
  return [a, b, rng.int(lowest, max - 2 * b - a)];
}

function wallSolvable(rows: number, blank: ReadonlySet<string>): boolean {
  const known = new Set<string>();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < rows - row; col += 1) {
      if (!blank.has(`r${row}c${col}`)) {
        known.add(`r${row}c${col}`);
      }
    }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (let row = 1; row < rows; row += 1) {
      for (let col = 0; col < rows - row; col += 1) {
        const cell = [
          `r${row}c${col}`,
          `r${row - 1}c${col}`,
          `r${row - 1}c${col + 1}`,
        ];
        const missing = cell.filter((id) => !known.has(id));
        if (missing.length === 1) {
          known.add(missing[0]!);
          changed = true;
        }
      }
    }
  }
  return known.size === (rows * (rows + 1)) / 2;
}

export const numberWallRuntime: ExerciseRuntime<
  Params<'number-wall'>,
  NumberWallPayload,
  CellsAnswer
> = {
  answerSchema: CellsAnswerSchema,
  generate(rng, p, ctx) {
    const base = wallBase(rng, p.rows, p.max, p.allowZero ? 0 : 1);
    const grid: number[][] = [base];
    for (let row = 1; row < p.rows; row += 1) {
      const below = grid[row - 1]!;
      grid.push(below.slice(1).map((value, col) => below[col]! + value));
    }
    const cells = grid.flatMap((values, row) =>
      values.map((value, col) => ({ id: `r${row}c${col}`, row, col, value })),
    );
    const candidates = cells.filter(
      (cell) => p.blankPosition === 'any' || cell.row > 0,
    );
    const count = Math.min(p.blanks, candidates.length);
    const pickBlanks = (from: readonly WallCell[]) =>
      new Set(
        rng.sample(from, Math.min(count, from.length)).map((cell) => cell.id),
      );
    let blank = pickBlanks(candidates);
    for (
      let tries = 0;
      tries < 50 && !wallSolvable(p.rows, blank);
      tries += 1
    ) {
      blank = pickBlanks(candidates);
    }
    if (!wallSolvable(p.rows, blank)) {
      blank = pickBlanks(cells.filter((cell) => cell.row > 0));
    }
    const values = Object.fromEntries(
      cells
        .filter((cell) => blank.has(cell.id))
        .map((cell) => [cell.id, cell.value]),
    );
    const subtract = cells.some((cell) => cell.row === 0 && blank.has(cell.id));
    return {
      prompt: renderPrompt(ctx.content, 'number-wall', 'main', ctx.locale, {}),
      payload: {
        rows: p.rows,
        cells: cells.map((cell): WallCell =>
          blank.has(cell.id) ? { ...cell, value: null } : cell,
        ),
      },
      solution: {
        answer: { values },
        hint: subtract ? 'subtract-from-above' : 'add-the-two-below',
      },
      focus: grid[p.rows - 1]![0]!,
    };
  },
};

function numberSequence(
  rng: Rng,
  p: Extract<Params<'sequence'>, { kind: 'numbers' }>,
  ctx: RuntimeContext,
) {
  const span = (p.length - 1) * p.step;
  const runs = range(p.min, p.max - span).map((start) => {
    const values = range(0, p.length - 1).map((i) => start + i * p.step);
    return p.direction === 'down' ? values.reverse() : values;
  });
  const indexFor = (values: number[]) =>
    p.ask === 'next' ? values.length - 1 : p.ask === 'before' ? 0 : -1;
  const target = ctx.demo?.target;
  let values = rng.pick(runs);
  if (ctx.demo !== undefined) {
    values = runs.find((run) => run[indexFor(run)] === target) ?? runs[0]!;
  }
  const index =
    p.ask === 'missing' ? rng.int(1, p.length - 2) : indexFor(values);
  const answer = values[index]!;
  const payload: SequencePayload = {
    kind: 'numbers',
    items: values.map((value, i) => (i === index ? null : value)),
    answerMode: p.answerMode,
    ...valueChoices(
      rng,
      p.answerMode,
      answer,
      p.choices,
      near(answer, 3 * p.step),
    ),
  };
  return {
    prompt: renderPrompt(ctx.content, 'sequence', p.ask, ctx.locale, {}),
    payload,
    solution: { answer: { value: answer }, hint: 'look-at-the-steps' as const },
    focus: answer,
  };
}

function patternSequence(
  rng: Rng,
  p: Extract<Params<'sequence'>, { kind: 'pattern' }>,
  ctx: RuntimeContext,
) {
  const symbols = [...new Set(p.unit)];
  const pictures = orderFor(rng, p.pictures, ctx);
  const bySymbol = new Map(symbols.map((symbol, i) => [symbol, pictures[i]!]));
  const at = (i: number) => bySymbol.get(p.unit[i % p.unit.length]!)!;
  const answer = at(p.shown);
  const others = pictures.filter((pictureId) => pictureId !== answer);
  const options = rng.shuffle([answer, ...rng.sample(others, p.choices - 1)]);
  const choices = withIds(
    rng,
    options.map((pictureId) => ({ pictureId })),
  );
  const payload: SequencePayload = {
    kind: 'pattern',
    items: range(0, p.shown - 1).map((i) => ({ pictureId: at(i) })),
    choices,
  };
  return {
    prompt: renderPrompt(ctx.content, 'sequence', 'pattern', ctx.locale, {}),
    payload,
    solution: {
      answer: {
        choiceId: choices.find((choice) => choice.pictureId === answer)!.id,
      },
      hint: 'say-the-pattern' as const,
    },
    focus: answer,
  };
}

export const sequenceRuntime: ExerciseRuntime<
  Params<'sequence'>,
  SequencePayload,
  ValueAnswer | ChoiceAnswer
> = {
  answerSchema: SequenceAnswerSchema,
  generate: (rng, p, ctx) =>
    p.kind === 'numbers'
      ? numberSequence(rng, p, ctx)
      : patternSequence(rng, p, ctx),
};

const ROTATIONS = [0, 15, 30, 45, 90, 135, 180, 270] as const;

export const shapePickRuntime: ExerciseRuntime<
  Params<'shape-pick'>,
  ShapePickPayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const target = pickPicture(rng, p.shapes, ctx);
    const others = rng.sample(
      p.shapes.filter((shape) => shape !== target),
      p.choices - 1,
    );
    const choices = withIds(
      rng,
      rng
        .shuffle([target, ...others])
        .map((pictureId): Omit<ShapeChoice, 'id'> => ({
          pictureId,
          scale: p.varySize
            ? Math.round((0.6 + rng.next() * 0.4) * 100) / 100
            : 1,
          rotation: p.varyRotation ? rng.pick(ROTATIONS) : 0,
        })),
    );
    return {
      prompt: renderPrompt(ctx.content, 'shape-pick', 'main', ctx.locale, {
        shape: target,
      }),
      payload: { choices },
      solution: {
        answer: {
          choiceId: choices.find((choice) => choice.pictureId === target)!.id,
        },
        hint: 'count-corners',
      },
      focus: target,
    };
  },
};
