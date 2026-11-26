import { initialSoundPictures, unique } from '../exercises/common.ts';
import { renderPrompt } from '../exercises/frames.ts';
import type { ExerciseParams, ExerciseTypeId } from '../exercises/registry.ts';
import type { Locale } from '../locale.ts';
import type { Picture } from '../pictures.ts';
import {
  ChoiceAnswerSchema,
  CountAnswerSchema,
  LettersAnswerSchema,
} from './answers.ts';
import type { ChoiceAnswer, CountAnswer, LettersAnswer } from './answers.ts';
import { pickFocus, withIds } from './helpers.ts';
import type { Rng } from './rng.ts';
import type {
  BuildWordPayload,
  Choice,
  ExerciseRuntime,
  InitialSoundPayload,
  LetterSoundPayload,
  RuntimeContext,
  SyllablesPayload,
  WordPicturePayload,
} from './types.ts';

type Params<K extends ExerciseTypeId> = ExerciseParams<K>;
type Display = 'upper' | 'lower' | 'pair';

export function displayGrapheme(
  grapheme: string,
  display: Display,
  locale: Locale,
): string {
  const lower = grapheme.toLocaleLowerCase(locale);
  return display === 'upper'
    ? grapheme
    : display === 'lower'
      ? lower
      : `${grapheme} ${lower}`;
}

export function caseWord(
  word: string,
  letterCase: 'upper' | 'natural',
  locale: Locale,
): string {
  return letterCase === 'upper' ? word.toLocaleUpperCase(locale) : word;
}

function picture(ctx: RuntimeContext, id: string): Picture {
  const found = ctx.content.pictures[id];
  if (found === undefined) {
    throw new RangeError(`unknown picture "${id}"`);
  }
  return found;
}

function wordOf(ctx: RuntimeContext, id: string): string {
  const word = picture(ctx, id).words[ctx.locale];
  if (word === undefined) {
    throw new RangeError(`picture "${id}" has no ${ctx.locale} word`);
  }
  return word;
}

function letterChoices(
  rng: Rng,
  target: string,
  pool: readonly string[],
  count: number,
  display: Display,
  locale: Locale,
): { choices: Choice[]; answer: string } {
  const others = rng.sample(
    unique(pool).filter((grapheme) => grapheme !== target),
    count - 1,
  );
  const choices = withIds(
    rng,
    rng.shuffle([target, ...others]).map((grapheme) => ({
      label: displayGrapheme(grapheme, display, locale),
    })),
  );
  const label = displayGrapheme(target, display, locale);
  return {
    choices,
    answer: choices.find((choice) => choice.label === label)!.id,
  };
}

function pictureChoices(
  rng: Rng,
  target: string,
  pool: readonly string[],
  count: number,
): { choices: Choice[]; answer: string } {
  const others = rng.sample(
    unique(pool).filter((id) => id !== target),
    count - 1,
  );
  const choices = withIds(
    rng,
    rng.shuffle([target, ...others]).map((pictureId) => ({ pictureId })),
  );
  return {
    choices,
    answer: choices.find((choice) => choice.pictureId === target)!.id,
  };
}

export const letterSoundRuntime: ExerciseRuntime<
  Params<'letter-sound'>,
  LetterSoundPayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const target = pickFocus(rng, p.letters, ctx);
    const { choices, answer } = letterChoices(
      rng,
      target,
      [...p.letters, ...p.distractors],
      p.choices,
      p.display,
      ctx.locale,
    );
    return {
      prompt: renderPrompt(ctx.content, 'letter-sound', 'main', ctx.locale, {
        target,
      }),
      payload: { choices },
      solution: { answer: { choiceId: answer }, hint: 'listen-to-the-sound' },
      focus: target,
    };
  },
};

export const initialSoundRuntime: ExerciseRuntime<
  Params<'initial-sound'>,
  InitialSoundPayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const target = ctx.demo?.target;
    const letters =
      typeof target === 'string' && p.letters.includes(target)
        ? [target]
        : p.letters;
    const candidates = unique(
      letters.flatMap((grapheme) =>
        initialSoundPictures(
          ctx.content.pictures,
          ctx.locale,
          grapheme,
          p.pictures,
        ),
      ),
    );
    const pictureId = pickFocus(rng, candidates, ctx);
    const grapheme = picture(ctx, pictureId).firstSound[ctx.locale]!.grapheme;
    const { choices, answer } = letterChoices(
      rng,
      grapheme,
      [...p.letters, ...p.distractors],
      p.choices,
      p.display,
      ctx.locale,
    );
    return {
      prompt: renderPrompt(ctx.content, 'initial-sound', 'main', ctx.locale, {
        picture: pictureId,
      }),
      payload: { pictureId, choices },
      solution: { answer: { choiceId: answer }, hint: 'first-sound' },
      focus: pictureId,
    };
  },
};

export const syllablesRuntime: ExerciseRuntime<
  Params<'syllables'>,
  SyllablesPayload,
  CountAnswer
> = {
  answerSchema: CountAnswerSchema,
  generate(rng, p, ctx) {
    const pictureId = pickFocus(rng, p.pictures, ctx);
    const syllables = picture(ctx, pictureId).syllables[ctx.locale] ?? [];
    return {
      prompt: renderPrompt(ctx.content, 'syllables', 'main', ctx.locale, {
        picture: pictureId,
      }),
      payload: {
        pictureId,
        maxCount: p.maxSyllables,
        ...(p.showWord ? { word: wordOf(ctx, pictureId) } : {}),
      },
      solution: { answer: { count: syllables.length }, hint: 'clap-along' },
      focus: pictureId,
    };
  },
};

export const wordPictureRuntime: ExerciseRuntime<
  Params<'word-picture'>,
  WordPicturePayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const target = pickFocus(rng, p.words, ctx);
    const { choices, answer } = pictureChoices(rng, target, p.words, p.choices);
    const syllables = picture(ctx, target).syllables[ctx.locale];
    return {
      prompt: renderPrompt(ctx.content, 'word-picture', 'main', ctx.locale, {}),
      payload: {
        word: caseWord(wordOf(ctx, target), p.case, ctx.locale),
        ...(p.showSyllables && syllables
          ? {
              syllables: syllables.map((part) =>
                caseWord(part, p.case, ctx.locale),
              ),
            }
          : {}),
        choices,
      },
      solution: { answer: { choiceId: answer }, hint: 'read-sound-by-sound' },
      focus: target,
    };
  },
};

const ALPHABET: Readonly<Record<Locale, string>> = {
  'de-CH': 'abcdefghijklmnopqrstuvwxyzäöü',
  'en-US': 'abcdefghijklmnopqrstuvwxyz',
};

export function wordLetters(word: string): string[] {
  return [...word].filter((char) => /\p{L}/u.test(char));
}

export function wordTiles(
  rng: Rng,
  ctx: RuntimeContext,
  pictureId: string,
  extraTiles: number,
  letterCase: 'upper' | 'natural',
): { letters: string[]; tiles: { id: string; letter: string }[] } {
  const letters = wordLetters(
    caseWord(wordOf(ctx, pictureId), letterCase, ctx.locale),
  );
  const lowerWord = letters.join('').toLocaleLowerCase(ctx.locale);
  const spare = [...ALPHABET[ctx.locale]].filter(
    (char) => !lowerWord.includes(char),
  );
  const extra = rng
    .sample(spare, extraTiles)
    .map((char) =>
      letterCase === 'upper' ? char.toLocaleUpperCase(ctx.locale) : char,
    );
  const tiles = withIds(
    rng,
    rng.shuffle([...letters, ...extra]).map((letter) => ({ letter })),
  );
  return { letters, tiles };
}

export const buildWordRuntime: ExerciseRuntime<
  Params<'build-word'>,
  BuildWordPayload,
  LettersAnswer
> = {
  answerSchema: LettersAnswerSchema,
  generate(rng, p, ctx) {
    const pictureId = pickFocus(rng, p.words, ctx);
    const { letters, tiles } = wordTiles(
      rng,
      ctx,
      pictureId,
      p.extraTiles,
      p.case,
    );
    return {
      prompt: p.audio
        ? renderPrompt(ctx.content, 'build-word', 'audio', ctx.locale, {
            picture: pictureId,
          })
        : renderPrompt(ctx.content, 'build-word', 'picture', ctx.locale, {}),
      payload: { pictureId, audio: p.audio, length: letters.length, tiles },
      solution: { answer: { letters }, hint: 'say-the-word-slowly' },
      focus: pictureId,
    };
  },
};
