import { TestBed } from '@angular/core/testing';
import { checkAnswer, generateRun, loadContent, parseAnswer } from '@murmeli/content';
import type { GeneratedItem, TraceLetterPayload } from '@murmeli/content';
import { byTestId, provideAppTesting } from '../../../../testing/app-testing';
import { keydown, pointer, renderExercise } from '../../../../testing/exercise-testing';
import { PAYLOADS } from '../../../../testing/learn-testing';
import { frameAt } from './trace-animation';
import {
  MAX_POINTS,
  TracePoint,
  TraceStroke,
  appendPoint,
  arrowOf,
  centroid,
  finishStroke,
  isDot,
  labelOf,
  linePath,
  modelDuration,
  partialStroke,
  resample,
  smoothPath,
  strokeDuration,
  strokeLength,
  toBox,
  toClient,
} from './trace-geometry';
import { TraceLetter } from './trace-letter';

const RECT = { left: 10, top: 20, width: 224, height: 224 };

/** The model strokes, walked in small steps with a little wobble, like a careful kid. */
function handDrawn(strokes: readonly TraceStroke[], wobble = 1.5): TracePoint[][] {
  return strokes.map((stroke) => {
    if (stroke.length < 2) {
      return [stroke[0]!];
    }
    const length = strokeLength(stroke);
    const steps = Math.max(2, Math.round(length / 2));
    return Array.from({ length: steps + 1 }, (_, i) => {
      const [x, y] = partialStroke(stroke, i / steps).tip;
      const jitter = Math.sin(i * 1.7) * wobble;
      return [x + jitter, y - jitter] as TracePoint;
    });
  });
}

describe('trace geometry', () => {
  it('maps client pixels into the box and back', () => {
    expect(toBox(10, 20, RECT)).toEqual([-6, -6]);
    expect(toBox(234, 244, RECT)).toEqual([106, 106]);
    expect(toBox(-500, 9000, RECT)).toEqual([-20, 120]);
    const { x, y } = toClient([50, 80], RECT);
    expect(toBox(x, y, RECT)).toEqual([50, 80]);
    const wide = { left: 0, top: 0, width: 400, height: 200 };
    expect(toBox(toClient([25, 75], wide).x, toClient([25, 75], wide).y, wide)).toEqual([25, 75]);
    expect(toBox(0, 0, { left: 0, top: 0, width: 0, height: 0 }).every(Number.isFinite)).toBe(true);
  });

  it('skips tiny moves, resamples and caps long strokes', () => {
    const start: TraceStroke = [[0, 0]];
    expect(appendPoint(start, [0.3, 0.3])).toBe(start);
    expect(appendPoint(start, [2, 0])).toEqual([
      [0, 0],
      [2, 0],
    ]);
    const long: TracePoint[] = Array.from({ length: 450 }, (_, i) => [i / 10, 0]);
    const capped = finishStroke(long);
    expect(capped).toHaveLength(MAX_POINTS);
    expect(capped[0]).toEqual([0, 0]);
    expect(capped.at(-1)).toEqual([44.9, 0]);
    expect(finishStroke([[1, 1]])).toEqual([[1, 1]]);
    expect(resample([[3, 3]], 5)).toEqual([[3, 3]]);
    expect(
      resample(
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        3,
      ),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it('draws smooth paths, dots, arrows and number labels', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[1, 2]])).toBe('M1 2l0.01 0');
    expect(
      smoothPath([
        [0, 0],
        [4, 0],
      ]),
    ).toBe('M0 0L4 0');
    expect(
      smoothPath([
        [0, 0],
        [4, 0],
        [4, 4],
      ]),
    ).toBe('M0 0Q4 0 4 2L4 4');
    expect(linePath([[5, 5]])).toBe('M5 5l0.01 0');
    const dot: TraceStroke = [
      [50, 28.5],
      [50, 31.5],
    ];
    expect(isDot(dot)).toBe(true);
    expect(centroid(dot)).toEqual([50, 30]);
    expect(arrowOf(dot)).toBeNull();
    expect(labelOf(dot)).toEqual([50, 21]);
    const down: TraceStroke = [
      [50, 10],
      [50, 80],
    ];
    expect(arrowOf(down)).toEqual({ at: [50, 36.6], angle: 90 });
    expect(labelOf(down)).toEqual([50, 1]);
    expect(partialStroke(down, 0.5)).toEqual({
      points: [
        [50, 10],
        [50, 45],
      ],
      tip: [50, 45],
    });
    expect(partialStroke([[1, 1]], 0.5).tip).toEqual([1, 1]);
  });

  it('times the model animation stroke by stroke', () => {
    const strokes = PAYLOADS['trace-letter'].strokes;
    const first = strokeDuration(strokes[0]!);
    expect(first).toBeGreaterThanOrEqual(650);
    expect(modelDuration(strokes)).toBeGreaterThan(first * 2);
    expect(frameAt(strokes, 0)).toEqual({
      done: 0,
      current: { index: 0, progress: 0 },
      finished: false,
    });
    expect(frameAt(strokes, first / 2).current?.progress).toBeCloseTo(0.5);
    expect(frameAt(strokes, first + 10)).toEqual({ done: 1, current: null, finished: false });
    expect(frameAt(strokes, first / 2, true).current?.progress).toBe(1);
    expect(frameAt(strokes, 60_000)).toEqual({ done: 3, current: null, finished: true });
  });
});

describe('TraceLetter', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting()] });
  });
  let clock = 0;
  beforeEach(() => {
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => vi.restoreAllMocks());

  /** Moves the animation clock on and lets a frame run. */
  async function elapse(ms: number, fixture: { whenStable(): Promise<unknown> }, wait = 40) {
    clock += ms;
    await new Promise((resolve) => setTimeout(resolve, wait));
    await fixture.whenStable();
  }

  async function setup(payload: TraceLetterPayload = PAYLOADS['trace-letter'], inputs = {}) {
    const result = await renderExercise(TraceLetter, { payload, ...inputs });
    const surface = byTestId(result.element, 'trace-surface');
    surface.getBoundingClientRect = () => ({ ...RECT, right: 234, bottom: 244 }) as DOMRect;
    const draw = async (strokes: readonly TraceStroke[], init: PointerEventInit = {}) => {
      for (const stroke of strokes) {
        const [first, ...rest] = stroke.map((point) => toClient(point, RECT));
        pointer(surface, 'pointerdown', first!.x, first!.y, init);
        for (const point of rest) {
          pointer(surface, 'pointermove', point.x, point.y, init);
        }
        const last = rest.at(-1) ?? first!;
        pointer(surface, 'pointerup', last.x, last.y, init);
      }
      await result.fixture.whenStable();
    };
    return { ...result, surface, draw };
  }

  it('shows guide lines, the model, numbered start dots and arrows', async () => {
    const { element } = await setup();
    expect(element.querySelectorAll('line[class^="guide"]').length).toBe(4);
    expect(element.querySelectorAll('.model__track').length).toBe(3);
    expect(element.querySelectorAll('.arrow').length).toBe(3);
    expect(byTestId(element, 'trace-start-2').textContent?.trim()).toBe('3');
    expect(byTestId(element, 'trace-stroke-count').textContent).toContain('Striche: 3');
    const surface = byTestId(element, 'trace-surface');
    expect(surface.getAttribute('aria-label')).toBe('Fahre das A nach');
    expect(surface.getAttribute('role')).toBe('application');
    expect(byTestId(element, 'trace-done').getAttribute('aria-disabled')).toBe('true');
  });

  it('hides the model when the level asks to write from memory', async () => {
    const { element } = await setup({ ...PAYLOADS['trace-letter'], showModel: false });
    expect(element.querySelector('.model')).toBeNull();
  });

  it('turns pointer strokes into normalized strokes and answers with them', async () => {
    const { element, answers, draw, click } = await setup();
    await draw(PAYLOADS['trace-letter'].strokes);
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(3);
    expect(byTestId(element, 'trace-status').textContent).toContain('Gezeichnet: 3');
    await click('trace-done');
    expect(answers).toEqual([
      {
        strokes: [
          [
            [50, 10],
            [20, 80],
          ],
          [
            [50, 10],
            [80, 80],
          ],
          [
            [31, 55],
            [69, 55],
          ],
        ],
      },
    ]);
  });

  it('ignores a second finger (a palm), right clicks and lost strokes', async () => {
    const { element, surface, fixture } = await setup();
    pointer(surface, 'pointerdown', 50, 50);
    pointer(surface, 'pointerdown', 120, 120, { pointerId: 2, isPrimary: false });
    pointer(surface, 'pointermove', 130, 130, { pointerId: 2 });
    pointer(surface, 'pointerup', 130, 130, { pointerId: 2 });
    pointer(surface, 'pointermove', 90, 90);
    pointer(surface, 'pointerup', 120, 120);
    pointer(surface, 'pointerdown', 50, 50, { button: 2 });
    pointer(surface, 'pointermove', 70, 70);
    pointer(surface, 'pointerdown', 60, 60, { pointerId: 3, pointerType: 'touch' });
    pointer(surface, 'pointercancel', 60, 60, { pointerId: 3 });
    await fixture.whenStable();
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(1);
  });

  it('keeps a long stroke after a cancel and caps the strokes at six', async () => {
    const { element, surface, fixture } = await setup();
    pointer(surface, 'pointerdown', 40, 40, { pointerType: 'pen' });
    pointer(surface, 'pointermove', 60, 60, { pointerType: 'pen' });
    pointer(surface, 'pointermove', 80, 80, { pointerType: 'pen' });
    pointer(surface, 'pointercancel', 80, 80, { pointerType: 'pen' });
    for (let i = 0; i < 6; i += 1) {
      pointer(surface, 'pointerdown', 40, 40 + i * 20);
      pointer(surface, 'pointerup', 90, 40 + i * 20);
    }
    await fixture.whenStable();
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(6);
    expect(byTestId(element, 'trace-status').textContent).toContain('Mehr Striche gehen nicht');
  });

  it('wipes the strokes with "Nochmal" and blocks input while locked', async () => {
    const { element, draw, click, update, answers } = await setup();
    await draw(PAYLOADS['trace-letter'].strokes.slice(0, 1));
    await click('trace-clear');
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(0);
    expect(byTestId(element, 'trace-status').textContent).toContain('weggewischt');
    await update({ locked: true });
    await draw(PAYLOADS['trace-letter'].strokes);
    await click('trace-done');
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(0);
    expect(answers).toEqual([]);
  });

  it('draws with the keyboard: arrows move the pen, space sets it down and lifts it', async () => {
    const line: TraceLetterPayload = {
      ...PAYLOADS['trace-letter'],
      char: 'I',
      strokes: [
        [
          [50, 10],
          [50, 80],
        ],
      ],
    };
    const { element, surface, fixture, answers } = await setup(line);
    surface.focus();
    keydown(surface, 'ArrowDown');
    await fixture.whenStable();
    expect(byTestId(element, 'trace-pen')).toBeTruthy();
    expect(byTestId(element, 'trace-status').textContent).toContain('auf der Linie');
    keydown(surface, ' ');
    await fixture.whenStable();
    expect(byTestId(element, 'trace-status').textContent).toContain('Stift aufgesetzt');
    for (let i = 0; i < 6; i += 1) {
      keydown(surface, 'ArrowDown');
    }
    keydown(surface, 'ArrowDown', { shiftKey: true });
    keydown(surface, ' ');
    await fixture.whenStable();
    expect(byTestId(element, 'trace-status').textContent).toContain('Stift abgehoben');
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(1);
    keydown(surface, ' ');
    keydown(surface, 'ArrowRight', { shiftKey: true });
    await fixture.whenStable();
    expect(byTestId(element, 'trace-status').textContent).toContain('neben der Linie');
    keydown(surface, 'Backspace');
    keydown(surface, 'x');
    keydown(surface, 'a', { ctrlKey: true });
    await fixture.whenStable();
    expect(element.querySelectorAll('[data-testid="trace-stroke"]').length).toBe(1);
    keydown(surface, 'Enter');
    expect(answers).toHaveLength(1);
    const [stroke] = (answers[0] as { strokes: number[][][] }).strokes;
    expect(stroke![0]).toEqual([50, 14]);
    expect(stroke!.at(-1)).toEqual([50, 48]);
  });

  it('keeps "Fertig" off until every stroke of the model is drawn', async () => {
    const { element, draw, click, answers } = await setup();
    await draw(PAYLOADS['trace-letter'].strokes.slice(0, 2));
    expect(byTestId(element, 'trace-done').getAttribute('aria-disabled')).toBe('true');
    await click('trace-done');
    expect(answers).toEqual([]);
    await draw(PAYLOADS['trace-letter'].strokes.slice(2));
    expect(byTestId(element, 'trace-done').getAttribute('aria-disabled')).toBeNull();
  });

  it('plays the model with a pencil on "Zeig mir" and after a tracing hint', async () => {
    const { element, click, fixture } = await setup();
    await click('trace-show');
    expect(byTestId(element, 'trace-animation')).toBeTruthy();
    expect(byTestId(element, 'trace-pencil')).toBeTruthy();
    await elapse(10_000, fixture, 1300);
    expect(element.querySelector('[data-testid="trace-animation"]')).toBeNull();

    const hinted = await setup(
      { ...PAYLOADS['trace-letter'], showModel: false },
      {
        hint: 'start-at-dot',
      },
    );
    expect(byTestId(hinted.element, 'trace-animation')).toBeTruthy();
    expect(hinted.element.querySelector('.start.mu-pulse')).not.toBeNull();
    const ordered = await setup(PAYLOADS['trace-letter'], { hint: 'stroke-order' });
    expect(ordered.element.querySelector('.num.mu-pulse')).not.toBeNull();
    const counted = await setup(PAYLOADS['trace-letter'], { hint: 'stroke-count' });
    expect(byTestId(counted.element, 'trace-stroke-count').classList).toContain('mu-cue');
  });

  it('traces the model in the demo and then shows it as the solution', async () => {
    const payload = PAYLOADS['trace-letter'];
    const { element, update, fixture } = await setup(payload, {
      locked: true,
      cue: { highlight: 'canvas' },
    });
    expect(byTestId(element, 'trace-surface').classList).toContain('mu-cue');
    await update({ cue: { trace: true }, reveal: { strokes: payload.strokes } });
    expect(byTestId(element, 'trace-animation')).toBeTruthy();
    expect(element.querySelector('[data-testid="trace-solution"]')).toBeNull();
    await elapse(10_000, fixture);
    expect(byTestId(element, 'trace-animation').querySelector('[data-testid="trace-pencil"]')).toBe(
      null,
    );
    await update({ cue: { highlight: 'canvas' } });
    expect(element.querySelectorAll('[data-testid="trace-solution"]').length).toBe(3);
  });

  describe('with real generated letters', () => {
    const content = loadContent();
    const locale = 'de-CH' as const;
    const items: GeneratedItem[] = ['reading-de-schreibwiese-01', 'reading-de-schreibwiese-08']
      .map((id) => content.index.levels[id]!.level)
      .flatMap((level) => generateRun(level, 7, { locale, content }));

    it.each(items.map((item) => [(item.payload as TraceLetterPayload).char, item] as const))(
      'the checker accepts %s traced along the model',
      async (_char, item) => {
        const payload = item.payload as TraceLetterPayload;
        const { draw, click, answers } = await setup(payload);
        await draw(handDrawn(payload.strokes));
        await click('trace-done');
        const parsed = parseAnswer('trace-letter', answers[0]);
        expect(parsed.success).toBe(true);
        expect(checkAnswer(item.solution, parsed.success ? parsed.answer : never())).toEqual(
          expect.objectContaining({ correct: true }),
        );
      },
    );

    it('the checker rejects a scribble and strokes drawn backwards', async () => {
      const item = items.find((each) => (each.payload as TraceLetterPayload).char === 'A')!;
      const payload = item.payload as TraceLetterPayload;
      const scribble = await setup(payload);
      await scribble.draw(
        payload.strokes.map((_, i) => [
          [10, 10 + i * 8],
          [90, 90 - i * 8],
        ]),
      );
      await scribble.click('trace-done');
      expect(checkAnswer(item.solution, scribble.answers[0] as never)).toEqual(
        expect.objectContaining({ correct: false }),
      );
      const extra = await setup(payload);
      await extra.draw([...handDrawn(payload.strokes), [[50, 90]]]);
      await extra.click('trace-done');
      expect(checkAnswer(item.solution, extra.answers[0] as never)).toEqual(
        expect.objectContaining({ correct: false, hint: 'stroke-count' }),
      );
      const backwards = await setup(payload);
      await backwards.draw(handDrawn(payload.strokes.map((stroke) => [...stroke].reverse())));
      await backwards.click('trace-done');
      expect(checkAnswer(item.solution, backwards.answers[0] as never)).toEqual(
        expect.objectContaining({ correct: false, hint: 'start-at-dot' }),
      );
    });
  });
});

function never(): never {
  throw new Error('unreachable');
}
