import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { SCENARIOS, openScenario } from '../helpers/scenarios';

const DARK_TOO = new Set([
  'welcome',
  'login',
  'profile picker',
  'PIN view',
  'learn',
  'player',
  'demo',
]);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    }));
}

for (const scenario of SCENARIOS) {
  const themes = DARK_TOO.has(scenario.name) ? (['light', 'dark'] as const) : (['light'] as const);
  for (const theme of themes) {
    test(`${scenario.name} has no serious accessibility violations (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await openScenario(page, scenario);

      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}

test.describe('reflow at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const scenario of SCENARIOS) {
    test(`${scenario.name} reflows without horizontal scroll and stays accessible`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openScenario(page, scenario);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
