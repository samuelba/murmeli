import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { KidMode } from '../kids/kid-mode';
import { LanguageService } from './language.service';

/** Kid mode speaks the kid profile's language; grown-up pages use the account language. */
@Injectable({ providedIn: 'root' })
export class SessionLanguage {
  private readonly auth = inject(AuthService);
  private readonly kidMode = inject(KidMode);
  private readonly languageService = inject(LanguageService);

  private readonly kidLanguage = computed(() => this.kidMode.kid()?.language);
  private readonly accountLanguage = computed(() => this.auth.user()?.locale);

  constructor() {
    effect(() => {
      const language = this.kidLanguage() ?? this.accountLanguage();
      if (language) {
        untracked(() => this.languageService.useLanguage(language));
      }
    });
  }
}
