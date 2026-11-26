import { expect, test } from '@playwright/test';
import { apiError } from '../helpers/mock-api';
import { mockFamily, user } from '../helpers/family';

const admin = () => user({ role: 'admin', email: 'admin@example.ch' });

test.describe('administration', () => {
  test('is only offered to admins', async ({ page }) => {
    await mockFamily(page, { gate: true });
    await page.goto('/admin');
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
  });

  test('shows the stats and the user list', async ({ page }) => {
    await mockFamily(page, { gate: true, user: admin() });
    await page.goto('/');
    await page.getByTestId('account-menu').click();
    await page.getByTestId('menu-admin').click();

    await expect(page.getByTestId('admin-stats')).toContainText('Kinderprofile');
    await page.getByTestId('admin-nav-users').click();
    const table = page.getByTestId('users-table');
    await expect(table).toContainText('gast@example.ch');
    await expect(table).toContainText('unbestätigt');
  });

  test('creates an invite and shows the link to share', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const backend = await mockFamily(page, { gate: true, user: admin() });
    await page.goto('/admin/invites');
    await page.getByTestId('create-invite').click();

    await page.getByTestId('invite-email').fill('oma@example.ch');
    await page.getByTestId('invite-submit').click();

    await expect(page.getByTestId('invite-url')).toHaveText('http://localhost/invite/abc123token');
    await expect(page.getByTestId('invite-result')).toContainText('E-Mail ist nicht eingerichtet');
    await page.getByTestId('invite-copy').click();
    await expect(page.getByTestId('invite-result')).toContainText('Kopiert.');
    await page.getByTestId('invite-done').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(backend.callsTo('POST', '/api/admin/invites')[0].body).toEqual({
      email: 'oma@example.ch',
      role: 'parent',
    });
  });

  test('turns registration off', async ({ page }) => {
    const backend = await mockFamily(page, { gate: true, user: admin() });
    await page.goto('/admin/settings');
    const toggle = page.getByTestId('setting-registrationEnabled').getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await toggle.click();

    await expect(page.getByText('Gespeichert.')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(backend.callsTo('PATCH', '/api/admin/settings')[0].body).toEqual({
      registrationEnabled: false,
    });
    expect(backend.state.registrationEnabled).toBe(false);
  });

  test('explains when the backend requires admin TOTP', async ({ page }) => {
    const backend = await mockFamily(page, { gate: true, user: admin() });
    backend.on('GET /api/admin/stats', apiError(403, 'TOTP_REQUIRED'));
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/parent\/account\?notice=totp-required#totp$/);
    await expect(page.getByTestId('totp-required-notice')).toContainText('Zwei-Faktor-Anmeldung');
    await expect(page.locator('#totp-heading')).toBeFocused();
  });

  test('filters the audit log', async ({ page }) => {
    const backend = await mockFamily(page, { gate: true, user: admin() });
    await page.goto('/admin/audit-log');
    await expect(page.getByTestId('audit-table')).toContainText('auth.login');

    await page.getByTestId('audit-filter').click();
    await page.getByRole('option', { name: 'kid.created' }).click();
    await expect
      .poll(() => backend.calls.filter((call) => call.path === '/api/admin/audit-log').length)
      .toBe(2);
  });
});
