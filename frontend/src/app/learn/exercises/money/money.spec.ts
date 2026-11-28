import { TestBed } from '@angular/core/testing';
import type { MoneyItem, MoneyPayload } from '@murmeli/content';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { moneyUrl } from '../../content/learn-content';
import { formatMoney, unitParts } from './money-format';
import { MAX_TRAY, Money } from './money';

const coin = (denomination: string, label: string): MoneyItem => ({
  denomination,
  label,
  kind: 'coin',
  file: `money/${denomination}.svg`,
});

describe('money helpers', () => {
  it('writes amounts like price tags', () => {
    expect(formatMoney(7, 'CHF', 'major')).toBe('7 Fr.');
    expect(formatMoney(70, 'CHF', 'minor')).toBe('70 Rp.');
    expect(formatMoney(7, 'USD', 'major')).toBe('$7');
    expect(formatMoney(25, 'USD', 'minor')).toBe('25¢');
    expect(unitParts('USD', 'major')).toEqual({ before: '$', after: '' });
  });

  it('only builds URLs for money pictures', () => {
    expect(moneyUrl('money/chf-5rp.svg')).toBe('/pictures/money/chf-5rp.svg');
    expect(moneyUrl('../secret.svg')).toBe('data:,');
    expect(moneyUrl('money/x.png')).toBe('data:,');
  });
});

describe('Money', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });

  it('counts the money with the keypad, with the unit next to the blank', async () => {
    const payload: MoneyPayload = {
      mode: 'total',
      currency: 'CHF',
      group: 'major',
      items: [coin('chf-2fr', '2 Fr.'), coin('chf-1fr', '1 Fr.')],
      answerMode: 'keypad',
    };
    const { element, type, click, answers, update } = await renderExercise(Money, { payload });
    const pieces = element.querySelectorAll<HTMLImageElement>('[data-testid="money-items"] img');
    expect([...pieces].map((img) => img.alt)).toEqual(['2 Fr.', '1 Fr.']);
    expect(pieces[0]!.getAttribute('src')).toBe('/pictures/money/chf-2fr.svg');
    expect(element.querySelector('.amount')?.textContent).toContain('Fr.');
    await type('3');
    expect(byTestId(element, 'answer-blank').getAttribute('aria-label')).toBe('Lücke: 3 Fr.');
    await click('check');
    expect(answers).toEqual([{ value: 3 }]);

    await update({ locked: true, cue: { countAlong: true }, reveal: { value: 3 } });
    expect(byTestId(element, 'money-items').classList).toContain('counting');
    expect(byTestId(element, 'answer-blank').classList).toContain('mu-blank--revealed');
  });

  it('counts dollars by choice with the $ in front', async () => {
    const payload: MoneyPayload = {
      mode: 'total',
      currency: 'USD',
      group: 'major',
      items: [{ denomination: 'usd-5', label: '$5', kind: 'note', file: 'money/usd-5.svg' }],
      answerMode: 'choices',
      choices: [
        { id: 'a', value: 5 },
        { id: 'b', value: 6 },
      ],
    };
    const { element, click, answers } = await renderExercise(Money, { payload });
    expect(element.querySelector('mu-money-piece')?.classList).toContain('note');
    expect(element.querySelector('.amount')?.textContent?.trim().startsWith('$')).toBe(true);
    await click('choice-a');
    expect(answers).toEqual([{ value: 5 }]);
  });

  it('pays by tapping coins into the tray and taking them back', async () => {
    const { element, click, answers } = await renderExercise(Money, {
      payload: PAYLOADS['money-chf'],
    });
    expect(byTestId(element, 'money-price').textContent?.trim()).toBe('3 Fr.');
    expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBe('true');
    expect(byTestId(element, 'wallet-chf-1fr').getAttribute('aria-label')).toBe('1 Fr. hinlegen');
    await click('wallet-chf-1fr');
    await click('wallet-chf-1fr');
    await click('wallet-chf-2fr');
    expect(byTestId(element, 'money-status').textContent).toContain('1 Fr., 1 Fr., 2 Fr.');
    await click('tray-0');
    expect(byTestId(element, 'tray-1').getAttribute('aria-label')).toBe('2 Fr. wieder wegnehmen');
    await click('check');
    expect(answers).toEqual([{ coins: ['chf-1fr', 'chf-2fr'] }]);
    await click('tray-0');
    await click('tray-0');
    expect(byTestId(element, 'money-status').textContent).toContain('Lege hier Geld hin.');
  });

  it('stops at 30 coins', async () => {
    const { element, click } = await renderExercise(Money, { payload: PAYLOADS['money-chf'] });
    for (let i = 0; i < MAX_TRAY + 2; i += 1) {
      await click('wallet-chf-1fr');
    }
    expect(element.querySelectorAll('[data-testid^="tray-"]').length).toBe(MAX_TRAY);
    expect(byTestId(element, 'wallet-chf-2fr').getAttribute('aria-disabled')).toBe('true');
  });

  it('places the coins in the demo and points at them', async () => {
    const { element, click, update } = await renderExercise(Money, {
      payload: PAYLOADS['money-chf'],
      locked: true,
      cue: { highlight: 'prompt' },
    });
    expect(byTestId(element, 'money-price').classList).toContain('mu-cue');
    await update({ cue: { placeCoins: true }, reveal: { coins: ['chf-2fr', 'chf-1fr', 'nope'] } });
    const tray = byTestId(element, 'money-tray');
    expect(tray.classList).toContain('placing');
    expect(tray.querySelectorAll('mu-money-piece').length).toBe(2);
    await click('tray-0');
    expect(tray.querySelectorAll('mu-money-piece').length).toBe(2);
    await update({ cue: { tapAnswer: true } });
    expect(byTestId(element, 'demo-pointer')).toBeTruthy();
  });

  it('compares two purses with <, = and >', async () => {
    const payload: MoneyPayload = {
      mode: 'compare',
      currency: 'CHF',
      group: 'minor',
      left: [coin('chf-50rp', '50 Rp')],
      right: [coin('chf-20rp', '20 Rp'), coin('chf-10rp', '10 Rp')],
    };
    const { element, click, answers, update } = await renderExercise(Money, { payload });
    expect(byTestId(element, 'money-left').getAttribute('aria-label')).toBe('Links: 50 Rp');
    expect(byTestId(element, 'money-right').getAttribute('aria-label')).toBe(
      'Rechts: 20 Rp, 10 Rp',
    );
    await click('relation-gt');
    expect(answers).toEqual([{ relation: 'gt' }]);
    expect(element.querySelector('.slot mu-relation-sign')?.getAttribute('data-relation')).toBe(
      'gt',
    );
    expect(byTestId(element, 'relation-gt').querySelector('mu-relation-sign')).not.toBeNull();
    await update({ locked: true, reveal: { relation: 'gt' }, cue: { tapAnswer: true } });
    expect(byTestId(element, 'relation-gt').classList).toContain('mu-choice--revealed');
    await click('relation-lt');
    expect(answers).toHaveLength(1);
  });
});
