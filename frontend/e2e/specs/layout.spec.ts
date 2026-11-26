import { expect, test } from '@playwright/test';
import { mockHealthyBackend } from '../helpers/mock-api';
import { AppShellPage } from '../pages/app-shell.page';

const ROUTES = ['/', '/login', '/register', '/not-a-page'];
const MIN_TOUCH_TARGET = 48;

test.beforeEach(async ({ page }) => {
  await mockHealthyBackend(page);
});

test.describe('narrow phones (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of ROUTES) {
    for (const language of ['de-CH', 'en-US'] as const) {
      test(`${path} has no horizontal scroll in ${language}`, async ({ page }) => {
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

test.describe('touch targets', () => {
  for (const path of ROUTES) {
    test(`every interactive element on ${path} is at least ${MIN_TOUCH_TARGET}px`, async ({
      page,
    }) => {
      const shell = new AppShellPage(page);
      await shell.goto(path);
      await page.getByTestId('page-title').or(page.getByTestId('welcome-title')).waitFor();

      const elements = await shell.interactiveElements().all();
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        const box = await element.boundingBox();
        const label = await element.evaluate((node) => node.outerHTML.slice(0, 80));
        expect(box, label).not.toBeNull();
        expect(box?.width ?? 0, label).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    });
  }

  test('kid mode call to action is at least 64px tall', async ({ page }) => {
    const shell = new AppShellPage(page);
    await shell.goto('/');

    const box = await page.getByTestId('start-cta').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
  });
});
