import { test, expect } from '@playwright/test';
import { kid, mockFamily } from '../helpers/family';
import { PlayerPage } from '../pages/player.page';

const OUT = process.env['SHOTS_OUT'] ?? 'e2e-results/shots';
const MIA = kid();

for (const theme of ['light', 'dark'] as const) {
  test(`map ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await mockFamily(page, {
      kids: [MIA],
      learn: {
        progress: { 'math-zahlenwiese-01': 3, 'math-zahlenwiese-02': 2, 'math-zahlenwiese-03': 1 },
      },
    });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await expect(page.getByTestId('trail')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `${OUT}/map-${theme}-${info.project.name}.png`,
      fullPage: false,
    });
  });
}

const TYPES = (process.env['TYPES'] ?? 'count-objects').split(',');
const THEMES = (process.env['THEMES'] ?? 'light,dark').split(',') as ('light' | 'dark')[];
for (const type of TYPES) {
  for (const theme of THEMES) {
    test(`${type} ${theme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await mockFamily(page, { kids: [MIA], learn: { exerciseType: type as never, items: 2 } });
      await page.goto('/');
      await page.getByTestId(`kid-tile-${MIA.id}`).click();
      await page.goto('/learn/level/math-zahlenwiese-01');
      await expect(page.getByTestId('prompt-text')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${OUT}/${type}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    });
  }
}

for (const theme of THEMES) {
  test(`flow ${theme}`, async ({ page }, info) => {
    const name = (step: string) => `${OUT}/${step}-${theme}-${info.project.name}.png`;
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const backend = await mockFamily(page, { kids: [MIA], learn: { items: 2 } });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await page.getByTestId(`level-math-zahlenwiese-01`).click();
    await expect(page.getByTestId('demo-pointer')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: name('demo'), fullPage: true });
    await page.getByTestId('demo-go').click();
    const player = new PlayerPage(page, backend.learn);
    await player.waitForItem(0);
    await player.answerWrong(0);
    await expect(page.getByTestId('hint')).toBeVisible();
    await page.screenshot({ path: name('hint'), fullPage: true });
    await player.answerCorrectly(0);
    await expect(page.getByTestId('feedback')).toBeVisible();
    await page.screenshot({ path: name('correct'), fullPage: false });
    await player.next();
    await player.waitForItem(1);
    await player.answerWrong(1);
    await player.answerWrong(1);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'solution');
    await page.screenshot({ path: name('solution'), fullPage: false });
    await player.next();
    await expect(page.getByTestId('results')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: name('results'), fullPage: false });
  });

  test(`rest ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await mockFamily(page, { kids: [MIA], learn: { dailyLimitReached: true } });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await page.getByTestId(`level-math-zahlenwiese-01`).click();
    await expect(page.getByTestId('daily-limit')).toBeVisible();
    await page.screenshot({ path: `${OUT}/rest-${theme}-${info.project.name}.png` });
  });
}

for (const theme of THEMES) {
  test(`progress ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await mockFamily(page, { kids: [MIA], gate: true });
    await page.goto(`/parent/kids/${MIA.id}/progress`);
    await expect(page.getByTestId('progress-tracks')).toBeVisible();
    await page.getByTestId('activity-table-toggle').locator('summary').click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${OUT}/progress-${theme}-${info.project.name}.png`,
      fullPage: true,
    });
  });

  test(`m6 kid screens ${theme}`, async ({ page, context }, info) => {
    const name = (step: string) => `${OUT}/${step}-${theme}-${info.project.name}.png`;
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await mockFamily(page, {
      kids: [MIA],
      learn: { progress: { 'math-zahlenwiese-01': 3, 'math-zahlenwiese-02': 2 } },
    });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await expect(page.getByTestId('trail')).toBeVisible();
    await page.getByTestId('badges').click();
    await expect(page.getByTestId('badge-shelf')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: name('badge-shelf') });
    await page.keyboard.press('Escape');
    await context.setOffline(true);
    await expect(page.getByTestId('offline-screen')).toBeVisible();
    await page.screenshot({ path: name('offline') });
    await context.setOffline(false);
  });
}
