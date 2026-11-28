import { z } from 'zod';
import type { ExerciseSpec } from './exercises/registry.ts';
import { SKILL_ID, SlugSchema } from './ids.ts';
import { LocaleSchema, LocalizedTextSchema } from './locale.ts';
import type { LocalizedText } from './locale.ts';

export const GRADES = ['KG1', 'KG2', '1', '2'] as const;
export const GradeSchema = z.preprocess(
  (value) => (typeof value === 'number' ? String(value) : value),
  z.enum(GRADES),
);
export type Grade = (typeof GRADES)[number];

export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade);
}

export const LP21_CODE = /^(MA|D)\.\d\.[A-Z]\.\d+(?:\.[a-z])?$/;
export const CCSS_CODE = /^[A-Z0-9]+(?:\.[A-Za-z0-9]+)+$/;

export const TrackSchema = z.strictObject({
  id: SlugSchema,
  order: z.number().int().min(1),
  locales: z
    .array(LocaleSchema)
    .min(1)
    .refine(
      (locales) => new Set(locales).size === locales.length,
      'locales must be unique',
    ),
  title: LocalizedTextSchema,
  icon: SlugSchema,
});
export type TrackData = z.infer<typeof TrackSchema>;

export const SkillSchema = z
  .strictObject({
    id: z.string().regex(SKILL_ID, 'must be a dotted id like "math.count.to5"'),
    lp21: z
      .string()
      .regex(LP21_CODE, 'must be a Lehrplan 21 code like "MA.1.A.1"')
      .optional(),
    ccss: z
      .string()
      .regex(CCSS_CODE, 'must be a Common Core code like "RF.K.3a"')
      .optional(),
    title: LocalizedTextSchema,
  })
  .refine((skill) => skill.lp21 !== undefined || skill.ccss !== undefined, {
    message: 'needs an lp21 or ccss reference',
  });
export type Skill = z.infer<typeof SkillSchema>;

export const HIGHLIGHT_TARGETS = [
  'prompt',
  'objects',
  'picture',
  'word',
  'letters',
  'numbers',
  'choices',
  'frame',
  'number-line',
  'house',
  'wall',
  'pattern',
  'shapes',
  'tiles',
  'drum',
  'signs',
  'clock',
  'calendar',
  'money',
  'plates',
  'sentence',
  'canvas',
] as const;

const ACTION_KEYS = [
  'highlight',
  'countAlong',
  'hop',
  'clap',
  'placeTiles',
  'fillBlank',
  'tapAnswer',
  'trace',
  'placeCoins',
] as const;

export const DemoActionSchema = z
  .strictObject({
    highlight: z.enum(HIGHLIGHT_TARGETS).optional(),
    countAlong: z.literal(true).optional(),
    hop: z.literal(true).optional(),
    clap: z.literal(true).optional(),
    placeTiles: z.literal(true).optional(),
    fillBlank: z.literal(true).optional(),
    tapAnswer: z.literal(true).optional(),
    trace: z.literal(true).optional(),
    placeCoins: z.literal(true).optional(),
  })
  .refine(
    (action) =>
      ACTION_KEYS.filter((key) => action[key] !== undefined).length === 1,
    {
      message: `needs exactly one of ${ACTION_KEYS.join(', ')}`,
    },
  );
export type DemoAction = z.infer<typeof DemoActionSchema>;

export const DemoStepSchema = z.strictObject({
  say: LocalizedTextSchema,
  action: DemoActionSchema,
});
export type DemoStep = z.infer<typeof DemoStepSchema>;

const RawExerciseSchema = z.strictObject({
  type: z.string().min(1),
  params: z.unknown(),
});

export const RawDemoSchema = z.strictObject({
  exercise: RawExerciseSchema,
  target: z
    .union([z.string().min(1), z.number().int().min(0).max(100)])
    .optional(),
  steps: z.array(DemoStepSchema).min(2).max(4),
});

export const RawGeneratorSchema = z.strictObject({
  type: z.string().min(1),
  weight: z.number().positive().default(1),
  params: z.unknown(),
});

export const RawLevelSchema = z.strictObject({
  id: SlugSchema,
  title: LocalizedTextSchema,
  skill: z.string().regex(SKILL_ID),
  items: z.number().int().min(3).max(20).default(6),
  passRatio: z.number().min(0.5).max(1).default(0.8),
  demo: RawDemoSchema,
  generators: z.array(RawGeneratorSchema).min(1),
});

export const RawWorldSchema = z.strictObject({
  id: SlugSchema,
  order: z.number().int().min(1),
  grade: GradeSchema,
  requires: z.array(SlugSchema).default([]),
  title: LocalizedTextSchema,
  scene: SlugSchema,
  skills: z.array(SkillSchema).min(1),
  levels: z.array(RawLevelSchema).min(1).max(12),
});
export type RawWorld = z.infer<typeof RawWorldSchema>;

export type Generator = ExerciseSpec & { readonly weight: number };

export interface Demo {
  readonly exercise: ExerciseSpec;
  readonly target?: string | number;
  readonly steps: readonly DemoStep[];
}

export interface Level {
  readonly id: string;
  readonly title: LocalizedText;
  readonly skill: string;
  readonly items: number;
  readonly passRatio: number;
  readonly demo: Demo;
  readonly generators: readonly Generator[];
}

export interface World {
  readonly id: string;
  readonly trackId: string;
  readonly file: string;
  readonly order: number;
  readonly grade: Grade;
  readonly requires: readonly string[];
  readonly title: LocalizedText;
  readonly scene: string;
  readonly skills: readonly Skill[];
  readonly levels: readonly Level[];
}

export interface Track extends Readonly<TrackData> {
  readonly worlds: readonly World[];
}
