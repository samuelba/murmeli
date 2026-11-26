import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import deCh from '../../public/i18n/de-CH.json';
import enUs from '../../public/i18n/en-US.json';
import { DEFAULT_LANGUAGE, LANGUAGES } from '../app/core/i18n/languages';

export const TRANSLATIONS = { 'de-CH': deCh, 'en-US': enUs };

export function provideTranslocoTesting(): EnvironmentProviders {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: TRANSLATIONS,
      translocoConfig: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
      },
      preloadLangs: true,
    }),
  );
}
