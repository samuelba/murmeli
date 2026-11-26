import { expect, test } from '@playwright/test';
import { mockHealthyBackend, trackExternalRequests } from '../helpers/mock-api';
import { WelcomePage } from '../pages/welcome.page';

test.describe('landing page', () => {
  test('renders the welcome hero with a start call to action', async ({ page }) => {
    await mockHealthyBackend(page);
    const welcome = new WelcomePage(page);
    await welcome.open();

    await expect(welcome.title).toContainText('Willkommen');
    await expect(welcome.intro).toContainText('Lehrplan 21');
    await expect(welcome.startCta).toBeVisible();
    await expect(page).toHaveTitle(/Willkommen/);
  });

  test('start leads to the sign-in placeholder', async ({ page }) => {
    await mockHealthyBackend(page);
    const welcome = new WelcomePage(page);
    await welcome.open();

    await welcome.startCta.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('page-title')).toHaveText('Anmelden');
  });

  test('unknown routes show a friendly not-found page', async ({ page }) => {
    await mockHealthyBackend(page);
    await page.goto('/does-not-exist');

    await expect(page.getByTestId('page-title')).toContainText('Hoppla');
    await page.getByTestId('back-home').click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('makes no requests to third-party hosts', async ({ page, baseURL }) => {
    await mockHealthyBackend(page);
    const external = trackExternalRequests(page, new URL(baseURL ?? '').origin);
    const welcome = new WelcomePage(page);
    await welcome.open();
    await page.waitForLoadState('networkidle');

    expect(external.map((request) => request.url())).toEqual([]);
  });

  test('loads without console errors (e.g. CSP violations)', async ({ page }) => {
    await mockHealthyBackend(page);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const welcome = new WelcomePage(page);
    await welcome.open();
    await welcome.switchLanguage('en-US');
    await welcome.themeToggle.click();
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
