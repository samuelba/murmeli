import { TestBed } from '@angular/core/testing';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { fakeSpeaker, keydown, renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { SPEAK_PROVIDER } from '../../../shared/speak/speak-provider';
import { SentencePicture } from './sentence-picture';

describe('SentencePicture', () => {
  let speaker: ReturnType<typeof fakeSpeaker>;

  beforeEach(() => {
    speaker = fakeSpeaker(['Maus', 'Bett']);
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: SPEAK_PROVIDER, useValue: speaker.provider }],
    });
  });

  it('shows the sentence word by word; words with a clip can be heard', async () => {
    const { element, click, fixture } = await renderExercise(SentencePicture, {
      payload: PAYLOADS['sentence-picture'],
    });
    const words = [...byTestId(element, 'sentence').querySelectorAll('.word')];
    expect(words.map((word) => word.textContent?.trim())).toEqual([
      'Die',
      'Maus',
      'ist',
      'auf',
      'dem',
      'Bett.',
    ]);
    expect(element.querySelectorAll('button.word').length).toBe(2);
    expect(byTestId(element, 'word-5').getAttribute('aria-label')).toContain('Bett');
    expect(byTestId(element, 'word-1').getAttribute('tabindex')).toBe('0');
    expect(byTestId(element, 'word-5').getAttribute('tabindex')).toBe('-1');
    await click('word-1');
    await click('word-5');
    expect(speaker.spoken).toEqual(['Maus', 'Bett']);
    expect(byTestId(element, 'word-5').getAttribute('tabindex')).toBe('0');
    keydown(byTestId(element, 'word-5'), 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(byTestId(element, 'word-1'));
    expect(byTestId(element, 'word-1').getAttribute('tabindex')).toBe('0');
    keydown(byTestId(element, 'word-1'), 'End');
    keydown(byTestId(element, 'word-1'), 'x');
    await fixture.whenStable();
    expect(byTestId(element, 'word-5').getAttribute('tabindex')).toBe('0');
  });

  it('draws the scenes, names them and answers on tap', async () => {
    const { element, click, answers } = await renderExercise(SentencePicture, {
      payload: PAYLOADS['sentence-picture'],
    });
    const on = byTestId(element, 'choice-s1');
    expect(on.getAttribute('aria-label')).toBe('Maus auf Bett');
    expect(byTestId(element, 'choice-s2').getAttribute('aria-label')).toBe('Maus unter Bett');
    expect(byTestId(element, 'choice-s3').getAttribute('aria-label')).toBe('3 × Apfel');
    expect(on.querySelector('.subject')?.getAttribute('data-relation')).toBe('on');
    expect(byTestId(element, 'choice-s3').querySelectorAll('.one').length).toBe(3);
    await click('choice-s1');
    expect(answers).toEqual([{ choiceId: 's1' }]);
  });

  it('highlights the sentence in the demo and reveals the picture', async () => {
    const { element, update } = await renderExercise(SentencePicture, {
      payload: PAYLOADS['sentence-picture'],
      locked: true,
      cue: { highlight: 'sentence' },
    });
    expect(element.querySelector('.stage')?.classList).toContain('mu-cue');
    await update({ cue: { tapAnswer: true }, reveal: { choiceId: 's1' } });
    expect(byTestId(element, 'choice-s1').classList).toContain('mu-choice--revealed');
  });
});
