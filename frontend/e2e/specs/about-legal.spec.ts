import { expect, test } from '@playwright/test';
import { mockFamily } from '../helpers/family';

test.describe('about and legal pages', () => {
  test('the about page explains the voices, the curriculum and the licenses', async ({ page }) => {
    await mockFamily(page, { loggedIn: false });
    await page.goto('/');
    await page.getByTestId('footer-about').click();

    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByTestId('page-title')).toHaveText('Über Murmeli');
    await expect(page.getByTestId('about-voices')).toContainText(
      'Die Stimmen sind mit künstlicher Intelligenz erzeugt (Qwen3-TTS)',
    );
    await expect(page.getByTestId('about-curriculum')).toContainText('Lehrplan 21');
    const license = page.getByTestId('credit-pictures').getByRole('link', { name: 'Apache-2.0' });
    await expect(license).toHaveAttribute('href', '/pictures/LICENSE');
    await expect(page.getByTestId('credit-fonts')).toContainText('SIL Open Font License');
    await expect(page.getByTestId('app-version')).toHaveText(/Murmeli Version \d+\.\d+\.\d+/);

    const response = await page.request.get('/pictures/LICENSE');
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('Apache License');
  });

  test('privacy and terms show the operator from the server', async ({ page }) => {
    await mockFamily(page, {
      loggedIn: false,
      legal: {
        operatorName: 'Familie Muster',
        contactEmail: 'hallo@example.ch',
        address: 'Bergweg 1\n3000 Bern',
        privacyNote: 'Die Daten liegen auf unserem Server zu Hause.',
      },
    });
    await page.goto('/privacy');
    const operator = page.getByTestId('legal-operator');
    await expect(operator).toContainText('Familie Muster');
    await expect(page.getByTestId('operator-address')).toHaveText('Bergweg 1\n3000 Bern');
    await expect(operator.getByRole('link', { name: 'hallo@example.ch' })).toHaveAttribute(
      'href',
      'mailto:hallo@example.ch',
    );
    await expect(page.getByTestId('operator-privacy-note')).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByTestId('operator-name')).toHaveText('Familie Muster');
    await expect(page.getByTestId('operator-privacy-note')).toHaveCount(0);
  });

  test('without operator info they show a neutral note', async ({ page }) => {
    await mockFamily(page, { loggedIn: false });
    await page.goto('/privacy');
    await expect(page.getByTestId('operator-none')).toHaveText(
      /Betrieben von der Person oder Organisation, die diese Instanz hostet\./,
    );
    await expect(page.getByTestId('legal-operator')).not.toContainText('folgen');
  });
});
