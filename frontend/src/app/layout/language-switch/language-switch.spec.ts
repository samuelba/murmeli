import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { LANGUAGE_STORAGE_KEY, LanguageService } from '../../core/i18n/language.service';
import {
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../testing/app-testing';
import { resetDocumentState, stubNavigatorLanguages } from '../../../testing/browser';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let language: LanguageService;

  beforeEach(() => {
    stubNavigatorLanguages(['de-CH']);
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    language = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    resetDocumentState();
  });

  const pick = (element: HTMLElement, lang: string) =>
    byTestId(element, `language-${lang}`).querySelector('button')?.click();

  it('remembers a guest choice on the device only', async () => {
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'en-US');
    await settle(fixture);
    expect(language.language()).toBe('en-US');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US');
  });

  it("saves a signed-in parent's choice to the account", async () => {
    auth.setUser(USER);
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'en-US');
    const req = http.expectOne('/api/account');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ locale: 'en-US' });
    req.flush({ user: { ...USER, locale: 'en-US' } });
    await settle(fixture);
    expect(auth.user()?.locale).toBe('en-US');
    expect(language.language()).toBe('en-US');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US');
  });

  it('reverts and reports when saving fails', async () => {
    auth.setUser(USER);
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'en-US');
    http
      .expectOne('/api/account')
      .flush(errorBody('INTERNAL', 500), { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(language.language()).toBe('de-CH');
    expect(auth.user()?.locale).toBe('de-CH');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    await vi.waitFor(() =>
      expect(document.querySelector('mat-snack-bar-container')?.textContent).toContain(
        'Die Sprache konnte nicht gespeichert werden.',
      ),
    );
  });

  it('locks the switch while saving', async () => {
    auth.setUser(USER);
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'en-US');
    await fixture.whenStable();
    expect(byTestId(element, 'language-de-CH').querySelector('button')?.disabled).toBe(true);
    http.expectOne('/api/account').flush({ user: { ...USER, locale: 'en-US' } });
    await settle(fixture);
    expect(byTestId(element, 'language-de-CH').querySelector('button')?.disabled).toBe(false);
  });

  it('keeps the guest language when the session ended during the save', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US');
    auth.setUser({ ...USER, locale: 'de-CH' });
    language.useLanguage('de-CH');
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'en-US');
    const unauthorized = { status: 401, statusText: 'x' };
    http.expectOne('/api/account').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/auth/refresh').flush(errorBody('SESSION_EXPIRED', 401), unauthorized);
    await settle(fixture);
    expect(auth.user()).toBeNull();
    expect(language.language()).toBe('en-US');
  });

  it('ignores a tap on the current language', async () => {
    auth.setUser(USER);
    const { element, fixture } = await renderComponent(LanguageSwitch);
    pick(element, 'de-CH');
    await settle(fixture);
    http.expectNone('/api/account');
  });
});
