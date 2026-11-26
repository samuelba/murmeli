import { Dialog, DialogRef } from '@angular/cdk/dialog';
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
import { run } from '../../../testing/learn-testing';
import { LearnApi } from '../learn-api.service';
import type { FinishRunResponse } from '../learn.models';
import { ExitDialog } from './exit-dialog';
import { Player } from './player';
import { ProgressDots } from './progress-dots';
import { Results } from './results';

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

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ levelId: 'l1' }));
    dialogResult = true;
    narrate = vi.fn().mockResolvedValue(undefined);
    api = {
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
            prepare: vi.fn(),
            autoRead: signal(true),
            available: signal(false),
          },
        },
        { provide: SoundEffects, useValue: { play: vi.fn() } },
        { provide: Dialog, useValue: { open: () => ({ closed: of(dialogResult) }) } },
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
    expect(narrate).toHaveBeenCalledWith(['Wow, alle Sterne!', 'Eine neue Stufe ist offen!']);
    byTestId(element, 'results-next').click();
    expect(navigate).toHaveBeenCalledWith(['/learn/level', 'l2']);
    byTestId(element, 'results-map').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn');
    byTestId(element, 'results-again').click();
    await settle(fixture);
    expect(api.startLevel).toHaveBeenCalledTimes(2);
  });

  it('runs practice when there is no level id', async () => {
    params.next(convertToParamMap({}));
    const { element } = await open();
    expect(api.startPractice).toHaveBeenCalled();
    expect(element.querySelector('[data-testid="show-demo"]')).toBeNull();
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
