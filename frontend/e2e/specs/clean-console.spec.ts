import { expect, test } from '@playwright/test';
import { SCENARIOS, openScenario } from '../helpers/scenarios';
import { collectPageErrors, mockHealthyBackend, trackExternalRequests } from '../helpers/mock-api';
import { WelcomePage } from '../pages/welcome.page';

test.describe('loads cleanly under the CSP', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name} logs no errors and stays on this origin`, async ({ page, baseURL }) => {
      const errors = collectPageErrors(page);
      const external = trackExternalRequests(page, new URL(baseURL ?? '').origin);
      await openScenario(page, scenario);
      await page.waitForLoadState('networkidle');

      expect(errors).toEqual([]);
      expect(external.map((request) => request.url())).toEqual([]);
    });
  }

  test('switching language and theme logs no errors', async ({ page }) => {
    await mockHealthyBackend(page);
    const errors = collectPageErrors(page);
    const welcome = new WelcomePage(page);
    await welcome.open();
    await welcome.switchLanguage('en-US');
    await welcome.themeToggle.click();
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
