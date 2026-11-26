import { z } from 'zod';
import { GraphemeSchema } from './ids.ts';

const text = z.string().trim().min(1);
const labelled = z.strictObject({ text, speak: text });
const wordMap = z.record(z.string().regex(/^[a-z_]+$/), text);

export const FEEDBACK_KINDS = [
  'correct',
  'almost',
  'try_again',
  'encourage',
  'hint',
  'solution',
  'level_done',
] as const;

export const LexiconSchema = z.strictObject({
  speak: z.literal(false),
  numbers: z.record(z.string().regex(/^\d+$/), labelled),
  operators: wordMap,
  frames: wordMap,
  letters: z.record(GraphemeSchema, labelled),
  carriers: z.record(GraphemeSchema, text),
  digraphs: z.record(GraphemeSchema, text).default({}),
  comparison: wordMap,
  ordinals: z.record(z.string().regex(/^\d+$/), text),
  positions: wordMap,
  feedback: z.strictObject(
    Object.fromEntries(
      FEEDBACK_KINDS.map((kind) => [kind, z.array(text).min(1)]),
    ) as Record<(typeof FEEDBACK_KINDS)[number], z.ZodArray<typeof text>>,
  ),
});
export type Lexicon = z.infer<typeof LexiconSchema>;

export const LEXICON_NUMBER_MAX = 100;

export function lexiconIssues(
  lexicon: Lexicon,
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let n = 0; n <= LEXICON_NUMBER_MAX; n += 1) {
    const entry = lexicon.numbers[String(n)];
    if (entry === undefined) {
      issues.push({ path: ['numbers'], message: `number ${n} is missing` });
    } else if (entry.text !== String(n)) {
      issues.push({
        path: ['numbers', String(n), 'text'],
        message: `must be "${n}"`,
      });
    }
  }
  for (const [key, entry] of Object.entries(lexicon.letters)) {
    if (entry.text !== key) {
      issues.push({
        path: ['letters', key, 'text'],
        message: `must be "${key}"`,
      });
    }
  }
  return issues;
}

export function carrierFor(
  lexicon: Lexicon,
  grapheme: string,
): string | undefined {
  return lexicon.carriers[grapheme] ?? lexicon.digraphs[grapheme];
}
