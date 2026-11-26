import { type Page, expect, test } from '@playwright/test';
import { PASSWORD, kid, mockFamily } from '../helpers/family';

const MIA = kid();
const LEO = kid({
  id: '0190a000-0000-7000-8000-0000000000a2',
  nickname: 'Leo',
  hasPin: true,
  avatar: { animal: 'owl', accessory: null, background: '#C3F0C8' },
});
const LEO_PIN = [0, 4, 8, 2];

async function tapPin(page: Page, pin: number[]) {
  for (const index of pin) {
    await page.getByTestId(`pin-picture-${index}`).click();
  }
}

test.describe('profile picker', () => {
  test('a kid without a PIN goes straight to the learning page', async ({ page }) => {
    const backend = await mockFamily(page, { kids: [MIA, LEO] });
    await page.goto('/');

    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    await page.getByTestId(`kid-tile-${MIA.id}`).click();

    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByTestId('page-title')).toHaveText('Hallo Mia!');
    await expect(page.getByTestId('kid-chip')).toContainText('Mia');
    expect(backend.callsTo('POST', `/api/kids/${MIA.id}/activate`)[0].body).toEqual({});

    await page.getByTestId('switch-profile').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/kids/deactivate')).toHaveLength(1);
  });

  test('the right picture PIN opens the profile', async ({ page }) => {
    const backend = await mockFamily(page, { kids: [MIA, LEO], pins: { [LEO.id]: LEO_PIN } });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${LEO.id}`).click();

    await expect(page.getByTestId('pin-view')).toBeVisible();
    await expect(page.getByTestId('page-title')).toBeFocused();
    await tapPin(page, LEO_PIN.slice(0, 2));
    await expect(page.getByTestId('pin-progress')).toHaveText('2 von 4 Bildern gewählt');
    await tapPin(page, LEO_PIN.slice(2));

    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByTestId('page-title')).toHaveText('Hallo Leo!');
    expect(backend.callsTo('POST', `/api/kids/${LEO.id}/activate`)[0].body).toEqual({
      pin: LEO_PIN,
    });
  });

  test('the PIN pad works with the keyboard', async ({ page }) => {
    await mockFamily(page, { kids: [LEO], pins: { [LEO.id]: LEO_PIN } });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${LEO.id}`).click();
    await page.getByTestId('pin-picture-0').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('9');
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('pin-progress')).toHaveText('1 von 4 Bildern gewählt');
    await page.keyboard.press('5');
    await page.keyboard.press('9');
    await page.keyboard.press('3');

    await expect(page).toHaveURL(/\/learn$/);
  });

  test('a wrong PIN shows the encouraging mascot', async ({ page }) => {
    await mockFamily(page, { kids: [LEO], pins: { [LEO.id]: LEO_PIN } });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${LEO.id}`).click();
    await tapPin(page, [1, 1, 1, 1]);

    const feedback = page.getByTestId('pin-feedback');
    await expect(feedback).toContainText('Fast! Probier es nochmal.');
    await expect(feedback.locator('mu-mascot')).toHaveAttribute('data-pose', 'encouraging');
    await expect(page.getByTestId('pin-progress')).toHaveText('0 von 4 Bildern gewählt');
    await expect(page.getByTestId('pin-picture-0')).toBeEnabled();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a locked PIN pauses the pad and says how long to wait', async ({ page }) => {
    await mockFamily(page, { kids: [LEO], lockedKids: [LEO.id] });
    await page.goto('/');
    await page.getByTestId(`kid-tile-${LEO.id}`).click();
    await tapPin(page, LEO_PIN);

    await expect(page.getByTestId('pin-feedback')).toContainText('in 10 Minuten');
    await expect(page.getByTestId('pin-picture-0')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('pin-back').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
  });
});

test.describe('parent gate', () => {
  test('asks for the password before the parent area', async ({ page }) => {
    const backend = await mockFamily(page, { kids: [MIA] });
    await page.goto('/');
    await page.getByTestId('parents-button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('parent-gate-password')).toBeFocused();
    await page.getByTestId('parent-gate-password').fill('nope nope nope');
    await page.getByTestId('parent-gate-submit').click();
    await expect(dialog.getByTestId('form-error')).toContainText('Passwort stimmen nicht');

    await page.getByTestId('parent-gate-password').fill(PASSWORD);
    await page.getByTestId('parent-gate-submit').click();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByTestId('page-title')).toHaveText('Kinderprofile');
    await expect(page.getByTestId(`kid-row-${MIA.id}`)).toContainText('Kindergarten 2');
    expect(backend.callsTo('POST', '/api/auth/parent-gate')).toHaveLength(2);

    await page.getByTestId('lock-parent-area').click();
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
    expect(backend.callsTo('POST', '/api/auth/parent-gate/lock')).toHaveLength(1);
  });

  test('cancelling the gate stays on the profile picker', async ({ page }) => {
    await mockFamily(page, { kids: [MIA] });
    await page.goto('/');
    await page.getByTestId('parents-button').click();
    await page.getByTestId('parent-gate-cancel').click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('page-title')).toHaveText('Wer lernt heute?');
  });
});

test.describe('kid profiles', () => {
  test('creates a kid with the avatar builder and a picture PIN', async ({ page }) => {
    const backend = await mockFamily(page, { gate: true });
    await page.goto('/');
    await expect(page.getByTestId('picker-empty')).toBeVisible();
    await page.getByTestId('add-profile').click();
    await expect(page).toHaveURL(/\/parent\/kids\/new$/);

    await page.getByTestId('avatar-animal-penguin').check({ force: true });
    await page.getByTestId('avatar-accessory-sunglasses').check({ force: true });
    await page.getByTestId('avatar-background-4').check({ force: true });
    await expect(
      page.getByTestId('avatar-preview').locator('img[src$="accessories/sunglasses.svg"]'),
    ).toHaveCount(1);
    await page.getByTestId('kid-nickname').fill('Pinguin Paul');
    await page.getByTestId('kid-class').click();
    await page.getByRole('option', { name: '1. Klasse' }).click();

    await page.getByTestId('pin-set').locator('input').check();
    await tapPin(page, [3, 1, 4, 1]);
    await expect(page.getByTestId('pin-setup-prompt')).toContainText('noch einmal');
    await tapPin(page, [3, 1, 4, 2]);
    await expect(page.getByText('Die Bilder waren nicht gleich')).toBeVisible();
    await tapPin(page, [3, 1, 4, 1]);
    await tapPin(page, [3, 1, 4, 1]);
    await expect(page.getByTestId('pin-setup-prompt')).toContainText('Bilder-PIN festgelegt');

    await page.getByTestId('kid-save').click();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByText('Pinguin Paul')).toBeVisible();
    expect(backend.callsTo('POST', '/api/kids')[0].body).toEqual({
      nickname: 'Pinguin Paul',
      avatar: { animal: 'penguin', accessory: 'sunglasses', background: '#B9D3FF' },
      startClass: '1',
      language: 'de-CH',
      dailyLimitMinutes: null,
      soundEnabled: true,
      readAloud: 'auto',
      pin: [3, 1, 4, 1],
    });
  });

  test('validates the nickname', async ({ page }) => {
    const backend = await mockFamily(page, { gate: true });
    await page.goto('/parent/kids/new');
    await page.getByTestId('kid-nickname').fill('<script>');
    await page.getByTestId('kid-save').click();

    await expect(page.getByText('Nur Buchstaben, Zahlen')).toBeVisible();
    expect(backend.callsTo('POST', '/api/kids')).toEqual([]);
  });
});
