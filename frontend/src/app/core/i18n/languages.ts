import { registerLocaleData } from '@angular/common';
import localeDeCh from '@angular/common/locales/de-CH';
import localeEn from '@angular/common/locales/en';

export const LANGUAGES = ['de-CH', 'en-US'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'de-CH';
export const FALLBACK_LANGUAGE: Language = 'en-US';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

export function languageFromBrowser(candidates: readonly string[]): Language {
  const first = candidates.find((candidate) => candidate.trim() !== '');
  return first?.toLowerCase().startsWith('de') ? 'de-CH' : FALLBACK_LANGUAGE;
}

export function registerAppLocales(): void {
  registerLocaleData(localeDeCh, 'de-CH');
  registerLocaleData(localeEn, 'en-US');
}
