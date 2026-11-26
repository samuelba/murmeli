import { type Locator, type Page } from '@playwright/test';

export type Language = 'de-CH' | 'en-US';

export class AppShellPage {
  readonly brandLink: Locator;
  readonly themeToggle: Locator;
  readonly languageSwitch: Locator;
  readonly main: Locator;

  constructor(readonly page: Page) {
    this.brandLink = page.getByTestId('brand-link');
    this.themeToggle = page.getByTestId('theme-toggle');
    this.languageSwitch = page.getByTestId('language-switch');
    this.main = page.locator('main');
  }

  async goto(path = '/') {
    await this.page.goto(path);
    await this.brandLink.waitFor();
  }

  languageButton(language: Language): Locator {
    return this.page.getByTestId(`language-${language}`).getByRole('radio');
  }

  async switchLanguage(language: Language) {
    await this.languageButton(language).click();
  }

  htmlAttribute(name: string) {
    return this.page.locator('html').getAttribute(name);
  }

  interactiveElements(): Locator {
    return this.page.locator('a[href], button, [role="button"], [role="radio"], input, select');
  }
}
