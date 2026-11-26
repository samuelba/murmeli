import { z } from 'zod';
import { PictureIdSchema } from '../ids.ts';
import type { Locale } from '../locale.ts';
import type { Picture, PictureField } from '../pictures.ts';
import type { ParamIssue, PictureRequirement } from './types.ts';

export const int = (min: number, max: number) =>
  z.number().int().min(min).max(max);
export const choices = (max = 6) => int(2, max);
export const answerMode = z.enum(['choices', 'keypad']);
export const pictureList = z.array(PictureIdSchema).min(1);
export const letterCase = z.enum(['upper', 'natural']);

export function range(min: number, max: number, step = 1): number[] {
  const values: number[] = [];
  for (let n = min; n <= max; n += step) {
    values.push(n);
  }
  return values;
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

export function minMaxIssue(params: {
  min: number;
  max: number;
}): ParamIssue[] {
  return params.min > params.max
    ? [{ path: ['min'], message: 'min must not exceed max' }]
    : [];
}

export function issueIf(
  condition: boolean,
  path: ParamIssue['path'],
  message: string,
): ParamIssue[] {
  return condition ? [{ path, message }] : [];
}

export function pictureNeeds(
  ids: readonly string[],
  key: string,
  fields: readonly PictureField[],
  extra: Partial<
    Omit<PictureRequirement, 'kind' | 'id' | 'fields' | 'path'>
  > = {},
): PictureRequirement[] {
  return ids.map((id, index) => ({
    kind: 'picture',
    id,
    fields,
    path: [key, index],
    ...extra,
  }));
}

export function initialSoundPictures(
  pictures: Readonly<Record<string, Picture>>,
  locale: Locale,
  grapheme: string,
  pool?: readonly string[],
): string[] {
  const ids = pool ?? Object.keys(pictures);
  return ids.filter((id) => {
    const picture = pictures[id];
    const sound = picture?.firstSound[locale];
    return (
      picture?.words[locale] !== undefined &&
      sound !== undefined &&
      sound.regular &&
      sound.grapheme === grapheme
    );
  });
}
