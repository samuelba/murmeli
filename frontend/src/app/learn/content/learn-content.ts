import { Injectable, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { Language } from '../../core/i18n/languages';
import type { HintKey } from '../learn.models';
import data from './learn-content.json';

export const FEEDBACK_KINDS = [
  'correct',
  'almost',
  'try_again',
  'encourage',
  'hint',
  'solution',
  'level_done',
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

type Localized = Partial<Record<Language, string>>;

const PICTURES: Readonly<Record<string, Localized>> = data.pictures;
const HINT_TEXTS: Readonly<Record<string, Localized>> = data.hints;
const FEEDBACK: Readonly<Record<string, Partial<Record<FeedbackKind, readonly string[]>>>> =
  data.feedback;

const PICTURE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Only catalog-shaped ids become a URL; anything else renders an empty image. */
export function pictureUrl(id: string): string {
  return PICTURE_ID.test(id) ? `/pictures/${id}.svg` : 'data:,';
}

export function pictureWord(id: string, language: Language): string {
  const words = PICTURES[id];
  return words?.[language] ?? words?.['en-US'] ?? words?.['de-CH'] ?? id;
}

export function hintText(key: HintKey | string, language: Language): string | null {
  return HINT_TEXTS[key]?.[language] ?? null;
}

export function feedbackPhrases(kind: FeedbackKind, language: Language): readonly string[] {
  return FEEDBACK[language]?.[kind] ?? [];
}

/**
 * Words, hints and feedback phrases from `@murmeli/content`, copied by `npm run content:sync`
 * so the texts match the audio manifest exactly.
 */
@Injectable({ providedIn: 'root' })
export class LearnContent {
  private readonly language = inject(LanguageService).language;

  word(pictureId: string): string {
    return pictureWord(pictureId, this.language());
  }

  hint(key: HintKey | string | null | undefined): string | null {
    return key ? hintText(key, this.language()) : null;
  }

  phrase(kind: FeedbackKind, random: () => number = Math.random): string {
    const phrases = feedbackPhrases(kind, this.language());
    return phrases[Math.floor(random() * phrases.length)] ?? '';
  }
}
