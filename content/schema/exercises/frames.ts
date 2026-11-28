import { carrierFor } from '../lexicon.ts';
import type { Lexicon } from '../lexicon.ts';
import { LOCALES } from '../locale.ts';
import type { Locale } from '../locale.ts';
import type { Picture } from '../pictures.ts';
import { EXERCISE_TYPE_IDS, EXERCISE_TYPES } from './registry.ts';
import type { ExerciseTypeId } from './registry.ts';
import type { PromptFrame, SlotKind, SlotValue } from './types.ts';

export const SLOT_KINDS: readonly SlotKind[] = [
  'number',
  'word',
  'plural',
  'the-word',
  'carrier',
  'letter',
  'text',
];

export type TemplatePart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'slot'; readonly kind: SlotKind; readonly name: string };

export type SpeakSegment =
  string | { readonly slot: string; readonly kind: SlotKind };

export interface Prompt {
  readonly text: string;
  readonly speak: readonly string[];
}

export interface PromptContent {
  readonly pictures: Readonly<Record<string, Picture>>;
  readonly lexicons: Readonly<Partial<Record<Locale, Lexicon>>>;
}

const SLOT_PATTERN = /\{([a-z-]+)(?::([A-Za-z]+))?\}/g;
const DEFINITE_ARTICLE: Readonly<Partial<Record<Locale, string>>> = {
  'en-US': 'the',
};

function isSlotKind(kind: string): kind is SlotKind {
  return (SLOT_KINDS as readonly string[]).includes(kind);
}

export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(SLOT_PATTERN)) {
    const [whole, kind = '', name] = match;
    if (!isSlotKind(kind)) {
      throw new Error(`unknown slot kind "${kind}" in "${template}"`);
    }
    if (match.index > last) {
      parts.push({ type: 'text', text: template.slice(last, match.index) });
    }
    parts.push({ type: 'slot', kind, name: name ?? kind });
    last = match.index + whole.length;
  }
  if (last < template.length) {
    parts.push({ type: 'text', text: template.slice(last) });
  }
  return parts;
}

export function cleanSegment(text: string): string | undefined {
  const cleaned = text.replace(/^[\s.,:;!?]+/u, '').trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : undefined;
}

export function speakSegments(template: string): SpeakSegment[] {
  return parseTemplate(template).flatMap((part): SpeakSegment[] => {
    if (part.type === 'slot') {
      return [{ slot: part.name, kind: part.kind }];
    }
    const cleaned = cleanSegment(part.text);
    return cleaned === undefined ? [] : [cleaned];
  });
}

export function staticSegments(template: string): string[] {
  return speakSegments(template).filter(
    (segment) => typeof segment === 'string',
  );
}

export const PROMPT_FRAMES = Object.fromEntries(
  EXERCISE_TYPE_IDS.map((id) => [id, EXERCISE_TYPES[id].frames]),
) as { readonly [K in ExerciseTypeId]: (typeof EXERCISE_TYPES)[K]['frames'] };

function frameSegments(frame: PromptFrame): Record<Locale, SpeakSegment[]> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, speakSegments(frame.speak[locale])]),
  ) as Record<Locale, SpeakSegment[]>;
}

export const PROMPT_FRAME_SEGMENTS: Readonly<
  Record<
    ExerciseTypeId,
    Readonly<Record<string, Readonly<Record<Locale, SpeakSegment[]>>>>
  >
> = Object.fromEntries(
  EXERCISE_TYPE_IDS.map((id) => [
    id,
    Object.fromEntries(
      Object.entries(
        EXERCISE_TYPES[id].frames as Record<string, PromptFrame>,
      ).map(([key, frame]) => [key, frameSegments(frame)]),
    ),
  ]),
) as Record<ExerciseTypeId, Record<string, Record<Locale, SpeakSegment[]>>>;

export function resolveSlot(
  content: PromptContent,
  kind: SlotKind,
  value: SlotValue,
  locale: Locale,
): string | undefined {
  const lexicon = content.lexicons[locale];
  const picture =
    typeof value === 'string' ? content.pictures[value] : undefined;
  switch (kind) {
    case 'number':
      return typeof value === 'number' &&
        lexicon?.numbers[String(value)] !== undefined
        ? String(value)
        : undefined;
    case 'word':
      return picture?.words[locale];
    case 'plural':
      return picture?.plural[locale];
    case 'the-word': {
      const word = picture?.words[locale];
      const article =
        locale === 'de-CH' ? picture?.article : DEFINITE_ARTICLE[locale];
      return word !== undefined && article !== undefined
        ? `${article} ${word}`
        : undefined;
    }
    case 'carrier':
      return lexicon && typeof value === 'string'
        ? carrierFor(lexicon, value)
        : undefined;
    case 'letter':
      return typeof value === 'string' && lexicon?.letters[value] !== undefined
        ? lexicon.letters[value].text
        : undefined;
    case 'text':
      return typeof value === 'string' && value !== '' ? value : undefined;
  }
}

export function frameOf(type: ExerciseTypeId, frame: string): PromptFrame {
  const frames = EXERCISE_TYPES[type].frames;
  const found = frames[frame];
  if (found === undefined) {
    throw new Error(`exercise type "${type}" has no prompt frame "${frame}"`);
  }
  return found;
}

export function frameSlots(
  type: ExerciseTypeId,
  frame: string,
): Readonly<Record<string, SlotKind>> {
  const template = frameOf(type, frame);
  const slots: Record<string, SlotKind> = {};
  for (const locale of LOCALES) {
    for (const part of parseTemplate(template.speak[locale])) {
      if (part.type === 'slot') {
        slots[part.name] = part.kind;
      }
    }
  }
  return slots;
}

export function renderPrompt(
  content: PromptContent,
  type: ExerciseTypeId,
  frame: string,
  locale: Locale,
  values: Readonly<Record<string, SlotValue>>,
): Prompt {
  const template = frameOf(type, frame);
  const resolve = (kind: SlotKind, name: string): string => {
    const value = values[name];
    const resolved =
      value === undefined
        ? undefined
        : resolveSlot(content, kind, value, locale);
    if (resolved === undefined) {
      throw new Error(
        `cannot fill slot "${name}" (${kind}) of ${type}.${frame} for ${locale}`,
      );
    }
    return resolved;
  };
  const speak = speakSegments(template.speak[locale]).map((segment) =>
    typeof segment === 'string' ? segment : resolve(segment.kind, segment.slot),
  );
  const text = parseTemplate((template.display ?? template.speak)[locale])
    .map((part) =>
      part.type === 'text' ? part.text : resolve(part.kind, part.name),
    )
    .join('');
  return { text, speak };
}
