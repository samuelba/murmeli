import { z } from 'zod';

export const LOCALES = ['de-CH', 'en-US'] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

const ESZETT = /[\u00DF\u1E9E]/u;

export function containsEszett(text: string): boolean {
  return ESZETT.test(text);
}

export const NO_ESZETT_MESSAGE =
  'de-CH text must use "ss" instead of the sharp s';

export const LocalizedTextSchema = z
  .partialRecord(LocaleSchema, z.string().trim().min(1))
  .refine((text) => Object.keys(text).length > 0, {
    message: 'needs at least one locale',
  })
  .superRefine((text, ctx) => {
    const de = text['de-CH'];
    if (de !== undefined && containsEszett(de)) {
      ctx.addIssue({
        code: 'custom',
        path: ['de-CH'],
        message: NO_ESZETT_MESSAGE,
      });
    }
  });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export function missingLocales(
  text: LocalizedText,
  locales: readonly Locale[],
): Locale[] {
  return locales.filter((locale) => text[locale] === undefined);
}
