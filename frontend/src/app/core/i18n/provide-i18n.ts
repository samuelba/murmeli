import {
  EnvironmentProviders,
  LOCALE_ID,
  Provider,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from './language.service';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, LANGUAGES, registerAppLocales } from './languages';
import { TranslocoHttpLoader } from './transloco-loader';

export function provideI18n(): (Provider | EnvironmentProviders)[] {
  registerAppLocales();
  return [
    provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: FALLBACK_LANGUAGE,
        reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: LOCALE_ID, useFactory: () => inject(LanguageService).language() },
    provideAppInitializer(() => {
      const language = inject(LanguageService).language();
      return firstValueFrom(inject(TranslocoService).load(language));
    }),
  ];
}
