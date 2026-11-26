import { TestBed } from '@angular/core/testing';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { fakeSpeaker, renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { SPEAK_PROVIDER } from '../../../shared/speak/speak-provider';
import { ListenWrite } from './listen-write';

describe('ListenWrite', () => {
  let speaker: ReturnType<typeof fakeSpeaker>;

  beforeEach(() => {
    speaker = fakeSpeaker(['Katze']);
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: SPEAK_PROVIDER, useValue: speaker.provider }],
    });
  });

  it('plays the word again and writes it with tiles', async () => {
    const { element, click, answers } = await renderExercise(ListenWrite, {
      payload: PAYLOADS['listen-write'],
      speech: ['Schreibe', 'Katze'],
    });
    expect(element.querySelector('mu-picture')).toBeNull();
    await click('replay');
    expect(speaker.spoken).toEqual([['Schreibe', 'Katze']]);
    expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBe('true');
    await click('tile-t3');
    await click('tile-t2');
    await click('tile-t1');
    expect(byTestId(element, 'build-status').textContent).toContain('c a t');
    await click('check');
    expect(answers).toEqual([{ letters: ['c', 'a', 't'] }]);
  });

  it('stays quiet without speech and shows the letters in the demo', async () => {
    const { element, click, update } = await renderExercise(ListenWrite, {
      payload: PAYLOADS['listen-write'],
      locked: true,
      cue: { highlight: 'prompt' },
    });
    expect(byTestId(element, 'replay').classList).toContain('mu-cue');
    await click('replay');
    expect(speaker.spoken).toEqual([]);
    await update({ cue: { placeTiles: true }, reveal: { letters: ['c', 'a', 't'] } });
    expect(byTestId(element, 'slot-2').textContent?.trim()).toBe('t');
    expect(byTestId(element, 'slot-2').classList).toContain('mu-blank--revealed');
    await update({ cue: { highlight: 'tiles' } });
    expect(element.querySelector('.tiles')?.classList).toContain('mu-cue');
  });

  it('shows the picture of the word when there is no clip for it', async () => {
    const { element } = await renderExercise(ListenWrite, {
      payload: PAYLOADS['listen-write'],
      speech: ['Hör gut zu', 'Maus', 'Schreib das Wort.'],
    });
    expect(element.querySelector('[data-testid="replay"]')).toBeNull();
    expect(byTestId(element, 'exercise-picture').querySelector('img')?.alt).toBe('Maus');
    expect(byTestId(element, 'listen-silent').textContent).toContain('Ohne Ton');
  });
});
