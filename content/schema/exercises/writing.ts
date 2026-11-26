import { z } from 'zod';
import { GLYPHS } from '../glyphs.ts';
import { PictureIdSchema } from '../ids.ts';
import { MAX_SENTENCE_COUNT, RELATIONS, sceneSentence } from '../sentences.ts';
import type { Scene } from '../sentences.ts';
import {
  choices,
  int,
  issueIf,
  letterCase,
  pictureNeeds,
  range,
  unique,
} from './common.ts';
import { defineExerciseType } from './types.ts';
import type { Requirement } from './types.ts';

const isDigit = (char: string) => /^\d$/.test(char);

export const TraceLetterParamsSchema = z.strictObject({
  letters: z
    .array(
      z
        .string()
        .refine((char) => Object.hasOwn(GLYPHS, char), 'has no stroke data'),
    )
    .min(1),
  tolerance: z.number().min(0.5).max(3).default(1),
  strictOrder: z.boolean().default(false),
  strictDirection: z.boolean().default(true),
  showModel: z.boolean().default(true),
});

export const traceLetter = defineExerciseType({
  id: 'trace-letter',
  domain: 'literacy',
  description:
    'Trace a letter or digit along its model strokes (Basisschrift-like print).',
  paramsSchema: TraceLetterParamsSchema,
  frames: {
    letter: {
      speak: {
        'de-CH': '{letter:target}. Fahre den Buchstaben nach.',
        'en-US': '{letter:target}. Trace the letter.',
      },
    },
    digit: {
      speak: {
        'de-CH': '{number:target}. Fahre die Zahl nach.',
        'en-US': '{number:target}. Trace the number.',
      },
    },
  },
  requirements: (p) =>
    p.letters.flatMap((char, index): Requirement[] =>
      isDigit(char)
        ? []
        : [
            {
              kind: 'letter',
              letter: char.toLocaleUpperCase('de-CH'),
              path: ['letters', index],
            },
          ],
    ),
  issues: () => [],
  frameUses: (p) => {
    const letters = unique(
      p.letters
        .filter((c) => !isDigit(c))
        .map((c) => c.toLocaleUpperCase('de-CH')),
    );
    const digits = unique(p.letters.filter(isDigit).map(Number));
    return [
      ...(letters.length > 0
        ? [{ frame: 'letter', slots: { target: letters } }]
        : []),
      ...(digits.length > 0
        ? [{ frame: 'digit', slots: { target: digits } }]
        : []),
    ];
  },
});

export const ListenWriteParamsSchema = z.strictObject({
  words: z.array(PictureIdSchema).min(1),
  extraTiles: int(0, 4).default(0),
  case: letterCase.default('natural'),
  maxLength: int(2, 6).default(5),
});

export const listenWrite = defineExerciseType({
  id: 'listen-write',
  domain: 'literacy',
  description:
    'Hear a short regular word (no picture) and build it from letter tiles.',
  paramsSchema: ListenWriteParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Hör gut zu: {word:picture}. Schreib das Wort.',
        'en-US': 'Listen: {word:picture}. Write the word.',
      },
      display: {
        'de-CH': 'Schreib das Wort, das du hörst.',
        'en-US': 'Write the word you hear.',
      },
    },
  },
  requirements: (p) =>
    pictureNeeds(p.words, 'words', ['word', 'firstSound'], {
      maxLength: p.maxLength,
      regularFirstSound: true,
    }),
  issues: () => [],
  frameUses: (p) => [{ frame: 'main', slots: { picture: p.words } }],
});

const PositionSentenceSchema = z.strictObject({
  kind: z.literal('position'),
  subjects: z.array(PictureIdSchema).min(1),
  objects: z.array(PictureIdSchema).min(1),
  relations: z
    .array(z.enum(RELATIONS))
    .min(1)
    .default([...RELATIONS]),
  choices: choices(4).default(3),
});

const CountSentenceSchema = z.strictObject({
  kind: z.literal('count'),
  pictures: z.array(PictureIdSchema).min(1),
  min: int(2, MAX_SENTENCE_COUNT).default(2),
  max: int(2, MAX_SENTENCE_COUNT).default(MAX_SENTENCE_COUNT),
  choices: choices(4).default(3),
});

export const SentencePictureParamsSchema = z.discriminatedUnion('kind', [
  PositionSentenceSchema,
  CountSentenceSchema,
]);
export type SentencePictureParams = z.output<
  typeof SentencePictureParamsSchema
>;

export function sentenceScenes(p: SentencePictureParams): Scene[] {
  if (p.kind === 'count') {
    return unique(p.pictures).flatMap((pictureId) =>
      range(p.min, p.max).map((count): Scene => ({
        kind: 'count',
        pictureId,
        count,
      })),
    );
  }
  return unique(p.subjects).flatMap((subject) =>
    unique(p.objects)
      .filter((object) => object !== subject)
      .flatMap((object) =>
        unique(p.relations).map((relation): Scene => ({
          kind: 'position',
          subject,
          relation,
          object,
        })),
      ),
  );
}

export const sentencePicture = defineExerciseType({
  id: 'sentence-picture',
  domain: 'literacy',
  description: 'Read a short sentence and tap the matching picture.',
  paramsSchema: SentencePictureParamsSchema,
  frames: {
    main: {
      speak: {
        'de-CH': 'Lies den Satz. Welches Bild passt?',
        'en-US': 'Read the sentence. Which picture matches?',
      },
    },
  },
  requirements: (p) =>
    p.kind === 'count'
      ? pictureNeeds(p.pictures, 'pictures', ['plural'])
      : [
          ...pictureNeeds(p.subjects, 'subjects', ['word', 'article']),
          ...pictureNeeds(p.objects, 'objects', ['word', 'article']),
        ],
  issues: (p) => [
    ...(p.kind === 'count'
      ? issueIf(p.min > p.max, ['min'], 'min must not exceed max')
      : []),
    ...issueIf(
      sentenceScenes(p).length < p.choices,
      ['choices'],
      `only ${sentenceScenes(p).length} different pictures fit these params`,
    ),
  ],
  frameUses: () => [{ frame: 'main', slots: {} }],
  labels: (p, ctx) =>
    sentenceScenes(p).flatMap(
      (scene) => sceneSentence(scene, ctx.pictures, ctx.locale) ?? [],
    ),
});
