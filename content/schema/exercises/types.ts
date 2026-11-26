import type { z } from 'zod';
import type { PathSegment } from '../issues.ts';
import type { Locale } from '../locale.ts';
import type { Picture, PictureField } from '../pictures.ts';

export type SlotKind =
  'number' | 'word' | 'plural' | 'the-word' | 'carrier' | 'letter';
export type SlotValue = number | string;

export type LocalizedTemplate = Readonly<Record<Locale, string>>;

export interface PromptFrame {
  readonly speak: LocalizedTemplate;
  readonly display?: LocalizedTemplate;
}

export interface PictureRequirement {
  readonly kind: 'picture';
  readonly id: string;
  readonly fields: readonly PictureField[];
  readonly path: readonly PathSegment[];
  readonly tag?: string;
  readonly maxSyllables?: number;
  readonly maxLength?: number;
  readonly initialIn?: readonly string[];
}

export interface CarrierRequirement {
  readonly kind: 'carrier';
  readonly grapheme: string;
  readonly path: readonly PathSegment[];
}

export interface InitialSoundRequirement {
  readonly kind: 'initial-sound';
  readonly grapheme: string;
  readonly pool?: readonly string[];
  readonly path: readonly PathSegment[];
}

export type Requirement =
  PictureRequirement | CarrierRequirement | InitialSoundRequirement;

export interface ParamIssue {
  readonly path: readonly PathSegment[];
  readonly message: string;
}

export interface FrameUse {
  readonly frame: string;
  readonly slots: Readonly<Record<string, readonly SlotValue[]>>;
}

export interface SlotContext {
  readonly locale: Locale;
  readonly pictures: Readonly<Record<string, Picture>>;
}

export interface IssueContext {
  readonly minDistinct: number;
}

export interface ExerciseTypeDef<S extends z.ZodType = z.ZodType> {
  readonly id: string;
  readonly domain: 'math' | 'literacy';
  readonly description: string;
  readonly paramsSchema: S;
  readonly frames: Readonly<Record<string, PromptFrame>>;
  requirements(params: z.output<S>): Requirement[];
  issues(params: z.output<S>, ctx: IssueContext): ParamIssue[];
  frameUses(params: z.output<S>, ctx: SlotContext): FrameUse[];
}

export function defineExerciseType<
  const Id extends string,
  S extends z.ZodType,
>(
  def: ExerciseTypeDef<S> & { readonly id: Id },
): ExerciseTypeDef<S> & { readonly id: Id } {
  return def;
}
