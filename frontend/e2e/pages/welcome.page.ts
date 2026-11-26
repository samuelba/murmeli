import { type Locator, type Page } from '@playwright/test';
import { AppShellPage } from './app-shell.page';

export class WelcomePage extends AppShellPage {
  readonly title: Locator;
  readonly intro: Locator;
  readonly startCta: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('welcome-title');
    this.intro = page.getByTestId('welcome-intro');
    this.startCta = page.getByTestId('start-cta');
    this.registerLink = page.getByTestId('register-link');
  }

  async open() {
    await this.goto('/');
    await this.title.waitFor();
  }
}
