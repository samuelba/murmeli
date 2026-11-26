import { expect, test } from '@playwright/test';
import { PASSWORD, RECOVERY_CODE, TOTP_CODE, mockFamily } from '../helpers/family';
import { collectPageErrors } from '../helpers/mock-api';

test.describe('first-run setup', () => {
  test('creates the first admin and lands on the profile picker', async ({ page }) => {
    const backend = await mockFamily(page, { loggedIn: false, setupRequired: true });

    await page.goto('/');
    await expect(page).toHaveURL(/\/setup$/);
    await page.getByTestId('setup-email').fill('admin@example.ch');
    await page.getByTestId('new-password').fill(PASSWORD);
    await page.getByTestId('new-password-confirm').fill(PASSWORD);
    await page.getByTestId('setup-submit').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/auth/setup')[0].body).toEqual({
      email: 'admin@example.ch',
      password: PASSWORD,
      locale: 'de-CH',
    });
  });

  test('is not reachable once an admin exists', async ({ page }) => {
    await mockFamily(page, { loggedIn: false });
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('registration', () => {
  test('registers with ALTCHA when registration is open', async ({ page }) => {
    const backend = await mockFamily(page, { loggedIn: false });
    const errors = collectPageErrors(page);
    await page.goto('/register');

    await page.getByTestId('register-email').fill('neu@example.ch');
    await page.getByTestId('new-password').fill(PASSWORD);
    await page.getByTestId('new-password-confirm').fill(PASSWORD);
    await expect(page.getByTestId('password-strength')).toHaveAttribute('data-score', /[34]/);
    await page.getByTestId('register-terms').locator('input[type="checkbox"]').check();
    await expect(page.locator('altcha-widget [data-state="verified"]')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-done')).toContainText('neu@example.ch');
    const body = backend.callsTo('POST', '/api/auth/register')[0].body as Record<string, unknown>;
    expect(body).toMatchObject({
      email: 'neu@example.ch',
      password: PASSWORD,
      locale: 'de-CH',
      acceptTerms: true,
    });
    expect(typeof body['altcha']).toBe('string');
    expect((body['altcha'] as string).length).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test('requires consent before submitting', async ({ page }) => {
    const backend = await mockFamily(page, { loggedIn: false });
    await page.goto('/register');
    await page.getByTestId('register-email').fill('neu@example.ch');
    await page.getByTestId('register-submit').click();

    await expect(page.getByText('Bitte bestätige die Datenschutzerklärung')).toBeVisible();
    expect(backend.callsTo('POST', '/api/auth/register')).toEqual([]);
  });

  test('shows a closed notice when registration is disabled', async ({ page }) => {
    await mockFamily(page, { loggedIn: false, registrationEnabled: false });
    await page.goto('/register');

    await expect(page.getByTestId('registration-closed')).toBeVisible();
    await expect(page.getByTestId('register-email')).toHaveCount(0);
  });
});

test.describe('sign in', () => {
  test('shows a friendly error for wrong credentials', async ({ page }) => {
    await mockFamily(page, { loggedIn: false });
    await page.goto('/login');
    await page.getByTestId('login-email').fill('eltern@example.ch');
    await page.getByTestId('login-password').fill('wrong password!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('form-error')).toHaveText(
      'E-Mail-Adresse oder Passwort stimmen nicht.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in with a TOTP code', async ({ page }) => {
    const backend = await mockFamily(page, { loggedIn: false, totp: true });
    await page.goto('/login');
    await page.getByTestId('login-email').fill('eltern@example.ch');
    await page.getByTestId('login-password').fill(PASSWORD);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('page-title')).toHaveText('Bestätigungscode');
    await page.getByTestId('login-totp-code').fill('000000');
    await page.getByTestId('login-totp-submit').click();
    await expect(page.getByTestId('form-error')).toContainText('Der Code stimmt nicht');

    await page.getByTestId('login-totp-code').fill(TOTP_CODE);
    await page.getByTestId('login-totp-submit').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/auth/totp/verify').at(-1)?.body).toEqual({
      code: TOTP_CODE,
    });
  });

  test('signs in with a recovery code and returns to the requested page', async ({ page }) => {
    const backend = await mockFamily(page, { loggedIn: false, totp: true });
    await page.goto('/learn');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Flearn$/);

    await page.getByTestId('login-email').fill('eltern@example.ch');
    await page.getByTestId('login-password').fill(PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('login-toggle-recovery').click();
    await page.getByTestId('login-recovery-code').fill(RECOVERY_CODE);
    await page.getByTestId('login-totp-submit').click();

    // No kid is active, so /learn sends the family on to the profile picker.
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/auth/totp/verify')[0].body).toEqual({
      recoveryCode: RECOVERY_CODE,
    });
  });

  test('signs out from the account menu', async ({ page }) => {
    const backend = await mockFamily(page);
    await page.goto('/');
    await page.getByTestId('account-menu').click();
    await page.getByTestId('menu-logout').click();

    await expect(page).toHaveURL(/\/login$/);
    expect(backend.callsTo('POST', '/api/auth/logout')).toHaveLength(1);
    await expect(page.getByTestId('account-menu')).toHaveCount(0);
  });
});
