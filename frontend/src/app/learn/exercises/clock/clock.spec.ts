import { TestBed } from '@angular/core/testing';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { Clock } from './clock';
import { handAngles } from './clock-face';

describe('clock hands', () => {
  it('moves the hour hand on with the minutes', () => {
    expect(handAngles(3, 0)).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(2, 30)).toEqual({ hour: 75, minute: 180 });
    expect(handAngles(12, 45)).toEqual({ hour: 22.5, minute: 270 });
    expect(handAngles(9, 15).hour).toBeCloseTo(277.5);
  });
});

describe('Clock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });

  it('draws the face with 12 numbers and 60 ticks, and says where the hands point', async () => {
    const { element, update } = await renderExercise(Clock, { payload: PAYLOADS.clock });
    expect(element.querySelectorAll('.number').length).toBe(12);
    expect(element.querySelectorAll('.tick').length).toBe(60);
    expect(element.querySelectorAll('.tick--hour').length).toBe(12);
    expect(byTestId(element, 'hour-hand').getAttribute('transform')).toBe('rotate(75 100 100)');
    expect(byTestId(element, 'minute-hand').getAttribute('transform')).toBe('rotate(180 100 100)');
    const face = byTestId(element, 'clock-face');
    expect(face.getAttribute('role')).toBe('img');
    expect(face.getAttribute('aria-label')).toBe(
      'Uhr. Der kurze Zeiger steht zwischen 2 und 3. Der lange Zeiger zeigt auf die 6.',
    );
    await update({ payload: { ...PAYLOADS.clock, hour: 12, minute: 0 } });
    expect(face.getAttribute('aria-label')).toBe(
      'Uhr. Der kurze Zeiger zeigt auf die 12. Der lange Zeiger zeigt auf die 12.',
    );
    await update({ payload: { ...PAYLOADS.clock, hour: 1, minute: 7 } });
    expect(face.getAttribute('aria-label')).toContain('zeigt auf Minute 7');
  });

  it('shows words and digital labels and answers on tap', async () => {
    const { element, click, answers } = await renderExercise(Clock, { payload: PAYLOADS.clock });
    const choice = byTestId(element, 'choice-k1');
    expect(choice.textContent).toContain('halb drei');
    expect(choice.textContent).toContain('2:30');
    expect(choice.getAttribute('aria-label')).toBe('halb drei, 2:30');
    await click('choice-k1');
    expect(choice.classList).toContain('mu-choice--selected');
    expect(answers).toEqual([{ choiceId: 'k1' }]);
  });

  it('shows digital-only labels large and marks the revealed time', async () => {
    const payload = {
      hour: 4,
      minute: 10,
      choices: [
        { id: 'a', label: '4:10' },
        { id: 'b', label: '2:20' },
      ],
    };
    const { element, click, answers, update } = await renderExercise(Clock, {
      payload,
      locked: true,
      cue: { highlight: 'clock' },
    });
    expect(byTestId(element, 'clock-face').classList).toContain('mu-cue');
    expect(element.querySelector('.words--digital')).not.toBeNull();
    await click('choice-a');
    expect(answers).toEqual([]);
    await update({ reveal: { choiceId: 'a' }, cue: { tapAnswer: true } });
    const revealed = byTestId(element, 'choice-a');
    expect(revealed.classList).toContain('mu-choice--revealed');
    expect(revealed.getAttribute('aria-label')).toBe('4:10, Richtig');
    expect(byTestId(element, 'demo-pointer')).toBeTruthy();
  });
});
