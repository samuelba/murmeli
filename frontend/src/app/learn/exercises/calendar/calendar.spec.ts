import { TestBed } from '@angular/core/testing';
import type { CalendarPayload } from '@murmeli/content';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { Calendar } from './calendar';
import { ringSteps } from './calendar-math';

const WEEK = PAYLOADS.calendar;

describe('ringSteps', () => {
  it('counts the cards from the start to the target', () => {
    expect(ringSteps(WEEK.ring, 2)).toBe(3);
    expect(ringSteps(WEEK.ring, null)).toBe(0);
    expect(ringSteps([], 2)).toBe(0);
    expect(ringSteps(WEEK.ring, 9)).toBe(0);
  });
});

describe('Calendar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });

  it('shows the week strip with the named day and answers on tap', async () => {
    const { element, click, answers } = await renderExercise(Calendar, { payload: WEEK });
    const cards = element.querySelectorAll('.card');
    expect(cards.length).toBe(7);
    expect(byTestId(element, 'card-2').classList).toContain('card--focus');
    expect(byTestId(element, 'card-5').classList).toContain('card--weekend');
    expect(byTestId(element, 'calendar-ring').getAttribute('aria-label')).toBe('Die Wochentage');
    expect(element.querySelectorAll('mu-speak').length).toBe(3);
    await click('choice-w1');
    expect(byTestId(element, 'choice-w1').classList).toContain('mu-choice--selected');
    expect(answers).toEqual([{ choiceId: 'w1' }]);
  });

  it('marks the gap without naming the missing day', async () => {
    const payload: CalendarPayload = {
      ...WEEK,
      ask: 'missing',
      focus: null,
      name: null,
      gap: 3,
      ring: WEEK.ring.map((card) => (card.index === 3 ? { ...card, label: null } : card)),
    };
    const { element } = await renderExercise(Calendar, { payload });
    const gap = byTestId(element, 'card-3');
    expect(gap.classList).toContain('card--gap');
    expect(gap.querySelector('.card__name')?.textContent?.trim()).toBe('?');
    expect(gap.querySelector('.card__name')?.getAttribute('aria-hidden')).toBe('true');
    expect(gap.querySelector('.mu-visually-hidden')?.textContent?.trim()).toBe('Lücke');
    expect(element.querySelector('.ring')?.textContent).not.toContain('Donnerstag');
  });

  it('shows a calendar page with "today" when the strip is hidden', async () => {
    const payload: CalendarPayload = {
      ...WEEK,
      ask: 'relative',
      ring: [],
      relation: 'tomorrow',
    };
    const { element } = await renderExercise(Calendar, { payload });
    const page = byTestId(element, 'calendar-page');
    expect(page.textContent).toContain('Mittwoch');
    expect(page.textContent).toContain('heute');
  });

  it('tags the named day as today in the strip', async () => {
    const payload: CalendarPayload = { ...WEEK, ask: 'relative', relation: 'yesterday' };
    const { element } = await renderExercise(Calendar, { payload });
    const card = byTestId(element, 'card-2');
    expect(card.textContent?.replace(/\s+/g, ' ').trim()).toBe('Mittwoch, heute');
    expect(byTestId(element, 'card-3').querySelector('.today')).toBeNull();
  });

  it('shows the months of the year as a grid', async () => {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August'];
    const payload: CalendarPayload = {
      ...WEEK,
      unit: 'month',
      ask: 'season',
      ring: months.map((label, index) => ({ index, label })),
      focus: 6,
      name: 'Juli',
      choices: [
        { id: 'm1', label: 'Sommer' },
        { id: 'm2', label: 'Winter' },
      ],
    };
    const { element } = await renderExercise(Calendar, { payload });
    const ring = byTestId(element, 'calendar-ring');
    expect(ring.getAttribute('data-unit')).toBe('month');
    expect(ring.getAttribute('aria-label')).toBe('Die Monate');
    expect(byTestId(element, 'card-6').classList).toContain('card--focus');
    expect(byTestId(element, 'card-5').classList).not.toContain('card--weekend');
  });

  it('draws a scene and describes it without naming the answer', async () => {
    const payload: CalendarPayload = {
      ...WEEK,
      unit: 'season',
      ask: 'scene',
      ring: [],
      focus: null,
      name: null,
      scene: 3,
      choices: [
        { id: 's1', label: 'Winter' },
        { id: 's2', label: 'Sommer' },
      ],
    };
    const { element, update } = await renderExercise(Calendar, {
      payload,
      locked: true,
      cue: { highlight: 'calendar' },
    });
    const scene = () => element.querySelector('mu-calendar-scene')!;
    expect(scene().getAttribute('data-scene')).toBe('winter');
    expect(scene().getAttribute('role')).toBe('img');
    expect(scene().getAttribute('aria-label')).toContain('Schnee');
    expect(element.querySelectorAll('.flake').length).toBeGreaterThan(0);
    expect(byTestId(element, 'calendar-stage').classList).toContain('mu-cue');
    await update({ payload: { ...payload, unit: 'daytime', scene: 3 } });
    expect(scene().getAttribute('data-scene')).toBe('night');
    expect(element.querySelector('.moon')).not.toBeNull();
    await update({ payload: { ...payload, unit: 'daytime', scene: 0 } });
    expect(scene().getAttribute('data-scene')).toBe('morning');
    expect(element.querySelector('.sun')?.getAttribute('cx')).toBe('40');
    for (const [index, name] of [
      [0, 'spring'],
      [1, 'summer'],
      [2, 'fall'],
    ] as const) {
      await update({ payload: { ...payload, scene: index } });
      expect(scene().getAttribute('data-scene')).toBe(name);
    }
    await update({ payload: { ...payload, scene: 0 } });
    expect(element.querySelectorAll('.blossom').length).toBeGreaterThan(0);
    await update({ payload: { ...payload, scene: 2 } });
    expect(element.querySelectorAll('.leaf').length).toBeGreaterThan(0);
    await update({ payload: { ...payload, scene: 3 } });
    expect(element.querySelector('.crown')).toBeNull();
  });

  it('counts along the strip up to the named day and reveals the answer', async () => {
    const { element, update, click, answers } = await renderExercise(Calendar, {
      payload: WEEK,
      locked: true,
      cue: { countAlong: true },
    });
    const counted = [...element.querySelectorAll('.card--count')].map((card) =>
      card.getAttribute('data-testid'),
    );
    expect(counted).toEqual(['card-0', 'card-1', 'card-2']);
    await click('choice-w1');
    expect(answers).toEqual([]);
    await update({ reveal: { choiceId: 'w1' }, cue: { tapAnswer: true } });
    const revealed = byTestId(element, 'choice-w1');
    expect(revealed.classList).toContain('mu-choice--revealed');
    expect(revealed.getAttribute('aria-label')).toBe('Donnerstag, Richtig');
    expect(byTestId(element, 'demo-pointer')).toBeTruthy();
    expect(element.querySelectorAll('.card--count').length).toBe(0);
  });
});
