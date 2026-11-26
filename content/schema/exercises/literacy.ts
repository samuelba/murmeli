import { z } from 'zod';
import { GraphemeSchema, PictureIdSchema } from '../ids.ts';
import {
  choices,
  initialSoundPictures,
  int,
  issueIf,
  letterCase,
  pictureNeeds,
  unique,
} from './common.ts';
import { defineExerciseType } from './types.ts';
import type { Requirement } from './types.ts';

const letterDisplay = z.enum(['upper', 'lower', 'pair']);
const graphemeList = z.array(GraphemeSchema).min(1);

function choiceIssues(
  letters: readonly string[],
  distractors: readonly string[],
  count: number,
) {
  const available = unique([...letters, ...distractors]).length;
  return issueIf(
    count > available,
    ['choices'],
    `needs ${count} different letters, only ${available} given`,
  );
}

export const LetterSoundParamsSchema = z.strictObject({
  letters: graphemeList,
  distractors: z.array(GraphemeSchema).default([]),
  choices: choices().default(3),
  display: letterDisplay.default('upper'),
});

export const letterSound = defineExerciseType({
  id: 'letter-sound',
  domain: 'literacy',
  description: 'Hear a sound (in a carrier word) and tap the letter.',
  paramsSchema: LetterSoundParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Hör gut zu: {carrier:target}. Welcher Buchstabe passt?',
        'en-US': 'Listen: {carrier:target}. Which letter is it?',
      },
      display: {
        'de-CH': 'Welcher Buchstabe passt?',
        'en-US': 'Which letter is it?',
      },
    },
  },
  requirements: (p) =>
    p.letters.map((grapheme, index) => ({
      kind: 'carrier',
      grapheme,
      path: ['letters', index],
    })),
  issues: (p) => choiceIssues(p.letters, p.distractors, p.choices),
  frameUses: (p) => [{ frame: 'main', slots: { target: p.letters } }],
});

export const InitialSoundParamsSchema = z.strictObject({
  letters: graphemeList,
  distractors: z.array(GraphemeSchema).default([]),
  pictures: z.array(PictureIdSchema).min(1).optional(),
  choices: choices(4).default(3),
  display: letterDisplay.default('upper'),
});

export const initialSound = defineExerciseType({
  id: 'initial-sound',
  domain: 'literacy',
  description:
    'See a picture, hear its word and tap the first letter (Anlaut).',
  paramsSchema: InitialSoundParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Hör gut zu: {word:picture}. Was hörst du am Anfang?',
        'en-US': 'Listen: {word:picture}. What sound do you hear first?',
      },
      display: {
        'de-CH': 'Was hörst du am Anfang?',
        'en-US': 'What sound do you hear first?',
      },
    },
  },
  requirements: (p): Requirement[] => [
    ...p.letters.map((grapheme, index): Requirement => ({
      kind: 'initial-sound',
      grapheme,
      ...(p.pictures ? { pool: p.pictures } : {}),
      path: ['letters', index],
    })),
    ...pictureNeeds(p.pictures ?? [], 'pictures', ['word', 'firstSound'], {
      initialIn: p.letters,
    }),
  ],
  issues: (p) => choiceIssues(p.letters, p.distractors, p.choices),
  frameUses: (p, ctx) => [
    {
      frame: 'main',
      slots: {
        picture: unique(
          p.letters.flatMap((g) =>
            initialSoundPictures(ctx.pictures, ctx.locale, g, p.pictures),
          ),
        ),
      },
    },
  ],
});

export const SyllablesParamsSchema = z.strictObject({
  pictures: z.array(PictureIdSchema).min(2),
  maxSyllables: int(1, 6).default(4),
  showWord: z.boolean().default(false),
});

export const syllables = defineExerciseType({
  id: 'syllables',
  domain: 'literacy',
  description:
    'Hear a word and tap the drum once per syllable (Silben klatschen).',
  paramsSchema: SyllablesParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Hör gut zu: {word:picture}. Wie viele Silben hörst du?',
        'en-US': 'Listen: {word:picture}. How many syllables do you hear?',
      },
    },
  },
  requirements: (p) =>
    pictureNeeds(p.pictures, 'pictures', ['word', 'syllables'], {
      maxSyllables: p.maxSyllables,
    }),
  issues: () => [],
  frameUses: (p) => [{ frame: 'main', slots: { picture: p.pictures } }],
});

export const WordPictureParamsSchema = z.strictObject({
  words: z.array(PictureIdSchema).min(2),
  choices: choices(4).default(3),
  case: letterCase.default('natural'),
  showSyllables: z.boolean().default(false),
});

export const wordPicture = defineExerciseType({
  id: 'word-picture',
  domain: 'literacy',
  description: 'Read a word and tap the matching picture.',
  paramsSchema: WordPictureParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Lies das Wort. Welches Bild passt?',
        'en-US': 'Read the word. Which picture matches?',
      },
    },
  },
  requirements: (p) =>
    pictureNeeds(
      p.words,
      'words',
      p.showSyllables ? ['word', 'syllables'] : ['word'],
    ),
  issues: (p) =>
    issueIf(
      p.choices > p.words.length,
      ['choices'],
      'choices exceed the words',
    ),
  frameUses: () => [{ frame: 'main', slots: {} }],
});

export const BuildWordParamsSchema = z.strictObject({
  words: z.array(PictureIdSchema).min(1),
  extraTiles: int(0, 4).default(0),
  audio: z.boolean().default(true),
  case: letterCase.default('natural'),
  maxLength: int(2, 10).default(6),
});

export const buildWord = defineExerciseType({
  id: 'build-word',
  domain: 'literacy',
  description: 'Build the word for a picture from letter tiles.',
  paramsSchema: BuildWordParamsSchema,
  frames: {
    audio: {
      speak: {
        'de-CH': 'Baue das Wort: {word:picture}',
        'en-US': 'Build the word: {word:picture}',
      },
      display: { 'de-CH': 'Baue das Wort.', 'en-US': 'Build the word.' },
    },
    picture: {
      speak: {
        'de-CH': 'Baue das Wort zum Bild.',
        'en-US': 'Build the word for the picture.',
      },
    },
  },
  requirements: (p) =>
    pictureNeeds(p.words, 'words', ['word'], { maxLength: p.maxLength }),
  issues: () => [],
  frameUses: (p) =>
    p.audio
      ? [{ frame: 'audio', slots: { picture: p.words } }]
      : [{ frame: 'picture', slots: {} }],
});
