import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { resetDocumentState, stubNavigatorLanguages } from '../../../testing/browser';
import { LANGUAGE_STORAGE_KEY, LanguageService } from './language.service';

describe('LanguageService', () => {
  function create(): LanguageService {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    return TestBed.inject(LanguageService);
  }

  afterEach(() => resetDocumentState());

  it('uses the stored language first', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US');
    stubNavigatorLanguages(['de-CH']);

    expect(create().language()).toBe('en-US');
  });

  it('falls back to German for German browsers', () => {
    stubNavigatorLanguages(['de-DE', 'en']);

    expect(create().language()).toBe('de-CH');
  });

  it('falls back to English for other browsers', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr-FR');
    stubNavigatorLanguages(['fr-FR']);

    expect(create().language()).toBe('en-US');
  });

  it('applies the initial language to <html lang> and Transloco', () => {
    stubNavigatorLanguages(['de-CH']);
    create();

    expect(document.documentElement.lang).toBe('de-CH');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('de-CH');
  });

  it('switches, persists and applies a new language', () => {
    stubNavigatorLanguages(['de-CH']);
    const service = create();

    service.setLanguage('en-US');

    expect(service.language()).toBe('en-US');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en-US');
  });
});
