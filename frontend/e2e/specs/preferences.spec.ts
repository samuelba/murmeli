import { expect, test } from '@playwright/test';
import { mockHealthyBackend } from '../helpers/mock-api';
import { WelcomePage } from '../pages/welcome.page';

test.beforeEach(async ({ page }) => {
  await mockHealthyBackend(page);
});

test.describe('theme', () => {
  test.use({ colorScheme: 'light' });

  test('toggle switches to dark and persists across reloads', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();
    expect(await welcome.htmlAttribute('data-theme')).toBeNull();

    await welcome.themeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(welcome.themeToggle).toHaveAttribute('aria-label', 'Helles Design einschalten');

    await welcome.themeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('language', () => {
  test('starts in German for a de-CH browser', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
    await expect(welcome.languageButton('de-CH')).toHaveAttribute('aria-checked', 'true');
  });

  test('switching changes the text and <html lang>, and persists', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();

    await welcome.switchLanguage('en-US');
    await expect(welcome.title).toContainText('Welcome');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page).toHaveTitle(/Welcome/);

    await page.reload();
    await expect(welcome.title).toContainText('Welcome');

    await welcome.switchLanguage('de-CH');
    await expect(welcome.title).toContainText('Willkommen');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH');
  });
});

test.describe('language from the browser', () => {
  test.use({ locale: 'fr-CH' });

  test('falls back to English for non-German browsers', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.open();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(welcome.title).toContainText('Welcome');
  });
});
