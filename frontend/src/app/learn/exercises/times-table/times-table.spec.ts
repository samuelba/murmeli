import { TestBed } from '@angular/core/testing';
import type { TimesTablePayload } from '@murmeli/content';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { TimesTable } from './times-table';

describe('TimesTable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });

  it('shows a · b = ? and answers with the keypad', async () => {
    const { element, answers, click, type } = await renderExercise(TimesTable, {
      payload: PAYLOADS['times-table'],
    });
    const equation = byTestId(element, 'equation');
    expect(equation.textContent).toContain('3');
    expect(equation.textContent).toContain('·');
    expect(equation.textContent).toContain('mal');
    await type('6');
    expect(byTestId(element, 'answer-blank').textContent).toContain('6');
    expect(byTestId(element, 'answer-blank').getAttribute('aria-label')).toBe('Lücke: 6');
    await click('check');
    expect(answers).toEqual([{ value: 6 }]);
  });

  it('offers dots for small products, one row per group', async () => {
    const { element, click, update } = await renderExercise(TimesTable, {
      payload: PAYLOADS['times-table'],
    });
    expect(element.querySelector('[data-testid="times-dots"]')).toBeNull();
    const toggle = byTestId(element, 'dots-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await click('dots-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const groups = element.querySelectorAll('.group');
    expect(groups.length).toBe(3);
    expect(groups[0]!.querySelectorAll('.dot').length).toBe(2);
    await click('dots-toggle');
    expect(element.querySelector('[data-testid="times-dots"]')).toBeNull();

    await update({ payload: { ...PAYLOADS['times-table'], a: 7, b: 5 } });
    expect(element.querySelector('[data-testid="dots-toggle"]')).toBeNull();
  });

  it('shows the missing factor as rows of the product', async () => {
    const payload: TimesTablePayload = {
      mode: 'missing-factor',
      a: 4,
      b: null,
      product: 12,
      answerMode: 'choices',
      choices: [
        { id: 'c2', value: 2 },
        { id: 'c3', value: 3 },
      ],
    };
    const { element, click, answers } = await renderExercise(TimesTable, { payload });
    await click('dots-toggle');
    const groups = element.querySelectorAll('.group');
    expect(groups.length).toBe(4);
    expect(groups[0]!.querySelectorAll('.dot').length).toBe(3);
    await click('choice-c3');
    expect(answers).toEqual([{ value: 3 }]);
  });

  it('continues a row, with an unknown group of dots', async () => {
    const payload: TimesTablePayload = {
      mode: 'row',
      a: null,
      b: null,
      product: null,
      row: 5,
      items: [5, 10, 15, null],
      answerMode: 'keypad',
    };
    const { element, click, update } = await renderExercise(TimesTable, { payload });
    expect(byTestId(element, 'times-row').getAttribute('aria-label')).toBe('Die 5er-Reihe');
    expect(element.querySelectorAll('.card').length).toBe(4);
    await click('dots-toggle');
    expect(element.querySelectorAll('.group').length).toBe(4);
    expect(element.querySelectorAll('.group--unknown').length).toBe(1);
    await update({ payload: { ...payload, row: 10, items: [10, 20, 30, null] } });
    expect(element.querySelector('[data-testid="dots-toggle"]')).toBeNull();
  });

  it('hops along the groups in the demo and reveals the answer', async () => {
    const { element, update } = await renderExercise(TimesTable, {
      payload: PAYLOADS['times-table'],
      locked: true,
      cue: { hop: true },
    });
    expect(element.querySelector('[data-testid="dots-toggle"]')).toBeNull();
    expect(byTestId(element, 'times-dots').classList).toContain('hopping');
    expect([...element.querySelectorAll('.running')].map((node) => node.textContent)).toEqual([
      '2',
      '4',
      '6',
    ]);
    await update({ cue: { tapAnswer: true }, reveal: { value: 6 } });
    expect(byTestId(element, 'answer-blank').classList).toContain('mu-blank--revealed');
    expect(byTestId(element, 'demo-pointer')).toBeTruthy();
  });

  it('skips dots when a factor is zero or missing', async () => {
    const { element, update } = await renderExercise(TimesTable, {
      payload: { ...PAYLOADS['times-table'], a: 0 },
    });
    expect(element.querySelector('[data-testid="dots-toggle"]')).toBeNull();
    await update({
      payload: { mode: 'row', a: null, b: null, product: null, answerMode: 'keypad' },
    });
    expect(element.querySelector('[data-testid="dots-toggle"]')).toBeNull();
  });
});
