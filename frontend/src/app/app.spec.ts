import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { BRAND_NAME } from './core/brand';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { provideTranslocoTesting } from '../testing/i18n';
import { resetDocumentState, stubNavigatorLanguages } from '../testing/browser';

describe('App shell', () => {
  beforeEach(() => {
    stubNavigatorLanguages(['de-CH']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoTesting(),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      ],
    });
  });

  afterEach(() => resetDocumentState());

  async function render(url = '/') {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, page: element.querySelector('main') as HTMLElement };
  }

  function byTestId(element: HTMLElement, id: string): HTMLElement {
    const found = element.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!found) {
      throw new Error(`Missing [data-testid="${id}"]`);
    }
    return found;
  }

  it('shows the brand, theme toggle and language switch', async () => {
    const { element } = await render();

    expect(byTestId(element, 'brand-link').textContent).toContain(BRAND_NAME);
    expect(element.querySelector('mu-logo')).not.toBeNull();
    expect(byTestId(element, 'theme-toggle').getAttribute('aria-label')).toBe(
      'Dunkles Design einschalten',
    );
    expect(byTestId(element, 'language-switch')).toBeTruthy();
  });

  it('toggles the theme from the top bar', async () => {
    const { element, fixture } = await render();

    byTestId(element, 'theme-toggle').click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(byTestId(element, 'theme-toggle').getAttribute('aria-label')).toBe(
      'Helles Design einschalten',
    );
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

  it('renders the welcome page with a start call to action', async () => {
    const { page } = await render('/');

    expect(byTestId(page, 'welcome-title').textContent).toContain(BRAND_NAME);
    expect(byTestId(page, 'start-cta').getAttribute('href')).toBe('/login');
    expect(byTestId(page, 'register-link').getAttribute('href')).toBe('/register');
  });

  it.each([
    ['/login', 'Anmelden'],
    ['/register', 'Konto erstellen'],
  ])('renders the %s placeholder', async (url, title) => {
    const { page } = await render(url);

    expect(byTestId(page, 'page-title').textContent).toContain(title);
  });
});
