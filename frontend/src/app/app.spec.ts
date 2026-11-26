import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { BRAND_NAME } from './core/brand';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { USER, byTestId, provideAppTesting, settle } from '../testing/app-testing';
import { resetDocumentState } from '../testing/browser';

describe('App shell', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(routes),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => resetDocumentState());

  async function render(url = '/', config = { registrationEnabled: true, setupRequired: false }) {
    const loaded = TestBed.inject(AuthService).loadConfig();
    http.expectOne('/api/auth/config').flush({ emailEnabled: true, ...config });
    await loaded;
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, page: element.querySelector('main') as HTMLElement };
  }

  it('shows the brand, theme toggle and language switch', async () => {
    const { element } = await render();

    expect(byTestId(element, 'brand-link').textContent).toContain(BRAND_NAME);
    expect(element.querySelector('mu-logo svg')).not.toBeNull();
    expect(byTestId(element, 'theme-toggle').getAttribute('aria-label')).toBe(
      'Dunkles Design einschalten',
    );
    expect(byTestId(element, 'language-switch')).toBeTruthy();
    expect(byTestId(element, 'footer-privacy').getAttribute('href')).toBe('/privacy');
  });

  it('toggles the theme from the top bar', async () => {
    const { element, fixture } = await render();

    byTestId(element, 'theme-toggle').click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('switches the language from the top bar', async () => {
    const { element, fixture } = await render();

    byTestId(element, 'language-en-US').querySelector('button')?.click();
    await fixture.whenStable();

    expect(document.documentElement.lang).toBe('en-US');
    expect(byTestId(element, 'theme-toggle').getAttribute('aria-label')).toBe(
      'Switch to dark theme',
    );
  });

  it('moves focus to the main content from the skip link', async () => {
    const { element } = await render();

    element.querySelector<HTMLAnchorElement>('.skip-link')?.click();

    expect(document.activeElement?.id).toBe('main');
  });

  it('sets a translated page title', async () => {
    await render('/login');

    expect(TestBed.inject(Title).getTitle()).toBe(`Anmelden · ${BRAND_NAME}`);
  });

  it('renders the welcome page for guests', async () => {
    const { page } = await render('/');

    expect(byTestId(page, 'welcome-title').textContent).toContain(BRAND_NAME);
    expect(byTestId(page, 'start-cta').getAttribute('href')).toBe('/login');
    expect(byTestId(page, 'register-link').getAttribute('href')).toBe('/register');
  });

  it('hides the register link while registration is closed', async () => {
    const { page } = await render('/', { registrationEnabled: false, setupRequired: false });
    expect(page.querySelector('[data-testid="register-link"]')).toBeNull();
  });

  it('redirects to /setup while no admin exists', async () => {
    const loaded = TestBed.inject(AuthService).loadConfig();
    http.expectOne('/api/auth/config').flush({ setupRequired: true, registrationEnabled: false });
    await loaded;
    TestBed.createComponent(App);
    const navigation = TestBed.inject(Router).navigateByUrl('/login');
    await vi.waitFor(() =>
      http.expectOne('/api/auth/config').flush({ setupRequired: true, registrationEnabled: false }),
    );
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('shows the profile picker when signed in', async () => {
    TestBed.inject(AuthService).setUser(USER);
    const { page, fixture } = await render('/');
    http.expectOne('/api/kids').flush([]);
    await settle(fixture);
    expect(byTestId(page, 'page-title').textContent).toContain('Wer lernt heute?');
  });

  it('sends guests from protected pages to /login with a return url', async () => {
    await render('/parent/account');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fparent%2Faccount');
  });

  it('renders the not-found page', async () => {
    const { page } = await render('/nope');
    expect(byTestId(page, 'page-title').textContent).toContain('Hoppla');
  });
});
