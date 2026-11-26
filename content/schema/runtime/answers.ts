import { z } from 'zod';

const int = z.number().int().min(0).max(1000);

export const ValueAnswerSchema = z.strictObject({ value: int });
export const ChoiceAnswerSchema = z.strictObject({
  choiceId: z.string().min(1).max(32),
});
export const RelationAnswerSchema = z.strictObject({
  relation: z.enum(['lt', 'gt', 'eq']),
});
export const ValuesAnswerSchema = z.strictObject({
  values: z.array(int).min(1).max(12),
});
export const CellsAnswerSchema = z.strictObject({
  values: z.record(z.string().regex(/^r\dc\d$/), int),
});
export const CountAnswerSchema = z.strictObject({
  count: z.number().int().min(0).max(10),
});
export const LettersAnswerSchema = z.strictObject({
  letters: z.array(z.string().min(1).max(3)).min(1).max(12),
});
export const SequenceAnswerSchema = z.union([
  ValueAnswerSchema,
  ChoiceAnswerSchema,
]);

export type ValueAnswer = z.infer<typeof ValueAnswerSchema>;
export type ChoiceAnswer = z.infer<typeof ChoiceAnswerSchema>;
export type RelationAnswer = z.infer<typeof RelationAnswerSchema>;
export type ValuesAnswer = z.infer<typeof ValuesAnswerSchema>;
export type CellsAnswer = z.infer<typeof CellsAnswerSchema>;
export type CountAnswer = z.infer<typeof CountAnswerSchema>;
export type LettersAnswer = z.infer<typeof LettersAnswerSchema>;

const coordinate = z.number().finite().min(-20).max(120);
export const StrokesAnswerSchema = z.strictObject({
  strokes: z
    .array(
      z
        .array(z.tuple([coordinate, coordinate]))
        .min(1)
        .max(200),
    )
    .min(1)
    .max(6),
});
export const CoinsAnswerSchema = z.strictObject({
  coins: z
    .array(z.string().regex(/^[a-z]{3}-[0-9a-z]+$/))
    .min(1)
    .max(30),
});
export const MoneyAnswerSchema = z.union([
  ValueAnswerSchema,
  CoinsAnswerSchema,
  RelationAnswerSchema,
]);

export type StrokesAnswer = z.infer<typeof StrokesAnswerSchema>;
export type CoinsAnswer = z.infer<typeof CoinsAnswerSchema>;
