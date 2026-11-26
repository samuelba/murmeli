import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { TRANSLATIONS } from '../../../testing/i18n';
import { resetDocumentState, stubNavigatorLanguages } from '../../../testing/browser';
import { provideI18n } from './provide-i18n';

describe('provideI18n', () => {
  beforeEach(() => {
    stubNavigatorLanguages(['en-US']);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideI18n()],
    });
  });

  afterEach(() => resetDocumentState());

  it('loads the initial language from /i18n before startup', async () => {
    const transloco = TestBed.inject(TranslocoService);
    TestBed.inject(HttpTestingController)
      .expectOne('/i18n/en-US.json')
      .flush(TRANSLATIONS['en-US']);
    await vi.waitFor(() => expect(transloco.translate('login.title')).toBe('Sign in'));

    expect(TestBed.inject(LOCALE_ID)).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });
});
