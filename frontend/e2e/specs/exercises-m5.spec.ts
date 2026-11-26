import { type Page, expect, test } from '@playwright/test';
import type { MoneyPayload, TraceLetterPayload } from '@murmeli/content';
import { type FamilyBackend, type FamilyOptions, kid, mockFamily } from '../helpers/family';
import { PlayerPage } from '../pages/player.page';

const MIA = kid();
const FIRST = 'math-zahlenwiese-01';

async function play(
  page: Page,
  options: FamilyOptions = {},
  levelId = FIRST,
): Promise<{ backend: FamilyBackend; player: PlayerPage }> {
  const backend = await mockFamily(page, { kids: [MIA], ...options });
  await page.goto('/');
  await page.getByTestId(`kid-tile-${options.kids?.[0]?.id ?? MIA.id}`).click();
  await expect(page.getByTestId('trail')).toBeVisible();
  await page.goto(`/learn/level/${levelId}`);
  return { backend, player: new PlayerPage(page, backend.learn) };
}

function answers(backend: FamilyBackend) {
  return backend.callsTo('POST', `/api/learn/runs/${backend.learn.current.id}/answers`);
}

test.describe('tracing', () => {
  test('a letter traced with the mouse along the model is accepted', async ({ page }) => {
    const { backend, player } = await play(page, {
      learn: { exerciseType: 'trace-letter', items: 2, seed: 3 },
    });
    await player.waitForItem(0);
    const payload = player.item(0).payload as TraceLetterPayload;
    await expect(page.getByTestId('trace-surface')).toHaveCSS('touch-action', 'none');
    await player.trace(payload.strokes);
    await expect(page.getByTestId('trace-stroke')).toHaveCount(payload.strokes.length);
    await page.getByTestId('trace-done').click();
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
    const [call] = answers(backend);
    expect((call?.body as { answer: { strokes: unknown[] } }).answer.strokes).toHaveLength(
      payload.strokes.length,
    );
  });

  test('a letter traced with a finger is accepted', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'touch needs a touch screen');
    const { player } = await play(page, {
      learn: { exerciseType: 'trace-letter', items: 2, seed: 5 },
    });
    await player.waitForItem(0);
    const payload = player.item(0).payload as TraceLetterPayload;
    await player.trace(payload.strokes, 'touch');
    await expect(page.getByTestId('trace-stroke')).toHaveCount(payload.strokes.length);
    await page.getByTestId('trace-done').click();
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  });

  test('a scribble brings the hint and Murmeli traces the model again', async ({ page }) => {
    const { player } = await play(page, {
      learn: { exerciseType: 'trace-letter', items: 2, seed: 3 },
    });
    await player.waitForItem(0);
    await player.answerWrong(0);
    await expect(page.getByTestId('hint')).toBeVisible();
    await expect(page.getByTestId('hint-text')).toHaveText(/Striche|Linie/);
    await expect(page.getByTestId('trace-animation')).toBeVisible();
    await expect(page.getByTestId('trace-clear')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('trace-show').click();
    await expect(page.getByTestId('trace-pencil')).toBeVisible();
  });

  test('the demo draws the letter with a pencil', async ({ page }) => {
    await play(page, { learn: { unlockAll: true } }, 'reading-de-schreibwiese-01');
    await expect(page.getByTestId('demo')).toBeVisible();
    await expect(page.getByTestId('trace-pencil')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('trace-solution').first()).toBeVisible({ timeout: 20_000 });
  });

  test('keyboard users draw with the arrow keys and the space bar', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a hardware keyboard');
    const { backend, player } = await play(page, {
      learn: { exerciseType: 'trace-letter', items: 2, seed: 3 },
    });
    await player.waitForItem(0);
    const surface = page.getByTestId('trace-surface');
    await surface.focus();
    const strokes = (player.item(0).payload as TraceLetterPayload).strokes.length;
    for (let stroke = 0; stroke < strokes; stroke += 1) {
      await page.keyboard.press('Space');
      for (let i = 0; i < 3; i += 1) {
        await page.keyboard.press('ArrowDown');
      }
      await page.keyboard.press('Space');
    }
    await expect(page.getByTestId('trace-stroke')).toHaveCount(strokes);
    await expect(page.getByTestId('trace-status')).toHaveText('Stift abgehoben');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hint').or(page.getByTestId('feedback'))).toBeVisible();
    expect(answers(backend)).toHaveLength(1);
  });
});

test.describe('money', () => {
  test('paying works with any coins that add up', async ({ page }) => {
    const { backend, player } = await play(page, {
      learn: { exerciseType: 'money-chf', exerciseLevel: 'math-maertplatz-03', items: 2 },
    });
    await player.waitForItem(0);
    const payload = player.item(0).payload as Extract<MoneyPayload, { mode: 'pay' }>;
    await expect(page.getByTestId('money-price')).toHaveText(`${payload.amount} Fr.`);
    await page.getByTestId('wallet-chf-2fr').click();
    await page.getByTestId('tray-0').click();
    for (let i = 0; i < payload.amount; i += 1) {
      await page.getByTestId('wallet-chf-1fr').click();
    }
    await page.getByTestId('check').click();
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
    const [call] = answers(backend);
    expect((call?.body as { answer: { coins: string[] } }).answer.coins).toEqual(
      Array.from({ length: payload.amount }, () => 'chf-1fr'),
    );
  });

  test('two wrong payments show the coins Murmeli would use', async ({ page }) => {
    const { player } = await play(page, {
      learn: { exerciseType: 'money-chf', exerciseLevel: 'math-maertplatz-03', items: 2 },
    });
    await player.waitForItem(0);
    await player.answerWrong(0);
    await expect(page.getByTestId('hint-text')).toContainText('Zähle das Geld zusammen.');
    await player.answerWrong(0);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'solution');
    await expect(page.getByTestId('tray-0')).toBeVisible();
  });

  test('comparing purses answers with a sign', async ({ page }) => {
    const { player } = await play(page, {
      learn: { exerciseType: 'money-chf', exerciseLevel: 'math-maertplatz-04', items: 2 },
    });
    await player.waitForItem(0);
    await expect(page.getByTestId('money-left')).toBeVisible();
    await player.answerCorrectly(0);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  });

  test('American kids pay in dollars', async ({ page }) => {
    const sam = kid({ language: 'en-US', nickname: 'Sam' });
    const { player } = await play(page, {
      kids: [sam],
      learn: {
        locale: 'en-US',
        exerciseType: 'money-chf',
        exerciseLevel: 'math-maertplatz-03',
        items: 2,
      },
    });
    await player.waitForItem(0);
    await expect(page.getByTestId('money-price')).toHaveText(/\$\d+/);
    await expect(page.getByTestId('wallet-usd-1')).toBeVisible();
    await player.answerCorrectly(0);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  });

  test('the pay demo puts the coins down', async ({ page }) => {
    await play(page, { learn: { unlockAll: true } }, 'math-maertplatz-03');
    await expect(page.getByTestId('demo')).toBeVisible();
    await expect(page.getByTestId('money-tray')).toHaveClass(/placing/, { timeout: 15_000 });
    await expect(page.getByTestId('demo-pointer')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('more math and reading', () => {
  for (const [name, level] of [
    ['times-table row', 'math-einmaleinsalp-03'],
    ['times-table missing factor', 'math-einmaleinsalp-04'],
    ['clock in words', 'math-uhrenturm-spitze-03'],
    ['division keypad', 'math-einmaleinsalp-07'],
  ] as const) {
    test(`${name} accepts the right answer`, async ({ page }) => {
      const type = name.startsWith('times')
        ? 'times-table'
        : name.startsWith('clock')
          ? 'clock'
          : 'division-share';
      const { player } = await play(page, {
        learn: { exerciseType: type, exerciseLevel: level, items: 3, seed: 11 },
      });
      for (const index of [0, 1]) {
        await player.waitForItem(index);
        await player.answerCorrectly(index);
        await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
        await player.next();
      }
    });
  }

  test('times-table dots help on request', async ({ page }) => {
    const { player } = await play(page, {
      learn: { exerciseType: 'times-table', exerciseLevel: 'math-einmaleinsalp-01', items: 2 },
    });
    await player.waitForItem(0);
    const toggle = page.getByTestId('dots-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.getByTestId('times-dots')).toBeVisible();
  });

  test('sharing onto plates by tapping', async ({ page }) => {
    const { player } = await play(page, {
      learn: { exerciseType: 'division-share', items: 2 },
    });
    await player.waitForItem(0);
    await page.getByTestId('plate-0').click();
    await page.getByTestId('plate-1').click();
    await expect(page.locator('.plate__item')).toHaveCount(2);
    await page.getByTestId('share-reset').click();
    await expect(page.locator('.plate__item')).toHaveCount(0);
  });

  test('listen and write without narration shows the picture instead', async ({ page }) => {
    const { player } = await play(page, { learn: { exerciseType: 'listen-write', items: 2 } });
    await player.waitForItem(0);
    await expect(page.getByTestId('prompt-text')).not.toContainText(
      (player.item(0).solution.answer as { letters: string[] }).letters.join(''),
    );
    await expect(page.getByTestId('replay')).toHaveCount(0);
    await expect(page.getByTestId('exercise-picture')).toBeVisible();
    await expect(page.getByTestId('listen-silent')).toContainText('Ohne Ton');
    await player.answerCorrectly(0);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  });

  test('sentence and picture: the scene choices are named', async ({ page }) => {
    const { player } = await play(page, { learn: { exerciseType: 'sentence-picture', items: 2 } });
    await player.waitForItem(0);
    await expect(page.getByTestId('sentence')).toBeVisible();
    const first = page.locator('[data-testid^="choice-"]').first();
    await expect(first).toHaveAccessibleName(/\S/);
    await player.answerCorrectly(0);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  });
});
