import { type Page, expect, test } from '@playwright/test';
import type { ExerciseTypeId } from '@murmeli/content';
import { type FamilyBackend, type FamilyOptions, kid, mockFamily } from '../helpers/family';
import { apiError } from '../helpers/mock-api';
import { PlayerPage } from '../pages/player.page';

const MIA = kid();
const FIRST = 'math-zahlenwiese-01';
const SECOND = 'math-zahlenwiese-02';

async function openMap(page: Page, options: FamilyOptions = {}): Promise<FamilyBackend> {
  const backend = await mockFamily(page, { kids: [MIA], ...options });
  await page.goto('/');
  await page.getByTestId(`kid-tile-${MIA.id}`).click();
  await expect(page.getByTestId('trail')).toBeVisible();
  return backend;
}

async function openLevel(page: Page, options: FamilyOptions = {}, levelId = FIRST) {
  const backend = await openMap(page, options);
  await page.getByTestId(`level-${levelId}`).click();
  await expect(page).toHaveURL(new RegExp(`/learn/level/${levelId}$`));
  return { backend, player: new PlayerPage(page, backend.learn) };
}

test.describe('trail map', () => {
  test('shows stars, the next level, locked levels and the summit of a finished world', async ({
    page,
  }) => {
    await openMap(page, {
      learn: { progress: { [FIRST]: 3, [SECOND]: 1 } },
    });

    await expect(page.getByTestId(`level-${FIRST}`)).toHaveAttribute('data-state', 'passed');
    await expect(page.getByTestId(`level-${FIRST}`)).toHaveAccessibleName(/3 von 3 Sternen/);
    await expect(page.getByTestId(`level-${SECOND}`)).toHaveAttribute('data-state', 'unlocked');
    await expect(page.getByTestId('level-math-zahlenwiese-03')).toHaveAttribute(
      'data-state',
      'locked',
    );
    await expect(page.getByTestId('world-stars-math-zahlenwiese')).toContainText('4 von');
    await expect(page.getByTestId('map-mascot')).toBeVisible();

    await page.getByTestId('level-math-zahlenwiese-03').click({ force: true });
    await expect(page).toHaveURL(/\/learn$/);
  });

  test('switches between the math and the reading trail', async ({ page }) => {
    await openMap(page);
    const reading = page.getByTestId('track-reading-de');
    await expect(page.getByTestId('track-math')).toHaveAttribute('aria-selected', 'true');
    await reading.click();
    await expect(reading).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('world-reading-de-lautwiese')).toBeVisible();

    await reading.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('track-math')).toBeFocused();
  });

  test('start-class placement marks earlier worlds as skipped', async ({ page }) => {
    await openMap(page, { learn: { startClass: '1' } });
    await expect(page.getByTestId(`level-${FIRST}`)).toHaveAttribute('data-state', 'skipped');
    await expect(page.getByTestId('summit-math-zahlenwiese')).toBeVisible();
  });
});

test.describe('playing a level', () => {
  test('correct answers earn three stars and unlock the next level', async ({ page }) => {
    const { backend, player } = await openLevel(page, { learn: { demoSeen: [FIRST] } });

    await player.playThrough();
    await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('result-stars')).toHaveAccessibleName('3 von 3 Sternen');
    await expect(page.getByTestId('unlocked-level')).toBeVisible();
    expect(
      backend.callsTo('POST', `/api/learn/runs/${backend.learn.current.id}/finish`),
    ).toHaveLength(1);

    await page.getByTestId('results-map').click();
    await expect(page.getByTestId(`level-${FIRST}`)).toHaveAttribute('data-state', 'passed');
    await expect(page.getByTestId(`level-${SECOND}`)).toHaveAttribute('data-state', 'unlocked');
  });

  test('"next level" starts the level that was just unlocked', async ({ page }) => {
    const { player } = await openLevel(page, { learn: { demoSeen: [FIRST, SECOND] } });
    await player.playThrough();
    await page.getByTestId('results-next').click();
    await expect(page).toHaveURL(new RegExp(`/learn/level/${SECOND}$`));
    await player.waitForItem(0);
  });

  test('a wrong answer brings a hint, a second one shows the solution gently', async ({ page }) => {
    const { backend, player } = await openLevel(page, { learn: { demoSeen: [FIRST], items: 3 } });
    await player.waitForItem(0);

    await player.answerWrong(0);
    const hint = page.getByTestId('hint');
    await expect(hint).toBeVisible();
    await expect(page.getByTestId('hint-text')).toHaveText(
      'Tippe beim Zählen jedes Bild einmal an.',
    );
    await expect(page.locator('mu-mascot.prompt__mascot')).toHaveAttribute(
      'data-pose',
      'encouraging',
    );

    await player.answerWrong(0);
    const feedback = page.getByTestId('feedback');
    await expect(feedback).toHaveAttribute('data-kind', 'solution');
    await expect(feedback).toContainText('Die richtige Antwort ist markiert.');
    await expect(page.locator('.mu-choice--revealed, .mu-blank--revealed').first()).toBeVisible();
    const answers = backend.callsTo('POST', `/api/learn/runs/${backend.learn.current.id}/answers`);
    expect(answers).toHaveLength(2);
    await player.next();

    await player.waitForItem(1);
    await player.answerWrong(1);
    await player.answerCorrectly(1);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
    await player.next();
    await player.waitForItem(2);
    await player.answerCorrectly(2);
    await player.next();

    await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', '1');
    await expect(page.getByTestId('results-next')).toHaveCount(0);
  });

  test('the exit button asks first and then returns to the map', async ({ page }) => {
    const { player } = await openLevel(page, { learn: { demoSeen: [FIRST] } });
    await player.waitForItem(0);

    await page.getByTestId('exit').click();
    await expect(page.getByTestId('exit-dialog')).toBeVisible();
    await page.getByTestId('exit-cancel').click();
    await expect(page.getByTestId('exit-dialog')).toHaveCount(0);
    await expect(page.getByTestId('prompt-text')).toBeVisible();

    await page.getByTestId('exit').click();
    await page.getByTestId('exit-confirm').click();
    await expect(page).toHaveURL(/\/learn$/);
  });
});

test.describe('"Zeig mir" demo', () => {
  test('plays before the first run, can be replayed and reopened', async ({ page }) => {
    const { player } = await openLevel(page);
    const demo = page.getByTestId('demo');
    await expect(demo).toBeVisible();
    await expect(page.getByTestId('demo-say')).toContainText('Äpfel');
    await expect(page.getByTestId('demo-pointer')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('demo-again').click();
    await expect(page.getByTestId('demo-pointer')).toHaveCount(0);
    await page.getByTestId('demo-go').click();
    await player.waitForItem(0);

    await page.getByTestId('show-demo').click();
    await expect(demo).toBeVisible();
    await page.getByTestId('demo-go').click();
    await player.waitForItem(0);
  });

  test('is skipped once it was seen, but stays available', async ({ page }) => {
    const { player } = await openLevel(page, { learn: { demoSeen: [FIRST] } });
    await player.waitForItem(0);
    await expect(page.getByTestId('demo')).toHaveCount(0);
    await expect(page.getByTestId('show-demo')).toBeVisible();
    await page.getByTestId('show-demo').click();
    await expect(page.getByTestId('demo')).toBeVisible();
    await page.getByTestId('demo-go').click();
    await player.waitForItem(0);
  });
});

test.describe('practice and limits', () => {
  test('practice mixes known skills and ends with stars', async ({ page }) => {
    const backend = await openMap(page, { learn: { progress: { [FIRST]: 3 }, items: 4 } });
    await page.getByTestId('practice').click();
    await expect(page).toHaveURL(/\/learn\/practice$/);
    const player = new PlayerPage(page, backend.learn);

    await player.playThrough();
    await expect(page.getByTestId('page-title')).toHaveText('Schön, dass du geübt hast!');
    await expect(page.getByTestId('results-next')).toHaveCount(0);
    expect(backend.callsTo('POST', '/api/learn/practice/runs')).toHaveLength(1);
  });

  test('the daily limit puts Murmeli to sleep and leads back to the profiles', async ({ page }) => {
    const backend = await openMap(page, { learn: { dailyLimitReached: true } });
    await page.getByTestId(`level-${FIRST}`).click();

    const rest = page.getByTestId('daily-limit');
    await expect(rest).toContainText('Murmeli macht jetzt eine Pause.');
    await expect(rest.locator('mu-mascot')).toHaveAttribute('data-pose', 'sleeping');
    await page.getByTestId('rest-back').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/kids/deactivate')).toHaveLength(1);
  });
});

test.describe('narration', () => {
  test('plays the prompt segments in order for a pre-reader', async ({ page }) => {
    const backend = await mockFamily(page, { kids: [MIA], learn: { demoSeen: [FIRST] } });
    backend.on('POST /api/learn/levels/:levelId/runs', () => ({
      status: 201,
      body: {
        runId: 'run-audio',
        demoSeen: true,
        items: [
          {
            index: 0,
            type: 'count-objects',
            prompt: {
              text: 'Wie viele Äpfel siehst du?',
              speak: ['Wie viele', 'Äpfel', 'siehst du?'],
            },
            payload: {
              arrangement: 'line',
              objects: [
                { pictureId: 'apple', x: 0.1, y: 0.5 },
                { pictureId: 'apple', x: 0.3, y: 0.5 },
              ],
              answerMode: 'choices',
              choices: [
                { id: 'a', value: 2 },
                { id: 'b', value: 3 },
              ],
            },
          },
        ],
      },
    }));
    await page.goto('/');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await page.getByTestId(`level-${FIRST}`).click();

    await expect(page.getByTestId('speak')).toBeVisible();
    await expect
      .poll(() => backend.audioRequests)
      .toEqual([
        'de-CH/27595514d1e7a67d.opus',
        'de-CH/bd7c183824071a9b.opus',
        'de-CH/c83f2c69cee180aa.opus',
      ]);
  });
});

const TYPES: readonly ExerciseTypeId[] = [
  'count-objects',
  'number-recognition',
  'ten-frame',
  'compare',
  'number-line',
  'add-sub',
  'number-bond',
  'number-wall',
  'sequence',
  'shape-pick',
  'letter-sound',
  'initial-sound',
  'syllables',
  'word-picture',
  'build-word',
];

test.describe('exercise types', () => {
  for (const type of TYPES) {
    test(`${type} renders and accepts the right answer`, async ({ page }) => {
      const { backend, player } = await openLevel(page, {
        learn: { exerciseType: type, items: 2, seed: 7 },
      });
      await player.waitForItem(0);
      await player.answerCorrectly(0);
      await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
      const [call] = backend.callsTo('POST', `/api/learn/runs/${backend.learn.current.id}/answers`);
      expect(call?.body).toEqual({ index: 0, answer: backend.learn.solution(0) });
    });
  }
});

test.describe('wellbeing', () => {
  test('suggests a break between items after 20 minutes of play', async ({ page }) => {
    await page.clock.install();
    const { player } = await openLevel(page, { learn: { demoSeen: [FIRST], items: 3 } });
    await player.waitForItem(0);
    for (let step = 0; step < 5; step += 1) {
      await page.clock.fastForward('04:30');
      await page.getByTestId('prompt-text').click();
    }
    await player.answerCorrectly(0);
    await player.next();

    const reminder = page.getByTestId('break-reminder');
    await expect(reminder).toContainText('Zeit für eine kleine Pause? Streck dich mal!');
    await page.getByTestId('break-continue').click();
    await player.waitForItem(1);

    await player.answerCorrectly(1);
    await player.next();
    await player.waitForItem(2);
    await expect(reminder).toHaveCount(0);
  });

  test('taking the break goes back to the profile picker', async ({ page }) => {
    await page.clock.install();
    const { player } = await openLevel(page, { learn: { demoSeen: [FIRST], items: 3 } });
    await player.waitForItem(0);
    for (let step = 0; step < 5; step += 1) {
      await page.clock.fastForward('04:30');
      await page.getByTestId('prompt-text').click();
    }
    await player.answerCorrectly(0);
    await player.next();
    await page.getByTestId('break-pause').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
  });

  test('explains kindly when there is nothing to practice yet', async ({ page }) => {
    const backend = await openMap(page);
    backend.on('POST /api/learn/practice/runs', apiError(409, 'NOTHING_TO_PRACTICE'));
    await page.getByTestId('practice').click();
    await expect(page.getByTestId('form-error')).toContainText(
      'Gerade gibt es nichts zu üben. Spiel doch eine neue Stufe!',
    );
  });
});
