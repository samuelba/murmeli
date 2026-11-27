import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { provideAppTesting } from '../../../testing/app-testing';
import { exercise, run } from '../../../testing/learn-testing';
import { LearnApi } from '../learn-api.service';
import type { MapResponse } from '../learn.models';
import { PlayerStore, nextPlayable } from './player-store';

const MAP: MapResponse = {
  tracks: [
    {
      id: 'math',
      title: 'Mathematik',
      icon: 'math',
      worlds: [
        {
          id: 'w1',
          title: 'Zahlenwiese',
          scene: 'meadow',
          grade: 'KG1',
          state: 'unlocked',
          stars: 3,
          maxStars: 6,
          levels: [
            { id: 'l1', title: 'Eins', state: 'passed', stars: 3 },
            { id: 'l2', title: 'Zwei', state: 'unlocked', stars: 0 },
          ],
        },
        {
          id: 'w2',
          title: 'Formenwald',
          scene: 'forest',
          grade: 'KG1',
          state: 'unlocked',
          stars: 0,
          maxStars: 3,
          levels: [{ id: 'l3', title: 'Drei', state: 'unlocked', stars: 0 }],
        },
      ],
    },
  ],
};

function apiError(errorCode: string, status = 403) {
  return { status, code: errorCode, message: errorCode };
}

describe('nextPlayable', () => {
  it('picks the next open level of the world, or of the next world once it is done', () => {
    expect(nextPlayable(MAP, 'l1')).toBe('l2');
    expect(nextPlayable(MAP, 'l2')).toBeNull();
    expect(nextPlayable(MAP, 'nope')).toBeNull();
    const done: MapResponse = {
      tracks: [
        {
          ...MAP.tracks[0]!,
          worlds: [
            {
              ...MAP.tracks[0]!.worlds[0]!,
              levels: [{ id: 'l1', title: '', state: 'passed', stars: 2 }],
            },
            MAP.tracks[0]!.worlds[1]!,
          ],
        },
      ],
    };
    expect(nextPlayable(done, 'l1')).toBe('l3');
  });
});

describe('PlayerStore', () => {
  let api: Record<keyof LearnApi, ReturnType<typeof vi.fn>>;
  let audio: {
    stop: ReturnType<typeof vi.fn>;
    speak: ReturnType<typeof vi.fn>;
    narrate: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    prefetch: ReturnType<typeof vi.fn>;
  };
  let effects: { play: ReturnType<typeof vi.fn> };
  let store: PlayerStore;

  beforeEach(() => {
    api = {
      map: vi.fn().mockResolvedValue(MAP),
      startLevel: vi.fn().mockResolvedValue(run()),
      startPractice: vi.fn().mockResolvedValue(run({ demo: undefined, demoSeen: true })),
      answer: vi.fn(),
      finish: vi.fn().mockResolvedValue({
        score: 1,
        stars: 3,
        passed: true,
        unlocked: { levels: ['l2'], worlds: ['w2'] },
        newBadges: [],
      }),
    };
    audio = {
      stop: vi.fn(),
      speak: vi.fn(),
      narrate: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      prefetch: vi.fn().mockResolvedValue(0),
    };
    effects = { play: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        PlayerStore,
        { provide: LearnApi, useValue: api },
        { provide: AudioService, useValue: { ...audio, autoRead: signal(true) } },
        { provide: SoundEffects, useValue: effects },
      ],
    });
    store = TestBed.inject(PlayerStore);
  });

  afterEach(() => vi.useRealTimers());

  it('asks for a reload instead of playing a partial run with unknown exercise types', async () => {
    const future = { ...exercise('count-objects', 1), type: 'future-type' };
    api.startLevel.mockResolvedValue(
      run({ items: [exercise('count-objects', 0), future as never], demo: undefined }),
    );
    await store.start('level', 'l1');
    expect(store.phase()).toBe('error');
    expect(store.error()).toEqual({ key: 'learn.player.outdated' });
    expect(store.run()).toBeNull();
    const reload = vi
      .spyOn(store as unknown as { reloadApp(): void }, 'reloadApp')
      .mockImplementation(() => undefined);
    await store.retry();
    expect(reload).toHaveBeenCalled();
  });

  it('plays the demo before the first run, step by step', async () => {
    vi.useFakeTimers();
    await store.start('level', 'l1');
    expect(api.startLevel).toHaveBeenCalledWith('l1');
    expect(store.phase()).toBe('demo');
    expect(store.demoStep()).toBe(0);
    expect(store.demoCue()).toEqual({ highlight: 'objects' });
    expect(store.demoReveal()).toBeNull();
    expect(audio.narrate).toHaveBeenCalledWith('Schau, hier sind Äpfel.');

    await vi.advanceTimersByTimeAsync(1800);
    expect(store.demoStep()).toBe(1);
    await vi.advanceTimersByTimeAsync(1800 + 3 * 700);
    expect(store.demoSay()).toBe('Tippe auf die Drei!');
    expect(store.demoReveal()).toEqual({ value: 3 });
    await vi.advanceTimersByTimeAsync(1800);
    expect(store.demoDone()).toBe(true);

    store.replayDemo();
    expect(store.demoDone()).toBe(false);
    expect(store.demoStep()).toBe(0);
    store.closeDemo();
    expect(store.phase()).toBe('playing');
    expect(audio.narrate).toHaveBeenLastCalledWith(['Aufgabe 1']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(store.phase()).toBe('playing');

    store.closeDemo();
    store.openDemo();
    expect(store.phase()).toBe('demo');
  });

  it('runs items: correct, a hint and a second try, then the results', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    await store.start('level', 'l1');
    expect(store.phase()).toBe('playing');
    expect(store.total()).toBe(2);

    api.answer.mockResolvedValueOnce({ correct: true, attempt: 1 });
    await store.submit({ value: 3 });
    expect(api.answer).toHaveBeenCalledWith('r1', 0, { value: 3 });
    expect(store.phase()).toBe('feedback');
    expect(store.feedback()?.kind).toBe('correct');
    expect(effects.play).toHaveBeenCalledWith('correct');
    expect(store.outcomes()).toEqual(['first', null]);

    store.next();
    expect(store.index()).toBe(1);
    expect(store.itemKey()).toBe('1:1');

    api.answer.mockResolvedValueOnce({ correct: false, attempt: 1, hint: 'listen-to-the-sound' });
    await store.submit({ choiceId: 'x' });
    expect(store.phase()).toBe('playing');
    expect(store.attempt()).toBe(2);
    expect(store.hintText()).toBe('Hör den Laut nochmal und schau die Buchstaben genau an.');
    expect(effects.play).toHaveBeenCalledWith('wrong');
    expect(audio.narrate).toHaveBeenLastCalledWith([store.hintPhrase(), store.hintText()]);

    api.answer.mockResolvedValueOnce({ correct: true, attempt: 2 });
    await store.submit({ choiceId: 'm' });
    expect(store.outcomes()).toEqual(['first', 'second']);

    store.next();
    await vi.waitFor(() => expect(store.phase()).toBe('results'));
    expect(store.results()?.stars).toBe(3);
    expect(store.unlocked()).toEqual({
      nextLevelId: 'l2',
      newLevels: 1,
      newWorlds: ['Formenwald'],
    });
    expect(effects.play).toHaveBeenCalledWith('complete');
  });

  it('resumes a reloaded run at the first unfinished item, on its second try', async () => {
    api.startLevel.mockResolvedValue(
      run({
        demoSeen: true,
        progress: [
          { attempts: 1, correct: true },
          { attempts: 1, correct: false },
        ],
      }),
    );
    await store.start('level', 'l1');
    expect(store.phase()).toBe('playing');
    expect(store.index()).toBe(1);
    expect(store.attempt()).toBe(2);
    expect(store.itemKey()).toBe('1:2');
    expect(store.outcomes()).toEqual(['first', null]);
    expect(audio.narrate).toHaveBeenLastCalledWith(['Aufgabe 2']);
  });

  it('shows the results of a resumed run whose items are all done', async () => {
    api.startLevel.mockResolvedValue(
      run({
        demoSeen: true,
        progress: [
          { attempts: 2, correct: false },
          { attempts: 2, correct: true },
        ],
      }),
    );
    await store.start('level', 'l1');
    expect(api.finish).toHaveBeenCalledWith('r1');
    expect(store.phase()).toBe('results');
    expect(store.outcomes()).toEqual(['missed', 'second']);
  });

  it('shows the solution after the second wrong answer', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    await store.start('level', 'l1');
    api.answer
      .mockResolvedValueOnce({ correct: false, attempt: 1 })
      .mockResolvedValueOnce({ correct: false, attempt: 2, solution: { value: 3 } });
    await store.submit({ value: 1 });
    expect(store.hint()).toBeNull();
    expect(store.hintText()).toBeNull();
    await store.submit({ value: 2 });
    expect(store.feedback()).toEqual(
      expect.objectContaining({ kind: 'solution', solution: { value: 3 } }),
    );
    expect(store.outcomes()[0]).toBe('missed');
    await store.submit({ value: 3 });
    expect(api.answer).toHaveBeenCalledTimes(2);
  });

  it('rests when the daily limit is reached', async () => {
    api.startLevel.mockRejectedValue(apiError('DAILY_LIMIT_REACHED'));
    await store.start('level', 'l1');
    expect(store.phase()).toBe('resting');
  });

  it('offers a retry when a request fails', async () => {
    api.startLevel.mockRejectedValueOnce(apiError('SERVER', 500));
    await store.start('level', 'l1');
    expect(store.phase()).toBe('error');
    expect(store.error()).not.toBeNull();
    await store.retry();
    expect(store.phase()).toBe('demo');

    store.closeDemo();
    api.answer.mockRejectedValueOnce(apiError('SERVER', 500));
    await store.submit({ value: 3 });
    expect(store.phase()).toBe('playing');
    expect(store.error()).not.toBeNull();
    await store.retry();

    api.answer.mockResolvedValue({ correct: true, attempt: 1 });
    await store.submit({ value: 3 });
    store.next();
    await store.submit({ choiceId: 'm' });
    api.finish.mockRejectedValueOnce(apiError('SERVER', 500));
    store.next();
    await vi.waitFor(() => expect(store.phase()).toBe('error'));
    api.map.mockRejectedValueOnce(new Error('offline'));
    await store.retry();
    expect(store.phase()).toBe('results');
    expect(store.unlocked()?.newWorlds).toEqual(['w2']);
  });

  it('starts the run again when the server forgot it', async () => {
    api.startLevel.mockResolvedValue(run({ demoSeen: true }));
    await store.start('level', 'l1');
    api.answer.mockRejectedValueOnce(apiError('RUN_NOT_FOUND', 404));
    await store.submit({ value: 3 });
    expect(store.phase()).toBe('error');
    expect(store.error()).toEqual({ key: 'errors.RUN_NOT_FOUND' });
    await store.retry();
    expect(api.startLevel).toHaveBeenCalledTimes(2);
    expect(store.phase()).toBe('playing');
  });

  it('starts practice runs without a next level', async () => {
    await store.start('practice');
    expect(api.startPractice).toHaveBeenCalled();
    expect(store.phase()).toBe('playing');
    store.openDemo();
    expect(store.phase()).toBe('playing');
    store.speakPrompt();
    expect(audio.speak).toHaveBeenCalledWith(['Aufgabe 1']);
    await store.finish();
    expect(store.unlocked()?.nextLevelId).toBeNull();
  });
});
