import { Type, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { byTestId, provideAppTesting, renderComponent } from '../../../testing/app-testing';
import { PAYLOADS, exercise } from '../../../testing/learn-testing';
import type { SupportedExerciseType } from '../learn.models';
import { AddSub } from './add-sub/add-sub';
import { BuildWord } from './build-word/build-word';
import { Compare } from './compare/compare';
import { CountObjects } from './count-objects/count-objects';
import { ExerciseHost } from './exercise-host';
import { InitialSound } from './initial-sound/initial-sound';
import { LetterSound } from './letter-sound/letter-sound';
import { NumberBond } from './number-bond/number-bond';
import { NumberLine } from './number-line/number-line';
import { NumberRecognition } from './number-recognition/number-recognition';
import { NumberWall } from './number-wall/number-wall';
import { Sequence } from './sequence/sequence';
import { BlankEntry } from './shared/blank-entry';
import { Keypad } from './shared/keypad';
import { applyKey, entryValue, keyFromEvent } from './shared/number-entry';
import { ShapePick } from './shape-pick/shape-pick';
import { Syllables } from './syllables/syllables';
import { TenFrame } from './ten-frame/ten-frame';
import { WordPicture } from './word-picture/word-picture';

interface Answering {
  answered: { subscribe(listener: (value: unknown) => void): unknown };
}

async function render<T>(component: Type<T>, inputs: Record<string, unknown>) {
  const result = await renderComponent(component, inputs);
  const answers: unknown[] = [];
  (result.fixture.componentInstance as unknown as Answering).answered.subscribe((answer) =>
    answers.push(answer),
  );
  const update = async (next: Record<string, unknown>) => {
    Object.entries(next).forEach(([key, value]) =>
      result.fixture.componentRef.setInput(key, value),
    );
    await result.fixture.whenStable();
  };
  const click = async (id: string) => {
    byTestId(result.element, id).click();
    await result.fixture.whenStable();
  };
  const type = async (text: string) => {
    for (const key of text) {
      await click(`key-${key}`);
    }
  };
  return { ...result, answers, update, click, type };
}

function press(key: string, target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('exercise helpers', () => {
  it('builds numbers from keypad keys', () => {
    expect(applyKey('', '4', 2)).toBe('4');
    expect(applyKey('0', '4', 2)).toBe('4');
    expect(applyKey('12', '3', 2)).toBe('12');
    expect(applyKey('12', 'back', 2)).toBe('1');
    expect(applyKey('12', 'ok', 2)).toBe('12');
    expect(entryValue('')).toBeNull();
    expect(entryValue('07')).toBe(7);
  });

  it('maps hardware keys', () => {
    expect(keyFromEvent(new KeyboardEvent('keydown', { key: '3' }))).toBe('3');
    expect(keyFromEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe('back');
    expect(keyFromEvent(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe('back');
    expect(keyFromEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe('ok');
    expect(keyFromEvent(new KeyboardEvent('keydown', { key: 'a' }))).toBeNull();
  });

  it('fills several blanks with one keypad', () => {
    const entry = new BlankEntry(signal(['a', 'b']), 2);
    expect(entry.active()).toBe('a');
    expect(entry.canConfirm()).toBe(false);
    expect(entry.press('ok')).toBe(false);
    entry.press('4');
    expect(entry.press('ok')).toBe(false);
    expect(entry.active()).toBe('b');
    entry.press('1');
    entry.press('2');
    entry.press('3');
    expect(entry.text('b')).toBe('12');
    expect(entry.complete()).toBe(true);
    expect(entry.press('ok')).toBe(true);
    expect(entry.values()).toEqual({ a: 4, b: 12 });
    entry.select('a');
    entry.press('back');
    expect(entry.text('a')).toBe('');
    entry.select('zzz');
    expect(entry.active()).toBe('a');
    expect(new BlankEntry(signal([])).press('1')).toBe(false);
  });
});

describe('exercise components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });

  describe('Keypad', () => {
    it('emits taps and hardware keys, but not while locked or typing in a field', async () => {
      const { fixture, element } = await renderComponent(Keypad);
      const pressed: string[] = [];
      fixture.componentInstance.pressed.subscribe((key) => pressed.push(key));
      expect(element.querySelector('[data-testid="key-ok"]')).toBeNull();
      expect(element.querySelectorAll('button').length).toBe(11);
      byTestId(element, 'key-7').click();
      byTestId(element, 'key-back').click();
      press('5', element);
      press('Enter', element);
      press('x', element);
      press('6');
      const input = document.createElement('input');
      document.body.append(input);
      press('1', input);
      input.remove();
      expect(pressed).toEqual(['7', 'back', '5', 'ok']);

      fixture.componentRef.setInput('canSubmit', false);
      await fixture.whenStable();
      press('Enter', element);
      expect(pressed).toHaveLength(4);
      fixture.componentRef.setInput('locked', true);
      await fixture.whenStable();
      byTestId(element, 'key-1').click();
      expect(pressed).toHaveLength(4);
    });
  });

  describe('CountObjects', () => {
    it('centers the pictures, marks taps as counted and answers by choice', async () => {
      const { element, answers, click, update } = await render(CountObjects, {
        payload: PAYLOADS['count-objects'],
      });
      const first = byTestId(element, 'count-object-0');
      expect(first.style.left).toBe('30%');
      expect(byTestId(element, 'count-board').getAttribute('aria-label')).toContain('3 Bilder');

      await click('count-object-2');
      await click('count-object-0');
      expect(first.getAttribute('aria-pressed')).toBe('true');
      expect(first.getAttribute('aria-label')).toBe('Apfel');
      expect(byTestId(element, 'count-total').textContent).toContain('2 gezählt');
      await click('count-object-2');
      expect(first.querySelector('.badge')?.textContent?.trim()).toBe('1');

      await click('choice-c3');
      expect(answers).toEqual([{ value: 3 }]);

      await update({ locked: true, reveal: { value: 3 }, cue: { tapAnswer: true } });
      await click('choice-c2');
      expect(answers).toHaveLength(1);
      expect(byTestId(element, 'choice-c3').classList).toContain('mu-choice--revealed');
      expect(element.querySelector('[data-testid="demo-pointer"]')).not.toBeNull();

      await update({ cue: { countAlong: true } });
      expect(byTestId(element, 'count-board').classList).toContain('counting');
      await update({ cue: { highlight: 'objects' } });
      expect(byTestId(element, 'count-board').classList).toContain('mu-cue');
    });

    it('answers with the keypad and keeps dice and scattered layouts', async () => {
      const { element, answers, click, type } = await render(CountObjects, {
        payload: {
          arrangement: 'dice',
          objects: [{ pictureId: 'star', x: 0.5, y: 0.5 }],
          answerMode: 'keypad',
        },
      });
      expect(byTestId(element, 'count-object-0').style.left).toBe('50%');
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('?');
      expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBe('true');
      await click('check');
      expect(answers).toEqual([]);
      await type('1');
      expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBeNull();
      await click('check');
      expect(answers).toEqual([{ value: 1 }]);
    });
  });

  describe('NumberRecognition', () => {
    it('shows each choice as an amount with a spoken name', async () => {
      const { element, answers, click } = await render(NumberRecognition, {
        payload: PAYLOADS['number-recognition'],
        reveal: { value: 5 },
      });
      expect(byTestId(element, 'choice-n2').getAttribute('aria-label')).toBe('2 Punkte');
      expect(byTestId(element, 'choice-n5').classList).toContain('mu-choice--revealed');
      await click('choice-n2');
      expect(answers).toEqual([{ value: 2 }]);
    });

    it('names pictures and fingers, and shows numerals when listening', async () => {
      const objects = await render(NumberRecognition, {
        payload: {
          ...PAYLOADS['number-recognition'],
          representation: 'objects',
          pictureId: 'duck',
        },
      });
      expect(byTestId(objects.element, 'choice-n2').getAttribute('aria-label')).toBe('2 × Ente');
      await objects.update({
        payload: { ...PAYLOADS['number-recognition'], representation: 'fingers' },
      });
      expect(byTestId(objects.element, 'choice-n5').getAttribute('aria-label')).toBe('5 Finger');
      expect(objects.element.querySelectorAll('mu-fingers svg').length).toBeGreaterThan(0);

      await objects.update({
        payload: { ...PAYLOADS['number-recognition'], mode: 'hear', representation: 'numeral' },
      });
      expect(objects.element.querySelector('mu-hear-badge')).not.toBeNull();
      expect(byTestId(objects.element, 'choice-n5').textContent?.trim()).toBe('5');
    });
  });

  describe('TenFrame', () => {
    it('describes the frame and answers with keypad keys or the keyboard', async () => {
      const { element, answers, fixture } = await render(TenFrame, {
        payload: PAYLOADS['ten-frame'],
      });
      expect(byTestId(element, 'ten-frame').getAttribute('aria-label')).toBe(
        'Zehnerfeld mit 7 von 10 Feldern gefüllt',
      );
      expect(element.querySelectorAll('.counter').length).toBe(7);
      const inside = element.querySelector('.mu-ex')!;
      press('7');
      press('1', inside);
      press('2', inside);
      press('3', inside);
      await fixture.whenStable();
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('12');
      press('Backspace', inside);
      await fixture.whenStable();
      press('Enter', inside);
      expect(answers).toEqual([{ value: 1 }]);
    });

    it('shows the revealed number', async () => {
      const { element } = await render(TenFrame, {
        payload: PAYLOADS['ten-frame'],
        reveal: { value: 7 },
        locked: true,
      });
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('7');
      expect(byTestId(element, 'answer-blank').classList).toContain('mu-blank--revealed');
    });
  });

  describe('Compare', () => {
    it('describes both sides and answers with a relation', async () => {
      const { element, answers, click, update } = await render(Compare, {
        payload: PAYLOADS.compare,
      });
      expect(byTestId(element, 'compare-left').getAttribute('aria-label')).toBe('Links: 3 × Ente');
      expect(byTestId(element, 'compare-right').getAttribute('aria-label')).toBe(
        'Rechts: 5 Punkte',
      );
      expect(byTestId(element, 'relation-lt').getAttribute('aria-label')).toBe('kleiner als');
      await click('relation-lt');
      expect(answers).toEqual([{ relation: 'lt' }]);
      expect(byTestId(element, 'compare-slot').textContent?.trim()).toBe('<');

      await update({
        payload: { mode: 'numbers', left: { value: 12 }, right: { value: 9 } },
        reveal: { relation: 'gt' },
        locked: true,
        cue: { tapAnswer: true },
      });
      expect(byTestId(element, 'compare-left').textContent?.trim()).toBe('12');
      expect(byTestId(element, 'compare-slot').textContent?.trim()).toBe('>');
      expect(byTestId(element, 'relation-gt').querySelector('mu-pointer')).not.toBeNull();
      await click('relation-eq');
      expect(answers).toHaveLength(1);
    });
  });

  describe('NumberLine', () => {
    it('asks for the marked number with choices', async () => {
      const { element, answers, click, update } = await render(NumberLine, {
        payload: PAYLOADS['number-line'],
      });
      expect(element.querySelectorAll('.tick').length).toBe(11);
      expect(byTestId(element, 'line-marked').textContent?.trim()).toBe('?');
      await click('choice-l3');
      expect(answers).toEqual([{ value: 3 }]);
      await update({ reveal: { value: 3 } });
      expect(byTestId(element, 'line-marked').textContent?.trim()).toBe('3');
    });

    it('places the flag with taps, buttons and arrow keys', async () => {
      const payload = { mode: 'place', start: 0, end: 20, step: 2, labels: [0, 20] };
      const { element, answers, click, fixture, update } = await render(NumberLine, { payload });
      const line = byTestId(element, 'number-line');
      expect(line.getAttribute('role')).toBe('slider');
      expect(element.querySelectorAll('.label--low').length).toBe(0);

      expect(line.getAttribute('aria-valuenow')).toBe('1');
      expect(line.getAttribute('aria-valuetext')).toBe('Strich 1 von 11, noch nicht gesetzt');
      await click('line-left');
      expect(line.getAttribute('aria-valuetext')).toBe('Strich 1 von 11');
      expect(line.getAttribute('aria-valuenow')).toBe('1');
      await click('line-right');
      expect(line.getAttribute('aria-valuetext')).toBe('Strich 2 von 11');
      expect(byTestId(element, 'line-right').getAttribute('aria-label')).toBe('Fahne nach rechts');
      press('Home', line);
      press('ArrowRight', line);
      press('ArrowUp', line);
      press('ArrowDown', line);
      await fixture.whenStable();
      expect(line.getAttribute('aria-valuenow')).toBe('2');
      press('End', line);
      press('ArrowLeft', line);
      press('Enter', line);
      expect(answers).toEqual([{ value: 18 }]);
      line.dispatchEvent(new MouseEvent('click', { clientX: 0 }));
      await click('check');
      expect(answers).toEqual([{ value: 18 }, { value: 0 }]);

      await update({ reveal: { value: 6 }, cue: { hop: true }, locked: true });
      expect(element.querySelectorAll('.hop').length).toBe(3);
      expect(byTestId(element, 'line-flag').querySelector('.flag__cloth--revealed')).not.toBeNull();
    });
  });

  describe('AddSub', () => {
    it('shows the equation, a ten-frame and the typed number in the blank', async () => {
      const { element, answers, click, fixture, type } = await render(AddSub, {
        payload: PAYLOADS['add-sub'],
      });
      expect(byTestId(element, 'equation').textContent?.replace(/\s+/g, '')).toBe('7−2=?');
      expect(element.querySelectorAll('[data-state="removed"]').length).toBe(2);
      await type('5');
      await fixture.whenStable();
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('5');
      await click('check');
      expect(answers).toEqual([{ value: 5 }]);
    });

    it('draws pictures for adding and a blank for a missing operand', async () => {
      const { element, update } = await render(AddSub, {
        payload: {
          op: 'add',
          a: 2,
          b: null,
          result: 5,
          manipulatives: 'objects',
          pictureId: 'apple',
          answerMode: 'choices',
          choices: [{ id: 'x', value: 3 }],
        },
      });
      expect(byTestId(element, 'equation').textContent?.replace(/\s+/g, '')).toBe('2+?=5');
      expect(element.querySelectorAll('.object').length).toBe(2);
      await update({
        payload: { ...PAYLOADS['add-sub'], op: 'add', manipulatives: 'twenty-frame' },
        reveal: { value: 9 },
      });
      expect(element.querySelectorAll('.cell').length).toBe(20);
      expect(element.querySelectorAll('[data-state="added"]').length).toBe(2);
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('9');
      await update({
        payload: { ...PAYLOADS['add-sub'], op: 'sub', manipulatives: 'objects', pictureId: 'egg' },
      });
      expect(element.querySelectorAll('.object--gone').length).toBe(2);
    });
  });

  describe('NumberBond', () => {
    it('fills the roof with the keypad and checks', async () => {
      const { element, answers, click, type } = await render(NumberBond, {
        payload: PAYLOADS['number-bond'],
      });
      expect(byTestId(element, 'number-house').getAttribute('aria-label')).toBe('Zahlenhaus');
      expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBe('true');
      await click('blank-0');
      await type('7');
      await click('check');
      expect(answers).toEqual([{ values: [7] }]);
    });

    it('collects the blanks row by row with the whole last and shows dots', async () => {
      const { element, answers, click, update, type } = await render(NumberBond, {
        payload: {
          whole: null,
          rows: [
            { left: 2, right: null },
            { left: null, right: 1 },
          ],
          representation: 'dots',
        },
      });
      await type('3');
      await click('check');
      await type('4');
      await click('check');
      expect(answers).toEqual([]);
      await type('5');
      await click('check');
      expect(answers).toEqual([{ values: [3, 4, 5] }]);
      expect(element.querySelectorAll('mu-quantity').length).toBe(2);
      await update({ reveal: { values: [3, 4, 5] }, locked: true, cue: { fillBlank: true } });
      expect(byTestId(element, 'blank-2').textContent?.trim()).toBe('5');
    });
  });

  describe('NumberWall', () => {
    it('fills bricks in any order and answers with cell ids', async () => {
      const { element, answers, click, update, type } = await render(NumberWall, {
        payload: PAYLOADS['number-wall'],
      });
      expect(element.querySelectorAll('.row')[0]?.querySelectorAll('.brick').length).toBe(1);
      await click('brick-r0c1');
      await type('4');
      await click('check');
      await type('7');
      await click('check');
      expect(answers).toEqual([{ values: { r0c1: 4, r1c0: 7 } }]);
      await update({
        reveal: { values: { r0c1: 4, r1c0: 7 } },
        locked: true,
        cue: { tapAnswer: true },
      });
      expect(byTestId(element, 'brick-r1c0').textContent?.trim()).toContain('7');
      expect(byTestId(element, 'brick-r1c0').querySelector('mu-pointer')).not.toBeNull();
    });
  });

  describe('Sequence', () => {
    it('answers number rows by choice or keypad', async () => {
      const { element, answers, click, update, fixture, type } = await render(Sequence, {
        payload: PAYLOADS.sequence,
      });
      expect(element.querySelectorAll('.card').length).toBe(4);
      await click('choice-s5');
      expect(answers).toEqual([{ value: 5 }]);
      await update({ payload: { ...PAYLOADS.sequence, answerMode: 'keypad', choices: undefined } });
      await type('6');
      await fixture.whenStable();
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('6');
      await update({ reveal: { value: 5 } });
      expect(byTestId(element, 'answer-blank').textContent?.trim()).toBe('5');
    });

    it('answers picture patterns with a choice id and reveals the picture', async () => {
      const payload = {
        kind: 'pattern',
        items: [{ pictureId: 'apple' }, { pictureId: 'banana' }, { pictureId: 'apple' }],
        choices: [
          { id: 'p1', pictureId: 'banana' },
          { id: 'p2', pictureId: 'apple' },
        ],
      };
      const { element, answers, click, update } = await render(Sequence, { payload });
      expect(byTestId(element, 'pattern').querySelectorAll('img').length).toBe(3);
      await click('choice-p1');
      expect(answers).toEqual([{ choiceId: 'p1' }]);
      await update({ reveal: { choiceId: 'p1' } });
      expect(byTestId(element, 'pattern').querySelectorAll('img').length).toBe(4);
    });
  });

  describe('choice exercises', () => {
    it.each([
      [ShapePick, 'shape-pick', 'circle'],
      [LetterSound, 'letter-sound', 'm'],
      [InitialSound, 'initial-sound', 'm'],
      [WordPicture, 'word-picture', 'mouse'],
    ] as const)('%o answers with the choice id', async (component, type, id) => {
      const { element, answers, click, update } = await render(component as Type<unknown>, {
        payload: PAYLOADS[type],
      });
      await click(`choice-${id}`);
      expect(answers).toEqual([{ choiceId: id }]);
      await update({ reveal: { choiceId: id }, locked: true });
      expect(byTestId(element, `choice-${id}`).classList).toContain('mu-choice--revealed');
    });

    it('names pictures by their word and turns shapes', async () => {
      const initial = await render(InitialSound, { payload: PAYLOADS['initial-sound'] });
      expect(byTestId(initial.element, 'exercise-picture').querySelector('img')?.alt).toBe('Maus');
      const shapes = await render(ShapePick, { payload: PAYLOADS['shape-pick'] });
      const square = byTestId(shapes.element, 'choice-square').querySelector<HTMLElement>(
        'mu-picture',
      );
      expect(square?.style.transform).toBe('rotate(45deg) scale(0.7)');
    });

    it('splits words into syllable arcs when asked', async () => {
      const { element, update } = await render(WordPicture, { payload: PAYLOADS['word-picture'] });
      expect(element.querySelectorAll('.syllable').length).toBe(1);
      await update({ payload: { ...PAYLOADS['word-picture'], syllables: undefined } });
      expect(byTestId(element, 'word').textContent?.trim()).toBe('MAUS');
    });
  });

  describe('Syllables', () => {
    it('counts drum beats with undo, a limit and a check', async () => {
      const { element, answers, click, update } = await render(Syllables, {
        payload: { ...PAYLOADS.syllables, maxCount: 3 },
      });
      expect(byTestId(element, 'check').getAttribute('aria-disabled')).toBe('true');
      for (let i = 0; i < 4; i++) {
        await click('drum');
      }
      expect(byTestId(element, 'beat-count').textContent).toContain('3 Mal');
      await click('drum-undo');
      await click('check');
      expect(answers).toEqual([{ count: 2 }]);
      expect(element.querySelector('.word')?.textContent).toBe('Banane');

      await update({ reveal: { count: 3 }, locked: true, cue: { clap: true } });
      expect(byTestId(element, 'drum').classList).toContain('drum--clap');
      expect(element.querySelectorAll('.beat--on').length).toBe(3);
      await click('drum');
      await click('drum-undo');
      expect(answers).toHaveLength(1);
    });
  });

  describe('BuildWord', () => {
    it('places tiles into slots, removes them again and checks the letters', async () => {
      const { element, answers, click, update } = await render(BuildWord, {
        payload: PAYLOADS['build-word'],
      });
      await click('tile-t2');
      await click('tile-t3');
      expect(byTestId(element, 'slot-1').getAttribute('aria-label')).toBe('Platz 2: x');
      await click('slot-1');
      expect(byTestId(element, 'slot-1').getAttribute('aria-label')).toBe('Platz 2: leer');
      await click('tile-t1');
      await click('tile-t3');
      expect(byTestId(element, 'tile-t2').classList).toContain('tile--used');
      await click('check');
      expect(answers).toEqual([{ letters: ['E', 'i'] }]);

      await update({ reveal: { letters: ['E', 'i'] }, locked: true, cue: { placeTiles: true } });
      expect(byTestId(element, 'slot-0').classList).toContain('mu-blank--revealed');
    });
  });

  describe('ExerciseHost', () => {
    const TYPES = Object.keys(PAYLOADS) as SupportedExerciseType[];

    /** A rough accessible name: aria-label, else text, else the alt texts of images inside. */
    function accessibleName(element: Element): string {
      const label = element.getAttribute('aria-label')?.trim();
      if (label) {
        return label;
      }
      const alts = [...element.querySelectorAll('img')]
        .map((img) => img.getAttribute('alt')?.trim() ?? '')
        .filter(Boolean);
      return [element.textContent?.trim() ?? '', ...alts].filter(Boolean).join(' ');
    }

    it('tells an unnamed button apart from a named one', () => {
      const unnamed = document.createElement('button');
      unnamed.innerHTML = '<img alt="">';
      expect(accessibleName(unnamed)).toBe('');
      unnamed.innerHTML = '<img alt="Maus">';
      expect(accessibleName(unnamed)).toBe('Maus');
    });

    it.each(TYPES)('names every answer button of %s', async (type) => {
      const { element } = await renderComponent(ExerciseHost, { exercise: exercise(type) });
      const buttons = [
        ...element.querySelectorAll('[data-testid^="choice-"], [data-testid^="relation-"]'),
      ];
      for (const button of buttons) {
        expect(accessibleName(button), button.getAttribute('data-testid') ?? '').not.toBe('');
      }
    });

    it.each([
      ['shape-pick', PAYLOADS['shape-pick']],
      ['word-picture', PAYLOADS['word-picture']],
      [
        'sequence',
        {
          kind: 'pattern',
          items: [{ pictureId: 'apple' }],
          choices: [{ id: 'p1', pictureId: 'egg' }],
        },
      ],
      ['count-objects', PAYLOADS['count-objects']],
    ] as const)('names the picture choices of %s by their word', async (type, payload) => {
      const { element } = await renderComponent(ExerciseHost, {
        exercise: { ...exercise(type), payload },
      });
      const choices = [...element.querySelectorAll('[data-testid^="choice-"]')];
      expect(choices.length).toBeGreaterThan(0);
      choices.forEach((choice) => expect(accessibleName(choice)).not.toBe(''));
    });

    it.each(TYPES)('renders %s and forwards its answer', async (type) => {
      const { element, fixture } = await renderComponent(ExerciseHost, {
        exercise: exercise(type),
      });
      expect(element.getAttribute('data-type')).toBe(type);
      expect(element.querySelector(`mu-${type}`)).not.toBeNull();
      const answers: unknown[] = [];
      fixture.componentInstance.answered.subscribe((answer) => answers.push(answer));
      const choice = element.querySelector<HTMLElement>(
        '[data-testid^="choice-"], [data-testid^="relation-"]',
      );
      choice?.click();
      expect(answers.length).toBe(choice ? 1 : 0);
    });
  });
});
