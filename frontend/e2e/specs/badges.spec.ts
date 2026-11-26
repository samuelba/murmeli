import { type Page, expect, test } from '@playwright/test';
import { type FamilyBackend, type FamilyOptions, kid, mockFamily } from '../helpers/family';
import { PlayerPage } from '../pages/player.page';

const MIA = kid();
const FIRST = 'math-zahlenwiese-01';

async function openMap(page: Page, options: FamilyOptions = {}): Promise<FamilyBackend> {
  const backend = await mockFamily(page, { kids: [MIA], ...options });
  await page.goto('/');
  await page.getByTestId(`kid-tile-${MIA.id}`).click();
  await expect(page.getByTestId('trail')).toBeVisible();
  return backend;
}

test.describe('badges', () => {
  test('the shelf shows earned badges by name and how to get the others', async ({ page }) => {
    await openMap(page, { learn: { progress: { [FIRST]: 3 } } });
    const button = page.getByTestId('badges');
    await expect(button).toHaveAccessibleName('Abzeichen: 1');
    await expect(page.getByTestId('badge-count')).toHaveText('1');

    await button.click();
    const shelf = page.getByRole('dialog');
    await expect(shelf).toHaveAccessibleName('Deine Abzeichen');
    const first = page.getByTestId('shelf-badge-first-level');
    await expect(first).toHaveAttribute('data-earned', 'true');
    await expect(first).toContainText('Erster Wegweiser');
    await expect(first).toContainText('Hast du schon!');
    const practice = page.getByTestId('shelf-badge-first-practice');
    await expect(practice).toHaveAttribute('data-earned', 'false');
    await expect(practice).toContainText('Kommt noch');
    await expect(practice).toContainText('Übe zum ersten Mal.');
    await expect(page.getByTestId('badge-shelf-close')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(shelf).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('a new badge is celebrated on the results screen and lands on the shelf', async ({
    page,
  }) => {
    const backend = await openMap(page, { learn: { demoSeen: [FIRST], items: 3 } });
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 0');
    await page.getByTestId(`level-${FIRST}`).click();
    await expect(page.getByTestId('prompt-text')).toBeVisible();
    const player = new PlayerPage(page, backend.learn);
    await player.playThrough();

    const celebration = page.getByTestId('new-badges');
    await expect(celebration).toContainText('Du hast ein neues Abzeichen!');
    await expect(page.getByTestId('new-badge-first-level')).toContainText('Erster Wegweiser');

    await page.getByTestId('results-map').click();
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 1');
  });

  test('first practice comes back from the server after a reload', async ({ page }) => {
    const backend = await openMap(page, { learn: { progress: { [FIRST]: 3 }, items: 3 } });
    await page.getByTestId('practice').click();
    await expect(page.getByTestId('prompt-text')).toBeVisible();
    const player = new PlayerPage(page, backend.learn);
    await player.playThrough();
    await expect(page.getByTestId('new-badge-first-practice')).toBeVisible();

    await page.getByTestId('results-map').click();
    await page.reload();
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 2');
  });

  test('badges earned on another device are on the shelf', async ({ page }) => {
    await openMap(page, { learn: { badges: ['first-practice', 'first-level'] } });
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 2');
    await page.getByTestId('badges').click();
    await expect(page.getByTestId('shelf-badge-first-practice')).toHaveAttribute(
      'data-earned',
      'true',
    );
  });

  test('an older backend without badges falls back to this device', async ({ page }) => {
    const backend = await openMap(page, {
      learn: { progress: { [FIRST]: 3 }, items: 3, mapWithoutBadges: true },
    });
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 1');
    await page.getByTestId('practice').click();
    await expect(page.getByTestId('prompt-text')).toBeVisible();
    await new PlayerPage(page, backend.learn).playThrough();
    await page.getByTestId('results-map').click();
    await page.reload();
    await expect(page.getByTestId('badges')).toHaveAccessibleName('Abzeichen: 2');
  });
});
