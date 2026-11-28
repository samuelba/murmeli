import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { AuthService } from '../../core/auth/auth.service';
import { KidsService } from '../../core/kids/kids.service';
import {
  KID,
  byTestId,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import { exercise, run } from '../../../testing/learn-testing';
import { BADGE_STORAGE_KEY } from '../badges/kid-badges.service';
import { LearnApi } from '../learn-api.service';
import type { FinishRunResponse } from '../learn.models';
import { BreakTimer } from './break-timer';
import { ExitDialog } from './exit-dialog';
import { Player } from './player';
import { PlayerStore } from './player-store';
import { ProgressDots } from './progress-dots';
import { Results, stepChange, stepLineKey } from './results';

const FINISHED: FinishRunResponse = {
  score: 1,
  stars: 3,
  passed: true,
  unlocked: { levels: ['l2'], worlds: [] },
  newBadges: [],
};

describe('Player', () => {
  let api: Record<keyof LearnApi, ReturnType<typeof vi.fn>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let dialogResult: boolean;
  let narrate: ReturnType<typeof vi.fn>;
  let breakDue: boolean;
  let reminded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    breakDue = false;
    reminded = vi.fn();
    params = new BehaviorSubject(convertToParamMap({ levelId: 'l1' }));
    dialogResult = true;
    narrate = vi.fn().mockResolvedValue(undefined);
    api = {
      practiceCatalog: vi.fn(),
      map: vi.fn().mockResolvedValue({ tracks: [] }),
      startLevel: vi.fn().mockResolvedValue(run()),
      startPractice: vi.fn().mockResolvedValue(run({ demo: undefined, demoSeen: true })),
      answer: vi.fn().mockResolvedValue({ correct: true, attempt: 1 }),
      finish: vi.fn().mockResolvedValue(FINISHED),
    };
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: LearnApi, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        {
          provide: AudioService,
          useValue: {
            stop: vi.fn(),
            speak: vi.fn(),
            play: vi.fn().mockResolvedValue(undefined),
            narrate,
            prefetch: vi.fn().mockResolvedValue(0),
            prepare: vi.fn(),
            autoRead: signal(true),
            available: signal(false),
          },
        },
        { provide: SoundEffects, useValue: { play: vi.fn() } },
        { provide: Dialog, useValue: { open: () => ({ closed: of(dialogResult) }) } },
        { provide: BreakTimer, useValue: { due: () => breakDue, reminded } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => resetDocumentState());

  async function open() {
    const result = await renderComponent(Player);
    await settle(result.fixture);
    return result;
  }

  it('shows the demo first, then the items with feedback', async () => {
    const { element, fixture } = await open();
    expect(byTestId(element, 'demo')).toBeTruthy();
    expect(byTestId(element, 'demo-say').textContent).toContain('Schau, hier sind Äpfel.');
    byTestId(element, 'demo-again').click();
    byTestId(element, 'demo-go').click();
    await settle(fixture);

    expect(byTestId(element, 'prompt-text').textContent?.trim()).toBe('Aufgabe 1');
    expect(document.activeElement).toBe(byTestId(element, 'prompt-text'));
    expect(byTestId(element, 'prompt-text').getAttribute('aria-describedby')).toBeNull();
    expect(byTestId(element, 'progress-text').textContent).toContain('Aufgabe 1 von 2');
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    expect(byTestId(element, 'feedback').getAttribute('data-kind')).toBe('correct');
    expect(element.querySelector('mu-confetti')).not.toBeNull();

    byTestId(element, 'next').click();
    await settle(fixture);
    expect(byTestId(element, 'exercise-letter-sound')).toBeTruthy();
    byTestId(element, 'show-demo').click();
    await settle(fixture);
    expect(byTestId(element, 'demo')).toBeTruthy();
  });

  it('shows a hint after a wrong answer and the solution after the second', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    api.answer
      .mockResolvedValueOnce({ correct: false, attempt: 1, hint: 'touch-each' })
      .mockResolvedValueOnce({ correct: false, attempt: 2, solution: { value: 3 } });
    const { element, fixture } = await open();
    byTestId(element, 'choice-c2').click();
    await settle(fixture);
    expect(byTestId(element, 'hint-text').textContent).toBe(
      'Tippe beim Zählen jedes Bild einmal an.',
    );
    byTestId(element, 'choice-c4').click();
    await settle(fixture);
    expect(byTestId(element, 'feedback').getAttribute('data-kind')).toBe('solution');
    expect(byTestId(element, 'choice-c3').classList).toContain('mu-choice--revealed');
  });

  it('ends with the results and their three ways on', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true, items: [run().items[0]!] }));
    api.map.mockResolvedValue({
      tracks: [
        {
          id: 'math',
          title: 'Mathe',
          icon: 'math',
          worlds: [
            {
              id: 'w',
              title: 'W',
              scene: 'meadow',
              grade: 'KG1',
              state: 'unlocked',
              stars: 0,
              maxStars: 6,
              levels: [
                { id: 'l1', title: 'A', state: 'passed', stars: 3 },
                { id: 'l2', title: 'B', state: 'unlocked', stars: 0 },
              ],
            },
          ],
        },
      ],
    });
    const { element, fixture } = await open();
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    byTestId(element, 'next').click();
    await settle(fixture);

    expect(byTestId(element, 'result-stars').getAttribute('aria-label')).toBe('3 von 3 Sternen');
    expect(byTestId(element, 'page-title').textContent).toContain('Wow, alle Sterne!');
    expect(byTestId(element, 'unlocked-level')).toBeTruthy();
    expect(narrate).toHaveBeenCalledWith([
      'Wow, alle Sterne!',
      'Eine neue Stufe ist offen!',
      'Weiter zur nächsten Stufe',
    ]);
    byTestId(element, 'results-next').click();
    expect(navigate).toHaveBeenCalledWith(['/learn/level', 'l2']);
    byTestId(element, 'results-map').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn');
    byTestId(element, 'results-again').click();
    await settle(fixture);
    expect(api.startLevel).toHaveBeenCalledTimes(2);
  });

  it('reads the first demo bubble through focus and later ones through a live region', async () => {
    const { element, fixture } = await open();
    const live = byTestId(element, 'demo-live');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent?.trim()).toBe('');
    expect(byTestId(element, 'demo-say').getAttribute('aria-live')).toBeNull();
    expect(document.activeElement).toBe(byTestId(element, 'demo-say').querySelector('h1'));

    byTestId(element, 'demo-again').click();
    await settle(fixture);
    expect(live.textContent?.trim()).toBe('Schau, hier sind Äpfel.');
  });

  it('celebrates new badges and keeps them for the shelf', async () => {
    TestBed.inject(AuthService).setActiveKid(KID);
    api.startLevel.mockResolvedValue(run({ demoSeen: true, items: [run().items[0]!] }));
    api.finish.mockResolvedValue({ ...FINISHED, newBadges: ['first-level', 'future-badge'] });
    const { element, fixture } = await open();
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    byTestId(element, 'next').click();
    await settle(fixture);

    expect(byTestId(element, 'new-badges').textContent).toContain('Du hast ein neues Abzeichen!');
    expect(element.querySelectorAll('[data-testid^="new-badge-"]')).toHaveLength(1);
    expect(byTestId(element, 'new-badge-first-level').textContent).toContain('Erster Wegweiser');
    expect(narrate).toHaveBeenCalledWith([
      'Wow, alle Sterne!',
      'Eine neue Stufe ist offen!',
      'Du hast ein neues Abzeichen!',
      'Erster Wegweiser',
    ]);
    expect(JSON.parse(localStorage.getItem(`${BADGE_STORAGE_KEY}:${KID.id}`)!)).toEqual([
      'first-level',
    ]);
  });

  it('suggests a break between items after a long stretch, never mid-item', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    const deactivate = vi.spyOn(TestBed.inject(KidsService), 'deactivate').mockResolvedValue();
    const { element, fixture } = await open();
    breakDue = true;
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    expect(byTestId(element, 'feedback')).toBeTruthy();
    byTestId(element, 'next').click();
    await settle(fixture);

    expect(reminded).toHaveBeenCalledTimes(1);
    expect(byTestId(element, 'break-reminder').textContent).toContain(
      'Zeit für eine kleine Pause? Streck dich mal!',
    );
    expect(element.querySelector('[data-testid="exit"]')).toBeNull();
    expect(narrate).toHaveBeenCalledWith('Zeit für eine kleine Pause? Streck dich mal!');
    expect(document.activeElement?.id).toBe('break-title');
    byTestId(element, 'break-continue').click();
    await settle(fixture);
    expect(byTestId(element, 'exercise-letter-sound')).toBeTruthy();

    breakDue = true;
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    byTestId(element, 'exit').click();
    await settle(fixture);
    navigateByUrl.mockClear();
    const store = fixture.debugElement.injector.get(PlayerStore);
    await store.start('level', 'l1');
    await settle(fixture);
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    byTestId(element, 'next').click();
    await settle(fixture);
    byTestId(element, 'break-pause').click();
    await settle(fixture);
    expect(deactivate).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/');

    deactivate.mockRejectedValueOnce(new Error('offline'));
    navigateByUrl.mockClear();
    await store.start('level', 'l1');
    await settle(fixture);
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    byTestId(element, 'next').click();
    await settle(fixture);
    byTestId(element, 'break-pause').click();
    await settle(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/learn');
  });

  it('runs practice when there is no level id', async () => {
    params.next(convertToParamMap({}));
    const { element } = await open();
    expect(api.startPractice).toHaveBeenCalled();
    expect(element.querySelector('[data-testid="show-demo"]')).toBeNull();
  });

  it('runs a practice topic from the route and offers other topics at the end', async () => {
    params.next(convertToParamMap({ topicId: 'plus' }));
    api.startPractice.mockResolvedValue(
      run({
        demoSeen: true,
        items: [run().items[0]!],
        practice: { topic: 'plus', level: 2, maxLevel: 4 },
      }),
    );
    api.finish.mockResolvedValue({
      ...FINISHED,
      passed: false,
      unlocked: { levels: [], worlds: [] },
      practice: {
        topics: [{ id: 'plus', title: 'Plus rechnen', levelBefore: 2, level: 3, maxLevel: 4 }],
        reviewsSolved: 1,
        reviewsSaved: 2,
      },
    });
    const { element, fixture } = await open();
    expect(api.startPractice).toHaveBeenCalledWith('plus');
    expect(byTestId(element, 'show-demo')).toBeTruthy();
    byTestId(element, 'choice-c3').click();
    await settle(fixture);
    byTestId(element, 'next').click();
    await settle(fixture);

    const step = byTestId(element, 'practice-step-plus');
    expect(step.getAttribute('data-change')).toBe('up');
    expect(step.textContent).toContain('Plus rechnen');
    expect(step.textContent).toContain('Stufe 3 von 4');
    expect(step.textContent).toContain('Eine Stufe höher');
    expect(byTestId(element, 'practice-step-line').textContent).toContain(
      'Beim nächsten Mal wird es ein bisschen kniffliger.',
    );
    expect(byTestId(element, 'reviews-solved')).toBeTruthy();
    expect(byTestId(element, 'reviews-saved').textContent).toContain(
      'Murmeli merkt sich die kniffligen Aufgaben für später.',
    );
    expect(narrate).toHaveBeenCalledWith([
      'Schön, dass du geübt hast!',
      'Super! Beim nächsten Mal wird es ein bisschen kniffliger.',
      'Toll! Du hast knifflige Aufgaben von früher geschafft.',
      'Murmeli merkt sich die kniffligen Aufgaben für später.',
    ]);
    expect(element.querySelector('[data-testid="results-next"]')).toBeNull();
    byTestId(element, 'results-practice').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn/practice');
    byTestId(element, 'results-again').click();
    await settle(fixture);
    expect(api.startPractice).toHaveBeenLastCalledWith('plus');
    expect(api.startPractice).toHaveBeenCalledTimes(2);
  });

  it('marks items that come again', async () => {
    params.next(convertToParamMap({}));
    api.startPractice.mockResolvedValue(
      run({
        demo: undefined,
        demoSeen: true,
        items: [{ ...exercise('count-objects', 0), again: 'review' }],
      }),
    );
    const { element } = await open();
    expect(api.startPractice).toHaveBeenCalledWith(null);
    const again = byTestId(element, 'again');
    expect(again.getAttribute('data-again')).toBe('review');
    expect(again.textContent).toContain('Diese Aufgabe kennst du schon.');
    const prompt = byTestId(element, 'prompt-text');
    expect(prompt.getAttribute('aria-describedby')).toBe(again.id);
    expect(document.activeElement).toBe(prompt);
  });

  it('leaves a practice run to the practice ground', async () => {
    params.next(convertToParamMap({ topicId: 'plus' }));
    const dialog = TestBed.inject(Dialog);
    const openDialog = vi.spyOn(dialog, 'open');
    const { element, fixture } = await open();
    byTestId(element, 'exit').click();
    await settle(fixture);
    expect(openDialog.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ data: { confirmKey: 'learn.player.exitPractice' } }),
    );
    expect(navigateByUrl).toHaveBeenCalledWith('/learn/practice');
  });

  it('asks before leaving', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    const { element, fixture } = await open();
    dialogResult = false;
    byTestId(element, 'exit').click();
    await settle(fixture);
    expect(navigateByUrl).not.toHaveBeenCalled();
    dialogResult = true;
    byTestId(element, 'exit').click();
    await settle(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/learn');
  });

  it('puts Murmeli to sleep at the daily limit', async () => {
    api.startLevel.mockRejectedValue({ status: 403, code: 'DAILY_LIMIT_REACHED', message: 'x' });
    const deactivate = vi.spyOn(TestBed.inject(KidsService), 'deactivate').mockResolvedValue();
    const { element, fixture } = await open();
    expect(byTestId(element, 'daily-limit').textContent).toContain(
      'Murmeli macht jetzt eine Pause.',
    );
    byTestId(element, 'rest-back').click();
    await settle(fixture);
    expect(deactivate).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/');

    deactivate.mockRejectedValueOnce({ status: 500, code: null, message: 'x' });
    byTestId(element, 'rest-back').click();
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).not.toBe('');
  });

  it('offers a retry after an error', async () => {
    api.startLevel.mockRejectedValueOnce({ status: 500, code: null, message: 'x' });
    const { element, fixture } = await open();
    expect(byTestId(element, 'player-error')).toBeTruthy();
    byTestId(element, 'player-retry').click();
    await settle(fixture);
    expect(byTestId(element, 'demo')).toBeTruthy();
  });
});

describe('player pieces', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        {
          provide: AudioService,
          useValue: { narrate: vi.fn().mockResolvedValue(undefined), prepare: vi.fn() },
        },
        { provide: SoundEffects, useValue: { play: vi.fn() } },
      ],
    });
  });

  it('ProgressDots marks solved, missed and current items', async () => {
    const { element } = await renderComponent(ProgressDots, {
      outcomes: ['first', 'missed', null, null],
      current: 2,
    });
    const states = [...element.querySelectorAll('.dot')].map((dot) =>
      dot.getAttribute('data-state'),
    );
    expect(states).toEqual(['first', 'missed', 'current', 'open']);
  });

  it('Results names new worlds and picks the mascot pose by stars', async () => {
    const { element, fixture } = await renderComponent(Results, {
      results: { ...FINISHED, stars: 0, unlocked: { levels: [], worlds: ['w2'] } },
      unlocked: { nextLevelId: null, newLevels: 0, newWorlds: ['Formenwald'] },
    });
    expect(byTestId(element, 'unlocked-world').textContent).toContain('Neue Welt: Formenwald');
    expect(element.querySelector('mu-mascot')?.getAttribute('data-pose')).toBe('encouraging');
    expect(byTestId(element, 'page-title').textContent).toContain('Schön, dass du geübt hast!');
    fixture.componentRef.setInput('results', { ...FINISHED, stars: 1 });
    await fixture.whenStable();
    expect(element.querySelector('mu-mascot')?.getAttribute('data-pose')).toBe('happy');
    fixture.componentRef.setInput('mode', 'practice');
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="results-next"]')).toBeNull();
  });

  it('Results says one gentle line for the whole practice run', () => {
    const topic = { id: 'plus' as const, title: 'Plus', levelBefore: 2, level: 2, maxLevel: 4 };
    expect(stepChange(topic)).toBe('same');
    expect(stepChange({ ...topic, level: 1 })).toBe('down');
    expect(stepLineKey([])).toBeNull();
    expect(stepLineKey([topic])).toBe('kid.practice.levelSame');
    expect(stepLineKey([topic, { ...topic, level: 1 }])).toBe('kid.practice.levelDown');
    expect(
      stepLineKey([
        { ...topic, level: 1 },
        { ...topic, level: 3 },
      ]),
    ).toBe('kid.practice.levelUp');
  });

  it('Results shows a gentle step down and no practice part for levels', async () => {
    const practice = {
      topics: [{ id: 'minus' as const, title: 'Minus', levelBefore: 3, level: 2, maxLevel: 5 }],
      reviewsSolved: 0,
      reviewsSaved: 0,
    };
    const { element, fixture } = await renderComponent(Results, {
      results: { ...FINISHED, practice },
      mode: 'practice',
    });
    expect(byTestId(element, 'practice-step-minus').textContent).toContain('Etwas leichter');
    expect(byTestId(element, 'practice-step-line').textContent).toContain(
      'Wir üben das noch etwas leichter.',
    );
    expect(element.querySelector('[data-testid="reviews-saved"]')).toBeNull();
    fixture.componentRef.setInput('mode', 'level');
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="practice-steps"]')).toBeNull();
    expect(element.querySelector('[data-testid="results-practice"]')).toBeNull();
  });

  it('ExitDialog names where leaving goes', async () => {
    TestBed.overrideProvider(DialogRef, { useValue: { close: vi.fn() } });
    TestBed.overrideProvider(DIALOG_DATA, {
      useValue: { confirmKey: 'learn.player.exitPractice' },
    });
    TestBed.inject(AuthService).setActiveKid(KID);
    const { element } = await renderComponent(ExitDialog);
    expect(byTestId(element, 'exit-confirm').textContent?.trim()).toBe('Ja, zum Übungsplatz');
  });

  it('ExitDialog closes with the kid’s choice', async () => {
    const close = vi.fn();
    TestBed.overrideProvider(DialogRef, { useValue: { close } });
    TestBed.inject(AuthService).setActiveKid(KID);
    const { element } = await renderComponent(ExitDialog);
    byTestId(element, 'exit-cancel').click();
    byTestId(element, 'exit-confirm').click();
    expect(close.mock.calls).toEqual([[false], [true]]);
  });
});
