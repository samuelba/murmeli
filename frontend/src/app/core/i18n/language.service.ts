import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SafeStorage } from '../storage/safe-storage';
import { Language, isLanguage, languageFromBrowser } from './languages';

export const LANGUAGE_STORAGE_KEY = 'mu-language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(SafeStorage);
  private readonly transloco = inject(TranslocoService);

  private readonly current = signal<Language>(this.initialLanguage());
  readonly language = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  /** The user's own choice: applied and remembered on this device. */
  setLanguage(language: Language): void {
    this.storage.set(LANGUAGE_STORAGE_KEY, language);
    this.useLanguage(language);
  }

  /** A session language (account or kid profile): applied but not remembered. */
  useLanguage(language: Language): void {
    this.current.set(language);
    this.apply(language);
  }

  /** Back to the remembered choice, or the browser language. */
  resetToPreference(): void {
    this.useLanguage(this.initialLanguage());
  }

  private apply(language: Language): void {
    this.document.documentElement.lang = language;
    this.transloco.setActiveLang(language);
  }

  private initialLanguage(): Language {
    const stored = this.storage.get(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) {
      return stored;
    }
    const navigator = this.document.defaultView?.navigator;
    return languageFromBrowser([...(navigator?.languages ?? []), navigator?.language ?? '']);
  }
}
