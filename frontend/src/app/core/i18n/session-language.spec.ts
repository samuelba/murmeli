import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes } from '@angular/router';
import { KID, USER, provideAppTesting } from '../../../testing/app-testing';
import { resetDocumentState, stubNavigatorLanguages } from '../../../testing/browser';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from './language.service';
import { SessionLanguage } from './session-language';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: 'learn', component: Blank },
  { path: 'parent', component: Blank },
];

describe('SessionLanguage', () => {
  let auth: AuthService;
  let router: Router;
  let language: LanguageService;

  beforeEach(() => {
    stubNavigatorLanguages(['de-CH']);
    TestBed.configureTestingModule({ providers: provideAppTesting(ROUTES) });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    language = TestBed.inject(LanguageService);
    TestBed.inject(SessionLanguage);
  });

  afterEach(() => resetDocumentState());

  it('keeps the device language for guests', () => {
    TestBed.tick();
    expect(language.language()).toBe('de-CH');
  });

  it('uses the account language for a signed-in parent', () => {
    auth.setUser({ ...USER, locale: 'en-US' });
    TestBed.tick();
    expect(language.language()).toBe('en-US');
  });

  it("uses the kid profile's language in kid mode", async () => {
    auth.setUser({ ...USER, locale: 'de-CH' });
    auth.setActiveKid({ ...KID, language: 'en-US' });
    await router.navigateByUrl('/learn');
    TestBed.tick();
    expect(language.language()).toBe('en-US');
  });

  it('switches to the account language on parent pages and back for the kid', async () => {
    auth.setUser({ ...USER, locale: 'de-CH' });
    auth.setActiveKid({ ...KID, language: 'en-US' });
    await router.navigateByUrl('/parent');
    TestBed.tick();
    expect(language.language()).toBe('de-CH');

    await router.navigateByUrl('/learn');
    TestBed.tick();
    expect(language.language()).toBe('en-US');
  });

  it('follows a changed account language', () => {
    auth.setUser({ ...USER, locale: 'de-CH' });
    TestBed.tick();
    auth.setUser({ ...USER, locale: 'en-US' });
    TestBed.tick();
    expect(language.language()).toBe('en-US');
  });
});
