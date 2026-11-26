import { expect, test } from '@playwright/test';
import { mockFamily } from '../helpers/family';
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
    await expect(welcome.registerLink).toBeVisible();
    await expect(page).toHaveTitle(/Willkommen/);
  });

  test('hides the register link while registration is closed', async ({ page }) => {
    await mockFamily(page, { loggedIn: false, registrationEnabled: false });
    const welcome = new WelcomePage(page);
    await welcome.open();

    await expect(welcome.startCta).toBeVisible();
    await expect(welcome.registerLink).toHaveCount(0);
  });

  test('start leads to the sign-in form', async ({ page }) => {
    await mockHealthyBackend(page);
    const welcome = new WelcomePage(page);
    await welcome.open();

    await welcome.startCta.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('page-title')).toHaveText('Anmelden');
    await expect(page.getByTestId('login-email')).toBeVisible();
  });

  test('unknown routes show a friendly not-found page', async ({ page }) => {
    await mockHealthyBackend(page);
    await page.goto('/does-not-exist');

    await expect(page.getByTestId('page-title')).toContainText('Hoppla');
    await page.getByTestId('back-home').click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('shows the legal pages with a draft note', async ({ page }) => {
    await mockHealthyBackend(page);
    await page.goto('/');
    await page.getByTestId('footer-privacy').click();

    await expect(page.getByTestId('page-title')).toHaveText('Datenschutz');
    await expect(page.getByTestId('legal-draft')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keine Tracker' })).toBeVisible();

    await page.getByTestId('footer-terms').click();
    await expect(page.getByTestId('page-title')).toHaveText('Nutzungsbedingungen');
  });

  test('makes no requests to third-party hosts', async ({ page, baseURL }) => {
    await mockHealthyBackend(page);
    const external = trackExternalRequests(page, new URL(baseURL ?? '').origin);
    const welcome = new WelcomePage(page);
    await welcome.open();
    await page.waitForLoadState('networkidle');

    expect(external.map((request) => request.url())).toEqual([]);
  });
});
