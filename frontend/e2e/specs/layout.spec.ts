import { type Page, expect, test } from '@playwright/test';
import { mockFamily } from '../helpers/family';
import { SCENARIOS, openScenario } from '../helpers/scenarios';
import { AppShellPage } from '../pages/app-shell.page';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password?token=abc',
  '/verify-email',
  '/privacy',
  '/terms',
  '/not-a-page',
];
const MIN_TOUCH_TARGET = 48;

/**
 * The element whose box is the real touch target: the whole Material form field for its
 * inner <input>, the label for visually hidden radios. Inline text links inside a checkbox
 * label are exempt (WCAG 2.5.8 "inline" exception).
 */
async function touchBoxes(page: Page) {
  return page.evaluate(() => {
    const selector = 'a[href], button, [role="button"], [role="radio"], input, select';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((node) => !node.closest('[aria-hidden="true"], mat-checkbox label'))
      .filter((node) => !(node instanceof HTMLInputElement && node.type === 'hidden'))
      .filter((node) => !node.matches('.mu-visually-hidden:not([type="radio"])'))
      .filter((node) => node.getClientRects().length > 0 || node.matches('[type="radio"]'))
      .map((node) => {
        const target =
          node.closest<HTMLElement>(
            'mat-form-field, .mdc-checkbox, .mdc-radio, mat-slide-toggle, label.option',
          ) ?? node;
        const box = target.getBoundingClientRect();
        const checkbox = target.classList.contains('mdc-checkbox');
        return {
          label: node.outerHTML.slice(0, 100),
          width: checkbox ? Math.max(box.width, 48) : box.width,
          height: checkbox ? Math.max(box.height, 48) : box.height,
        };
      });
  });
}

test.describe('narrow phones (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of PUBLIC_ROUTES) {
    for (const language of ['de-CH', 'en-US'] as const) {
      test(`${path} has no horizontal scroll in ${language}`, async ({ page }) => {
        await mockFamily(page, { loggedIn: false });
        const shell = new AppShellPage(page);
        await shell.goto(path);
        await shell.switchLanguage(language);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('signed-in pages at 360px', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const scenario of SCENARIOS) {
    test(`${scenario.name} has no horizontal scroll`, async ({ page }) => {
      await openScenario(page, scenario);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('touch targets', () => {
  for (const path of PUBLIC_ROUTES) {
    test(`every interactive element on ${path} is at least ${MIN_TOUCH_TARGET}px`, async ({
      page,
    }) => {
      await mockFamily(page, { loggedIn: false });
      const shell = new AppShellPage(page);
      await shell.goto(path);
      await page.getByTestId('page-title').or(page.getByTestId('welcome-title')).waitFor();

      const boxes = await touchBoxes(page);
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width, box.label).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box.height, box.label).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    });
  }

  test('kid mode call to action is at least 64px tall', async ({ page }) => {
    await mockFamily(page, { loggedIn: false });
    const shell = new AppShellPage(page);
    await shell.goto('/');

    const box = await page.getByTestId('start-cta').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  });
});
