import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { AudioService } from './core/audio/audio.service';
import { AuthService } from './core/auth/auth.service';
import { provideAppHttp } from './core/http/provide-http';
import { provideI18n } from './core/i18n/provide-i18n';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { SPEAK_PROVIDER } from './shared/speak/speak-provider';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideAppHttp(),
    provideI18n(),
    provideAppInitializer(() => inject(AuthService).init()),
    { provide: SPEAK_PROVIDER, useExisting: AudioService },
  ],
};
