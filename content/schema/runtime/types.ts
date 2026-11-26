import type { z } from 'zod';
import type { Prompt, PromptContent } from '../exercises/frames.ts';
import type { Locale } from '../locale.ts';
import type { HintKey } from './hints.ts';
import type { Rng } from './rng.ts';

export interface Choice {
  readonly id: string;
  readonly label?: string;
  readonly pictureId?: string;
  readonly value?: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RuntimeContext {
  readonly locale: Locale;
  readonly content: PromptContent;
  readonly demo?: { readonly target?: string | number };
}

export type CheckRule =
  | {
      readonly kind: 'coin-sum';
      readonly amount: number;
      readonly values: Readonly<Record<string, number>>;
    }
  | {
      readonly kind: 'trace';
      readonly glyph: string;
      readonly tolerance: number;
      readonly strictOrder: boolean;
      readonly strictDirection: boolean;
    };

export interface Solution<A> {
  readonly answer: A;
  readonly hint: HintKey;
  readonly rule?: CheckRule;
}

export interface CheckResult {
  readonly correct: boolean;
  readonly hint?: HintKey;
}

export interface Generated<P, A> {
  readonly prompt: Prompt;
  readonly payload: P;
  readonly solution: Solution<A>;
  readonly focus: string | number;
}

export interface ExerciseRuntime<Params, P, A> {
  readonly answerSchema: z.ZodType<A>;
  generate(rng: Rng, params: Params, ctx: RuntimeContext): Generated<P, A>;
}

export type AnswerMode = 'choices' | 'keypad';

export interface CountObjectsPayload {
  readonly arrangement: 'line' | 'dice' | 'scattered' | 'ten-frame';
  readonly objects: readonly ({ readonly pictureId: string } & Point)[];
  readonly answerMode: AnswerMode;
  readonly choices?: readonly Choice[];
}

export interface NumberRecognitionPayload {
  readonly mode: 'hear' | 'match-quantity';
  readonly representation:
    'numeral' | 'dots' | 'ten-frame' | 'fingers' | 'objects';
  readonly pictureId?: string;
  readonly choices: readonly Choice[];
}

export interface TenFramePayload {
  readonly frame: 10 | 20;
  readonly cells: readonly boolean[];
  readonly answerMode: AnswerMode;
  readonly choices?: readonly Choice[];
}

export interface CompareSide {
  readonly value?: number;
  readonly count?: number;
  readonly pictureId?: string;
}

export interface ComparePayload {
  readonly mode: 'quantities' | 'numbers';
  readonly left: CompareSide;
  readonly right: CompareSide;
}

export interface NumberLinePayload {
  readonly mode: 'place' | 'missing';
  readonly start: number;
  readonly end: number;
  readonly step: number;
  readonly labels: readonly number[];
  readonly markedTick?: number;
  readonly choices?: readonly Choice[];
}

export interface AddSubPayload {
  readonly op: 'add' | 'sub';
  readonly a: number;
  readonly b: number | null;
  readonly result: number | null;
  readonly manipulatives: 'none' | 'objects' | 'ten-frame' | 'twenty-frame';
  readonly pictureId?: string;
  readonly answerMode: AnswerMode;
  readonly choices?: readonly Choice[];
}

export interface NumberBondPayload {
  readonly whole: number | null;
  readonly rows: readonly {
    readonly left: number | null;
    readonly right: number | null;
  }[];
  readonly representation: 'numbers' | 'dots';
}

export interface WallCell {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly value: number | null;
}

export interface NumberWallPayload {
  readonly rows: 2 | 3;
  readonly cells: readonly WallCell[];
}

export type SequencePayload =
  | {
      readonly kind: 'numbers';
      readonly items: readonly (number | null)[];
      readonly answerMode: AnswerMode;
      readonly choices?: readonly Choice[];
    }
  | {
      readonly kind: 'pattern';
      readonly items: readonly { readonly pictureId: string }[];
      readonly choices: readonly Choice[];
    };

export interface ShapeChoice extends Choice {
  readonly pictureId: string;
  readonly scale: number;
  readonly rotation: number;
}

export interface ShapePickPayload {
  readonly choices: readonly ShapeChoice[];
}

export interface LetterSoundPayload {
  readonly choices: readonly Choice[];
}

export interface InitialSoundPayload {
  readonly pictureId: string;
  readonly choices: readonly Choice[];
}

export interface SyllablesPayload {
  readonly pictureId: string;
  readonly word?: string;
  readonly maxCount: number;
}

export interface WordPicturePayload {
  readonly word: string;
  readonly syllables?: readonly string[];
  readonly choices: readonly Choice[];
}

export interface BuildWordPayload {
  readonly pictureId: string;
  readonly audio: boolean;
  readonly length: number;
  readonly tiles: readonly { readonly id: string; readonly letter: string }[];
}
