import { type Page, expect, test } from '@playwright/test';
import { type FamilyOptions, kid, mockFamily } from '../helpers/family';
import { apiError } from '../helpers/mock-api';
import { emptyProgressFixture } from '../helpers/progress-fixtures';

const MIA = kid();
const PROGRESS = `/parent/kids/${MIA.id}/progress`;

async function openProgress(page: Page, options: FamilyOptions = {}) {
  const backend = await mockFamily(page, { kids: [MIA], gate: true, ...options });
  await page.goto(PROGRESS);
  await expect(page.getByTestId('page-title')).toHaveText('Fortschritt von Mia');
  return backend;
}

test.describe('parent progress', () => {
  test('is linked from the kid card on the parent dashboard', async ({ page }) => {
    await mockFamily(page, { kids: [MIA], gate: true });
    await page.goto('/parent');
    const link = page.getByTestId(`progress-kid-${MIA.id}`);
    await expect(link).toHaveAccessibleName('Fortschritt von Mia');
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${PROGRESS}$`));
    await expect(page.getByTestId('progress-tracks')).toBeVisible();
    await expect(page).toHaveTitle(/Fortschritt/);
  });

  test('shows the overview, the badges and an explanation for parents', async ({ page }) => {
    await openProgress(page);

    await expect(page.getByTestId('progress-class')).toHaveText('Kindergarten 2');
    await expect(page.getByTestId('stat-stars')).toHaveText('10 von 30');
    await expect(page.getByTestId('stat-levels')).toHaveText('4 von 10');
    await expect(page.getByTestId('stat-minutes')).toHaveText('132 Min.');
    await expect(page.getByTestId('progress-badge-first-level')).toContainText('Erster Wegweiser');
    await expect(page.getByTestId('progress-badge-first-world')).toContainText('seit');
    await expect(page.getByTestId('progress-explain')).toContainText('Sterne');
  });

  test('draws 14 days of minutes and rounds with a table of the same values', async ({ page }) => {
    await openProgress(page);
    const minutes = page.getByTestId('activity-minutes');

    await expect(minutes.locator('[data-testid^="bar-"]')).toHaveCount(14);
    await expect(minutes.locator('.mark')).toHaveCount(8);
    await expect(minutes.getByRole('img')).toHaveAccessibleName(
      /Lernzeit pro Tag.*Insgesamt 132 Min\., an 8 von 14 Tagen\. Am meisten: 31 Min\./,
    );
    await expect(page.getByTestId('activity-runs').locator('.mark')).toHaveCount(8);

    const table = page.getByTestId('activity-table');
    await expect(table).toBeHidden();
    await page.getByTestId('activity-table-toggle').locator('summary').click();
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(14);
    const peak = table.getByRole('row', { name: /23\. November/ });
    await expect(peak.getByRole('cell')).toHaveText(['31', '5']);
    await expect(table.getByRole('columnheader')).toHaveText(['Tag', 'Minuten', 'Runden']);
  });

  test('lists skills weakest first with a labeled confidence and flags weak ones', async ({
    page,
  }) => {
    await openProgress(page);
    const skills = page.getByTestId('progress-skills');

    await expect(page.getByTestId('weak-skills')).toBeVisible();
    await expect(
      skills.locator('[data-testid^="skill-math"], [data-testid^="skill-reading"]'),
    ).toHaveCount(6);
    const weakest = page.getByTestId('skill-math.sub.5');
    await expect(weakest.getByTestId('skill-weak')).toHaveText('Braucht Übung');
    await expect(weakest.getByTestId('skill-mastery')).toContainText(/Sicherheit 42\s%/);
    await expect(weakest).toContainText('Jetzt zum Wiederholen fällig');
    await expect(page.getByTestId('skill-math.count.3')).toContainText('sitzt gut');
    await expect(page.getByTestId('skill-math.count.3').getByTestId('skill-weak')).toHaveCount(0);
  });

  test('shows tracks, collapsible worlds, stars and level states', async ({ page }) => {
    await openProgress(page);
    const meadow = page.getByTestId('progress-world-math-zahlenwiese');
    const mountain = page.getByTestId('progress-world-math-rechenberg');

    await expect(mountain).toHaveAttribute('open', '');
    await expect(meadow).not.toHaveAttribute('open', '');
    await expect(meadow.locator('summary')).toContainText('3 von 3 Stufen');
    await meadow.locator('summary').click();
    const level = page.getByTestId('progress-level-math-zahlenwiese-03');
    await expect(level).toBeVisible();
    await expect(level.getByRole('img')).toHaveAccessibleName('2 von 3 Sternen');
    await expect(level).toContainText('Geschafft');
    await expect(page.getByTestId('progress-level-math-rechenberg-03')).toContainText(
      'Noch gesperrt',
    );
  });

  test('explains an empty profile instead of drawing empty charts', async ({ page }) => {
    await openProgress(page, { progress: emptyProgressFixture });

    await expect(page.getByTestId('activity-empty')).toBeVisible();
    await expect(page.getByTestId('skills-empty')).toBeVisible();
    await expect(page.getByTestId('progress-no-badges')).toBeVisible();
    await expect(page.getByTestId('activity-minutes').locator('.mark')).toHaveCount(0);
  });

  test('offers a retry when loading fails', async ({ page }) => {
    const backend = await mockFamily(page, { kids: [MIA], gate: true });
    backend.on('GET /api/parent/kids/:id/progress', apiError(500, 'INTERNAL'));
    await page.goto(PROGRESS);

    await expect(page.getByTestId('progress-error')).toBeVisible();
    backend.on('GET /api/parent/kids/:id/progress', { body: emptyProgressFixture(MIA.id) });
    await page.getByTestId('progress-error').getByRole('button').click();
    await expect(page.getByTestId('progress-tracks')).toBeVisible();
  });

  test('asks for the parent gate first', async ({ page }) => {
    await mockFamily(page, { kids: [MIA], gate: false });
    await page.goto(PROGRESS);

    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
