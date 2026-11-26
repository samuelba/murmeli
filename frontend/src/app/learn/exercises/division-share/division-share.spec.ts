import { TestBed } from '@angular/core/testing';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { pointer, renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { SHARE_STEP_MS } from '../../player/demo-timing';
import { DivisionShare } from './division-share';

describe('DivisionShare', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shares by tapping plates, resets and answers per plate', async () => {
    const { element, click, answers } = await renderExercise(DivisionShare, {
      payload: PAYLOADS['division-share'],
    });
    expect(element.querySelectorAll('.basket .item').length).toBe(6);
    expect(byTestId(element, 'share-basket').getAttribute('aria-label')).toBe('Im Korb: noch 6');
    await click('plate-0');
    await click('plate-0');
    await click('plate-2');
    expect(byTestId(element, 'plate-0').getAttribute('aria-label')).toBe('Teller 1: 2 × Apfel');
    expect(element.querySelectorAll('.basket .item').length).toBe(3);
    await click('share-reset');
    expect(element.querySelectorAll('.plate__item').length).toBe(0);
    for (let i = 0; i < 7; i += 1) {
      await click(`plate-${i % 3}`);
    }
    expect(element.querySelectorAll('.plate__item').length).toBe(6);
    expect(byTestId(element, 'plate-0').getAttribute('aria-disabled')).toBe('true');
    await click('choice-d2');
    expect(answers).toEqual([{ value: 2 }]);
  });

  it('drags an object from the basket onto a plate', async () => {
    const { element, fixture } = await renderExercise(DivisionShare, {
      payload: PAYLOADS['division-share'],
    });
    const plate = byTestId(element, 'plate-1');
    document.elementFromPoint = vi.fn((x: number) => (x > 100 ? plate : document.body));
    const object = byTestId(element, 'share-object');
    pointer(object, 'pointerdown', 10, 10, { pointerType: 'touch' });
    pointer(object, 'pointermove', 60, 60, { pointerType: 'touch' });
    await fixture.whenStable();
    expect(element.querySelector('.ghost')).not.toBeNull();
    pointer(object, 'pointerup', 150, 150, { pointerType: 'touch' });
    await fixture.whenStable();
    expect(plate.querySelectorAll('.plate__item').length).toBe(1);
    expect(element.querySelector('.ghost')).toBeNull();

    const next = byTestId(element, 'share-object');
    pointer(next, 'pointerdown', 10, 10);
    pointer(next, 'pointermove', 20, 20, { pointerId: 9 });
    pointer(next, 'pointerup', 20, 20);
    await fixture.whenStable();
    expect(element.querySelectorAll('.plate__item').length).toBe(1);
  });

  it('shares one by one in the demo and fills every plate when revealed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { element, fixture, update } = await renderExercise(DivisionShare, {
      payload: PAYLOADS['division-share'],
      locked: true,
      cue: { countAlong: true },
    });
    expect(element.querySelector('[data-testid="share-reset"]')).toBeNull();
    vi.advanceTimersByTime(SHARE_STEP_MS * 4);
    await fixture.whenStable();
    expect(element.querySelectorAll('.plate__item').length).toBe(4);
    vi.advanceTimersByTime(SHARE_STEP_MS * 10);
    await fixture.whenStable();
    expect(element.querySelectorAll('.plate__item').length).toBe(6);
    vi.useRealTimers();
    await update({ cue: { tapAnswer: true }, reveal: { value: 2 } });
    expect(byTestId(element, 'answer-blank').textContent).toContain('2');
    expect(byTestId(element, 'plate-2').querySelectorAll('.plate__item').length).toBe(2);
  });

  it('shares at once with reduced motion and ignores taps while locked', async () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    try {
      const { element, click } = await renderExercise(DivisionShare, {
        payload: { ...PAYLOADS['division-share'], answerMode: 'keypad', choices: undefined },
        locked: true,
        cue: { countAlong: true },
      });
      expect(element.querySelectorAll('.plate__item').length).toBe(6);
      await click('plate-0');
      expect(element.querySelectorAll('.plate__item').length).toBe(6);
      expect(byTestId(element, 'key-1')).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });
});
