import { z } from 'zod';
import { PictureIdSchema } from '../ids.ts';
import {
  answerMode,
  choices,
  int,
  issueIf,
  minMaxIssue,
  pictureList,
  pictureNeeds,
  range,
  unique,
} from './common.ts';
import { defineExerciseType } from './types.ts';
import type { IssueContext, ParamIssue } from './types.ts';

export const CountObjectsParamsSchema = z.strictObject({
  min: int(0, 20),
  max: int(0, 20),
  objects: pictureList,
  arrangement: z
    .enum(['line', 'dice', 'scattered', 'ten-frame'])
    .default('scattered'),
  choices: choices().default(3),
  answerMode: answerMode.default('choices'),
});

export const countObjects = defineExerciseType({
  id: 'count-objects',
  domain: 'math',
  description: 'Count the pictures and tap the matching number.',
  paramsSchema: CountObjectsParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Wie viele {plural:object} siehst du?',
        'en-US': 'How many {plural:object} do you see?',
      },
    },
  },
  requirements: (p) => pictureNeeds(p.objects, 'objects', ['plural']),
  issues: (p) => [
    ...minMaxIssue(p),
    ...issueIf(
      p.arrangement === 'dice' && p.max > 6,
      ['max'],
      'dice arrangement shows at most 6',
    ),
  ],
  frameUses: (p) => [{ frame: 'main', slots: { object: p.objects } }],
});

export const NumberRecognitionParamsSchema = z.strictObject({
  min: int(0, 100),
  max: int(0, 100),
  mode: z.enum(['hear', 'match-quantity']).default('hear'),
  representation: z
    .enum(['dots', 'ten-frame', 'fingers', 'objects'])
    .default('dots'),
  objects: z.array(PictureIdSchema).optional(),
  choices: choices().default(3),
});

const QUANTITY_LIMITS = {
  dots: 10,
  'ten-frame': 20,
  fingers: 10,
  objects: 10,
} as const;

export const numberRecognition = defineExerciseType({
  id: 'number-recognition',
  domain: 'math',
  description:
    'Hear a number and tap the numeral, or see a numeral and tap the matching quantity.',
  paramsSchema: NumberRecognitionParamsSchema,
  frames: {
    hear: {
      speak: {
        'de-CH': 'Tippe auf die Zahl {number:target}.',
        'en-US': 'Tap the number {number:target}.',
      },
      display: {
        'de-CH': 'Welche Zahl hörst du?',
        'en-US': 'Which number do you hear?',
      },
    },
    match: {
      speak: {
        'de-CH': 'Welches Bild zeigt {number:target}?',
        'en-US': 'Which picture shows {number:target}?',
      },
    },
  },
  requirements: (p) => pictureNeeds(p.objects ?? [], 'objects', ['word']),
  issues: (p) => {
    const limit = QUANTITY_LIMITS[p.representation];
    return [
      ...minMaxIssue(p),
      ...issueIf(
        p.choices > p.max - p.min + 1,
        ['choices'],
        `needs at least ${p.choices} numbers in the range`,
      ),
      ...issueIf(
        p.mode === 'match-quantity' && p.max > limit,
        ['max'],
        `${p.representation} can show at most ${limit}`,
      ),
      ...issueIf(
        p.mode === 'match-quantity' &&
          p.representation === 'objects' &&
          (p.objects ?? []).length === 0,
        ['objects'],
        'objects representation needs objects',
      ),
    ];
  },
  frameUses: (p) => [
    {
      frame: p.mode === 'hear' ? 'hear' : 'match',
      slots: { target: range(p.min, p.max) },
    },
  ],
});

export const TenFrameParamsSchema = z.strictObject({
  min: int(0, 20),
  max: int(1, 20),
  frame: z.literal([10, 20]).default(10),
  fill: z.enum(['ordered', 'scattered']).default('ordered'),
  choices: choices().default(3),
  answerMode: answerMode.default('choices'),
});

export const tenFrame = defineExerciseType({
  id: 'ten-frame',
  domain: 'math',
  description:
    'Read a quantity from a ten-frame (Zehnerfeld) or twenty-frame and tap it.',
  paramsSchema: TenFrameParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Wie viele Punkte siehst du?',
        'en-US': 'How many dots do you see?',
      },
    },
  },
  requirements: () => [],
  issues: (p) => [
    ...minMaxIssue(p),
    ...issueIf(
      p.max > p.frame,
      ['max'],
      `a ${p.frame}-frame holds at most ${p.frame}`,
    ),
  ],
  frameUses: () => [{ frame: 'main', slots: {} }],
});

export const CompareParamsSchema = z.strictObject({
  mode: z.enum(['quantities', 'numbers']).default('numbers'),
  min: int(0, 100),
  max: int(1, 100),
  allowEqual: z.boolean().default(true),
  maxDifference: int(1, 100).optional(),
  objects: z.array(PictureIdSchema).optional(),
});

export const compare = defineExerciseType({
  id: 'compare',
  domain: 'math',
  description: 'Tap <, > or = between two quantities or numbers.',
  paramsSchema: CompareParamsSchema,
  frames: {
    quantities: {
      speak: {
        'de-CH': 'Wo sind mehr? Oder sind es gleich viele?',
        'en-US': 'Which side has more? Or are they the same?',
      },
    },
    numbers: {
      speak: {
        'de-CH': '{number:a} und {number:b}. Welches Zeichen passt?',
        'en-US': '{number:a} and {number:b}. Which sign fits?',
      },
    },
  },
  requirements: (p) => pictureNeeds(p.objects ?? [], 'objects', ['word']),
  issues: (p, ctx) => [
    ...issueIf(
      ctx.minDistinct > 1 ? p.min >= p.max : p.min > p.max,
      ['min'],
      ctx.minDistinct > 1
        ? 'min must be smaller than max'
        : 'min must not exceed max',
    ),
    ...issueIf(
      p.mode === 'quantities' && p.max > 10,
      ['max'],
      'quantities show at most 10',
    ),
  ],
  frameUses: (p) =>
    p.mode === 'numbers'
      ? [
          {
            frame: 'numbers',
            slots: { a: range(p.min, p.max), b: range(p.min, p.max) },
          },
        ]
      : [{ frame: 'quantities', slots: {} }],
});

export const NumberLineParamsSchema = z.strictObject({
  mode: z.enum(['place', 'missing']).default('missing'),
  start: int(0, 100),
  end: int(1, 100),
  step: z.literal([1, 2, 5, 10]).default(1),
  labels: z.enum(['all', 'ends', 'tens', 'none']).default('ends'),
  choices: choices().default(3),
});

export const numberLine = defineExerciseType({
  id: 'number-line',
  domain: 'math',
  description:
    'Find a number on the number line (Zahlenstrahl) or name the missing one.',
  paramsSchema: NumberLineParamsSchema,
  frames: {
    place: {
      speak: {
        'de-CH': 'Wo ist die Zahl {number:target} auf dem Zahlenstrahl?',
        'en-US': 'Where is {number:target} on the number line?',
      },
    },
    missing: {
      speak: {
        'de-CH': 'Welche Zahl fehlt?',
        'en-US': 'Which number is missing?',
      },
    },
  },
  requirements: () => [],
  issues: (p) => {
    const span = p.end - p.start;
    const ticks = span / p.step;
    return [
      ...issueIf(span <= 0, ['end'], 'end must be larger than start'),
      ...issueIf(
        span > 0 && span % p.step !== 0,
        ['step'],
        'start to end must be a multiple of step',
      ),
      ...issueIf(
        span > 0 && (ticks < 4 || ticks > 20),
        ['step'],
        'the line needs between 4 and 20 steps',
      ),
    ];
  },
  frameUses: (p) =>
    p.mode === 'place'
      ? [{ frame: 'place', slots: { target: range(p.start, p.end, p.step) } }]
      : [{ frame: 'missing', slots: {} }],
});

const OperandRangeSchema = z.strictObject({
  min: int(0, 100),
  max: int(0, 100),
});

export const AddSubParamsSchema = z.strictObject({
  operations: z.array(z.enum(['add', 'sub'])).min(1),
  max: int(1, 100),
  a: OperandRangeSchema.optional(),
  b: OperandRangeSchema.optional(),
  aMultipleOf: z.literal([1, 10]).default(1),
  bMultipleOf: z.literal([1, 10]).default(1),
  crossTen: z.enum(['never', 'allowed', 'always']).default('allowed'),
  allowZero: z.boolean().default(false),
  unknown: z.enum(['result', 'operand']).default('result'),
  manipulatives: z
    .enum(['none', 'objects', 'ten-frame', 'twenty-frame'])
    .default('none'),
  objects: z.array(PictureIdSchema).optional(),
  answerMode: answerMode.default('choices'),
  choices: choices().default(3),
});
export type AddSubParams = z.output<typeof AddSubParamsSchema>;

export interface AddSubProblem {
  readonly op: 'add' | 'sub';
  readonly a: number;
  readonly b: number;
  readonly result: number;
}

export function crossesTen(op: 'add' | 'sub', a: number, b: number): boolean {
  return op === 'add' ? (a % 10) + (b % 10) >= 10 : a % 10 < b % 10;
}

export function enumerateAddSub(p: AddSubParams): AddSubProblem[] {
  const aRange = p.a ?? { min: 0, max: p.max };
  const bRange = p.b ?? { min: 0, max: p.max };
  const lowest = p.allowZero ? 0 : 1;
  const problems: AddSubProblem[] = [];
  for (const op of unique(p.operations)) {
    for (
      let a = Math.max(aRange.min, lowest);
      a <= Math.min(aRange.max, p.max);
      a += 1
    ) {
      for (
        let b = Math.max(bRange.min, lowest);
        b <= Math.min(bRange.max, p.max);
        b += 1
      ) {
        const result = op === 'add' ? a + b : a - b;
        const crosses = crossesTen(op, a, b);
        if (
          a % p.aMultipleOf === 0 &&
          b % p.bMultipleOf === 0 &&
          result >= lowest &&
          result <= p.max &&
          !(p.crossTen === 'never' && crosses) &&
          !(p.crossTen === 'always' && !crosses)
        ) {
          problems.push({ op, a, b, result });
        }
      }
    }
  }
  return problems;
}

const MANIPULATIVE_LIMITS = {
  none: 100,
  objects: 10,
  'ten-frame': 10,
  'twenty-frame': 20,
} as const;

function addSubIssues(p: AddSubParams, ctx: IssueContext): ParamIssue[] {
  const problems = enumerateAddSub(p);
  const limit = MANIPULATIVE_LIMITS[p.manipulatives];
  return [
    ...issueIf(
      problems.length < ctx.minDistinct,
      [],
      `only ${problems.length} distinct problems fit these params (need ${ctx.minDistinct})`,
    ),
    ...unique(p.operations).flatMap((op) =>
      issueIf(
        problems.length >= ctx.minDistinct &&
          !problems.some((x) => x.op === op),
        ['operations'],
        `no ${op === 'add' ? 'addition' : 'subtraction'} problem fits these params`,
      ),
    ),
    ...issueIf(
      p.max > limit,
      ['max'],
      `${p.manipulatives} can show at most ${limit}`,
    ),
    ...issueIf(
      p.manipulatives === 'objects' && (p.objects ?? []).length === 0,
      ['objects'],
      'objects manipulatives need objects',
    ),
    ...issueIf(
      p.unknown === 'operand' && p.operations.some((op) => op !== 'add'),
      ['unknown'],
      'a missing operand is only supported for addition',
    ),
    ...(p.a
      ? minMaxIssue(p.a).map((x) => ({ ...x, path: ['a', ...x.path] }))
      : []),
    ...(p.b
      ? minMaxIssue(p.b).map((x) => ({ ...x, path: ['b', ...x.path] }))
      : []),
  ];
}

export const addSub = defineExerciseType({
  id: 'add-sub',
  domain: 'math',
  description: 'Solve a + b or a - b, optionally with pictures or a ten-frame.',
  paramsSchema: AddSubParamsSchema,
  frames: {
    add: {
      speak: {
        'de-CH': 'Wie viel ist {number:a} plus {number:b}?',
        'en-US': 'What is {number:a} plus {number:b}?',
      },
    },
    sub: {
      speak: {
        'de-CH': 'Wie viel ist {number:a} minus {number:b}?',
        'en-US': 'What is {number:a} minus {number:b}?',
      },
    },
    'add-missing': {
      speak: {
        'de-CH': 'Wie viel fehlt von {number:a} bis {number:c}?',
        'en-US': 'What do you add to {number:a} to make {number:c}?',
      },
    },
  },
  requirements: (p) => pictureNeeds(p.objects ?? [], 'objects', ['word']),
  issues: addSubIssues,
  frameUses: (p) => {
    const problems = enumerateAddSub(p);
    if (p.unknown === 'operand') {
      return [
        {
          frame: 'add-missing',
          slots: {
            a: unique(problems.map((x) => x.a)),
            c: unique(problems.map((x) => x.result)),
          },
        },
      ];
    }
    return unique(p.operations).map((op) => {
      const own = problems.filter((x) => x.op === op);
      return {
        frame: op,
        slots: {
          a: unique(own.map((x) => x.a)),
          b: unique(own.map((x) => x.b)),
        },
      };
    });
  },
});

export const NumberBondParamsSchema = z.strictObject({
  min: int(1, 100),
  max: int(1, 100),
  rows: int(1, 6).default(1),
  missing: z.enum(['part', 'whole', 'mixed']).default('part'),
  allowZero: z.boolean().default(false),
  representation: z.enum(['numbers', 'dots']).default('numbers'),
});

export function bondCount(total: number, allowZero: boolean): number {
  return allowZero ? total + 1 : Math.max(total - 1, 0);
}

export const numberBond = defineExerciseType({
  id: 'number-bond',
  domain: 'math',
  description: 'Fill the missing parts in a number house (Zahlenhaus).',
  paramsSchema: NumberBondParamsSchema,
  frames: {
    one: {
      speak: {
        'de-CH': 'Welche Zahl fehlt im Zahlenhaus?',
        'en-US': 'Which number is missing in the number house?',
      },
    },
    many: {
      speak: {
        'de-CH': 'Welche Zahlen fehlen im Zahlenhaus?',
        'en-US': 'Which numbers are missing in the number house?',
      },
    },
  },
  requirements: () => [],
  issues: (p) => [
    ...minMaxIssue(p),
    ...issueIf(
      p.rows > bondCount(p.min, p.allowZero),
      ['rows'],
      `${p.min} has only ${bondCount(p.min, p.allowZero)} different splits`,
    ),
    ...issueIf(
      p.representation === 'dots' && p.max > 10,
      ['max'],
      'dots show at most 10',
    ),
  ],
  frameUses: (p) => {
    const frames = new Set<string>();
    if (p.missing !== 'whole') {
      frames.add(p.rows === 1 ? 'one' : 'many');
    }
    if (p.missing !== 'part') {
      frames.add('one');
    }
    return [...frames].map((frame) => ({ frame, slots: {} }));
  },
});

export const NumberWallParamsSchema = z.strictObject({
  rows: z.literal([2, 3]).default(3),
  max: int(2, 100),
  blanks: int(1, 3).default(1),
  blankPosition: z.enum(['top', 'any']).default('top'),
  allowZero: z.boolean().default(false),
});

export const numberWall = defineExerciseType({
  id: 'number-wall',
  domain: 'math',
  description: 'Fill the empty bricks of a number wall (Rechenmauer).',
  paramsSchema: NumberWallParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Fülle die leeren Steine aus.',
        'en-US': 'Fill in the empty bricks.',
      },
    },
  },
  requirements: () => [],
  issues: (p) => {
    const smallestTop = p.allowZero ? 0 : p.rows === 2 ? 2 : 4;
    return [
      ...issueIf(
        p.rows === 2 && p.blanks > 1,
        ['blanks'],
        'a 2-row wall can only have 1 blank',
      ),
      ...issueIf(
        p.max < smallestTop + 2,
        ['max'],
        `max must be at least ${smallestTop + 2}`,
      ),
    ];
  },
  frameUses: () => [{ frame: 'main', slots: {} }],
});

const NumberSequenceSchema = z.strictObject({
  kind: z.literal('numbers'),
  min: int(0, 100),
  max: int(1, 100),
  step: int(1, 10).default(1),
  direction: z.enum(['up', 'down']).default('up'),
  length: int(3, 6).default(4),
  ask: z.enum(['next', 'before', 'missing']).default('next'),
  choices: choices().default(3),
  answerMode: answerMode.default('choices'),
});

const PatternSequenceSchema = z.strictObject({
  kind: z.literal('pattern'),
  pictures: z.array(PictureIdSchema).min(2).max(4),
  unit: z.enum(['AB', 'AAB', 'ABB', 'ABC', 'AABB']).default('AB'),
  shown: int(4, 10).default(6),
  choices: choices(4).default(2),
});

export const SequenceParamsSchema = z.discriminatedUnion('kind', [
  NumberSequenceSchema,
  PatternSequenceSchema,
]);

export const sequence = defineExerciseType({
  id: 'sequence',
  domain: 'math',
  description: 'Say what comes next in a number sequence or a picture pattern.',
  paramsSchema: SequenceParamsSchema,
  frames: {
    next: {
      speak: { 'de-CH': 'Was kommt danach?', 'en-US': 'What comes next?' },
    },
    before: {
      speak: { 'de-CH': 'Was kommt davor?', 'en-US': 'What comes before?' },
    },
    missing: {
      speak: {
        'de-CH': 'Welche Zahl fehlt?',
        'en-US': 'Which number is missing?',
      },
    },
    pattern: {
      speak: {
        'de-CH': 'Was kommt als Nächstes im Muster?',
        'en-US': 'What comes next in the pattern?',
      },
    },
  },
  requirements: (p) =>
    p.kind === 'pattern' ? pictureNeeds(p.pictures, 'pictures', []) : [],
  issues: (p) => {
    if (p.kind === 'numbers') {
      return [
        ...issueIf(
          (p.length - 1) * p.step > p.max - p.min,
          ['length'],
          'the sequence does not fit between min and max',
        ),
      ];
    }
    const symbols = new Set(p.unit).size;
    return [
      ...issueIf(
        symbols > p.pictures.length,
        ['pictures'],
        `pattern ${p.unit} needs ${symbols} pictures`,
      ),
      ...issueIf(
        p.choices > p.pictures.length,
        ['choices'],
        'choices exceed the pictures',
      ),
    ];
  },
  frameUses: (p) => [
    { frame: p.kind === 'pattern' ? 'pattern' : p.ask, slots: {} },
  ],
});

export const ShapePickParamsSchema = z.strictObject({
  shapes: z.array(PictureIdSchema).min(2),
  choices: choices().default(3),
  varySize: z.boolean().default(false),
  varyRotation: z.boolean().default(false),
});

export const shapePick = defineExerciseType({
  id: 'shape-pick',
  domain: 'math',
  description: 'Tap the named shape.',
  paramsSchema: ShapePickParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Wo ist {the-word:shape}?',
        'en-US': 'Where is {the-word:shape}?',
      },
    },
  },
  requirements: (p) =>
    pictureNeeds(p.shapes, 'shapes', ['word', 'article'], { tag: 'shape' }),
  issues: (p) => [
    ...issueIf(
      p.choices > p.shapes.length,
      ['choices'],
      'choices exceed the shapes',
    ),
  ],
  frameUses: (p) => [{ frame: 'main', slots: { shape: p.shapes } }],
});
