import { z } from 'zod';
import { GraphemeSchema, PictureIdSchema } from './ids.ts';
import { LocaleSchema } from './locale.ts';

export const ArticleSchema = z.enum(['der', 'die', 'das']);
export type Article = z.infer<typeof ArticleSchema>;

export const FirstSoundSchema = z.strictObject({
  grapheme: GraphemeSchema,
  phoneme: z.string().min(1),
  regular: z.boolean().default(true),
});
export type FirstSound = z.infer<typeof FirstSoundSchema>;

const word = z.string().trim().min(1);

export const PictureSchema = z.strictObject({
  file: z
    .string()
    .regex(/^[a-z0-9-]+\.svg$/, 'must be a file name like "apple.svg"'),
  source: z.discriminatedUnion('set', [
    z.strictObject({
      set: z.literal('noto-emoji'),
      codepoint: z.string().regex(/^[0-9a-f]{4,6}(?:_[0-9a-f]{4,6})*$/),
    }),
    z.strictObject({ set: z.literal('murmeli') }),
  ]),
  tags: z.array(z.string().regex(/^[a-z]+$/)).min(1),
  words: z.partialRecord(LocaleSchema, word),
  article: ArticleSchema.optional(),
  plural: z.partialRecord(LocaleSchema, word).default({}),
  syllables: z.partialRecord(LocaleSchema, z.array(word).min(1)).default({}),
  firstSound: z.partialRecord(LocaleSchema, FirstSoundSchema).default({}),
});
export type Picture = z.infer<typeof PictureSchema>;

export const PictureCatalogSchema = z.strictObject({
  pictures: z.record(PictureIdSchema, PictureSchema),
});
export type PictureCatalog = z.infer<typeof PictureCatalogSchema>;

export type PictureField =
  'word' | 'plural' | 'syllables' | 'firstSound' | 'article';
