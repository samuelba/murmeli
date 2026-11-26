import { z } from 'zod';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_ID =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
export const GRAPHEME = /^[A-ZÄÖÜ][a-zäöü]{0,2}$/u;

export const SlugSchema = z.string().regex(SLUG, 'must be a kebab-case id');
export const PictureIdSchema = z
  .string()
  .regex(SLUG, 'must be a kebab-case picture id');
export const GraphemeSchema = z
  .string()
  .regex(
    GRAPHEME,
    'must be a capitalized letter or letter group, e.g. "M" or "Sch"',
  );
