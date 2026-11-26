import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { HintKey } from '../../learn.models';
import { ExerciseBase } from '../shared/exercise-base';
import { prefersReducedMotion } from '../shared/motion';
import { TraceFrame, frameAt } from './trace-animation';
import {
  MAX_STROKES,
  TracePoint,
  TraceStroke,
  VIEW_MIN,
  VIEW_SIZE,
  appendPoint,
  arrowOf,
  centroid,
  finishStroke,
  isDot,
  labelOf,
  linePath,
  partialStroke,
  smoothPath,
  toBox,
} from './trace-geometry';

const TRACE_HINTS: readonly HintKey[] = [
  'stroke-count',
  'stroke-order',
  'start-at-dot',
  'trace-slowly',
];
const KEY_STEP = 4;
const KEY_FINE_STEP = 1;
const HOLD_FINISHED_MS = 1200;
const KEYS: Readonly<Record<string, TracePoint>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

let nextId = 0;

type Emphasis = 'dots' | 'numbers' | 'count' | null;

interface ModelStroke {
  readonly d: string;
  readonly dot: boolean;
  readonly start: TracePoint;
  readonly label: TracePoint;
  readonly arrow: { readonly at: TracePoint; readonly angle: number } | null;
}

/**
 * Trace a letter or digit with a finger, a stylus or the mouse (Pointer Events, one pointer at a
 * time so a resting palm is ignored). Guide lines, the faint model, numbered start dots and
 * direction arrows help; "Zeig mir, wie es geht" draws the model with a pencil. Keyboard users
 * move a pen with the arrow keys and set it down or lift it with the space bar.
 */
@Component({
  selector: 'mu-trace-letter',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <p class="count" data-testid="trace-stroke-count" [class.mu-cue]="emphasis() === 'count'">
        {{ 'learn.ex.trace.strokes' | transloco: { count: model().length } }}
      </p>
      <div
        #surface
        class="surface"
        tabindex="0"
        role="application"
        data-testid="trace-surface"
        [class.mu-cue]="highlighted('canvas')"
        [class.surface--full]="full()"
        [attr.aria-roledescription]="'learn.ex.trace.role' | transloco"
        [attr.aria-label]="'learn.ex.trace.surface' | transloco: { char: payload().char }"
        [attr.aria-describedby]="keysId"
        [attr.aria-disabled]="locked() ? 'true' : null"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="cancel($event)"
        (lostpointercapture)="up($event)"
        (keydown)="key($event)"
        (blur)="keyboard.set(false)"
      >
        <svg [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
          <rect
            class="band"
            [attr.x]="viewMin"
            [attr.y]="guides().ascender"
            [attr.width]="viewSize"
            [attr.height]="guides().baseline - guides().ascender"
          />
          @for (line of guideLines(); track line.key) {
            <line
              [attr.class]="'guide guide--' + line.key"
              [attr.x1]="viewMin"
              [attr.x2]="viewMin + viewSize"
              [attr.y1]="line.y"
              [attr.y2]="line.y"
            />
          }
          @if (modelVisible()) {
            <g class="model">
              @for (stroke of modelStrokes(); track $index) {
                <path class="model__track" [attr.d]="stroke.d" />
                <path class="model__dots" [attr.d]="stroke.d" />
              }
              @for (stroke of modelStrokes(); track $index) {
                @if (stroke.arrow; as arrow) {
                  <path
                    class="arrow"
                    d="M-3 -2.8L3.4 0L-3 2.8Z"
                    [attr.transform]="
                      'translate(' +
                      arrow.at[0] +
                      ' ' +
                      arrow.at[1] +
                      ') rotate(' +
                      arrow.angle +
                      ')'
                    "
                  />
                }
              }
              @for (stroke of modelStrokes(); track $index) {
                <g class="start" [class.mu-pulse]="emphasis() === 'dots'">
                  <circle
                    class="start__dot"
                    r="3.6"
                    [attr.cx]="stroke.start[0]"
                    [attr.cy]="stroke.start[1]"
                  />
                </g>
                <g
                  class="num"
                  [class.mu-pulse]="emphasis() === 'numbers'"
                  [attr.data-testid]="'trace-start-' + $index"
                >
                  <circle r="4.6" [attr.cx]="stroke.label[0]" [attr.cy]="stroke.label[1]" />
                  <text [attr.x]="stroke.label[0]" [attr.y]="stroke.label[1]">
                    {{ $index + 1 }}
                  </text>
                </g>
              }
            </g>
          }
          @if (solution(); as solution) {
            @for (d of solution; track $index) {
              <path class="solution" data-testid="trace-solution" [attr.d]="d" />
            }
          }
          <g class="ink" [class.ink--faded]="solution() !== null">
            @for (d of drawn(); track $index) {
              <path [attr.d]="d" data-testid="trace-stroke" />
            }
          </g>
          @if (animated(); as animated) {
            <g class="anim" data-testid="trace-animation">
              @for (d of animated.paths; track $index) {
                <path [attr.d]="d" />
              }
              @if (animated.tip; as tip) {
                <g
                  class="pencil"
                  data-testid="trace-pencil"
                  [attr.transform]="'translate(' + tip[0] + ' ' + tip[1] + ')'"
                >
                  <g transform="rotate(32)">
                    <rect x="-2.8" y="-27" width="5.6" height="5" rx="1.4" class="pencil__eraser" />
                    <rect x="-2.8" y="-22.5" width="5.6" height="16" class="pencil__body" />
                    <path d="M-2.8 -6.5L2.8 -6.5L0 0Z" class="pencil__wood" />
                    <path d="M-1 -2.2L1 -2.2L0 0Z" class="pencil__lead" />
                  </g>
                </g>
              }
            </g>
          }
          @if (keyboard() && pen(); as pen) {
            <g class="pen" [class.pen--down]="current() !== null" data-testid="trace-pen">
              <circle r="3.4" [attr.cx]="pen[0]" [attr.cy]="pen[1]" />
              <circle r="0.9" [attr.cx]="pen[0]" [attr.cy]="pen[1]" class="pen__center" />
            </g>
          }
        </svg>
      </div>
      <p class="mu-visually-hidden" [id]="keysId">{{ 'learn.ex.trace.keys' | transloco }}</p>
      <p class="mu-visually-hidden" aria-live="polite" data-testid="trace-status">{{ status() }}</p>
      <div class="actions">
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="trace-show"
          [attr.aria-disabled]="locked() ? 'true' : null"
          (click)="showMe()"
        >
          {{ 'learn.ex.trace.showMe' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="trace-clear"
          [attr.aria-disabled]="locked() || strokes().length === 0 ? 'true' : null"
          (click)="clear()"
        >
          {{ 'learn.ex.trace.again' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--primary mu-ex__check"
          data-testid="trace-done"
          [attr.aria-disabled]="locked() || strokes().length === 0 ? 'true' : null"
          (click)="done()"
        >
          {{ 'learn.ex.trace.done' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .mu-ex {
      gap: var(--mu-space-3);
    }

    .count {
      margin: 0;
      padding: var(--mu-space-1) var(--mu-space-4);
      border-radius: var(--mu-radius-pill);
      background: var(--mu-color-marmot-soft);
      color: var(--mu-color-text);
      font-weight: 800;
    }

    .surface {
      position: relative;
      width: min(100%, 520px);
      aspect-ratio: 1;
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: inset 0 0 0 3px var(--mu-color-border);
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;

      &:focus-visible {
        outline: 5px solid var(--mu-color-focus);
        outline-offset: 3px;
      }

      &[aria-disabled='true'] {
        cursor: default;
      }

      &--full {
        animation: mu-shake 0.4s ease-in-out;
      }
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    path,
    line {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .band {
      fill: color-mix(in srgb, var(--mu-color-sky) 12%, transparent);
    }

    .guide {
      stroke: var(--mu-color-sky-strong);
      stroke-width: 0.6;
      stroke-dasharray: 2.4 2;
    }

    .guide--baseline {
      stroke: var(--mu-color-marmot);
      stroke-width: 1.2;
      stroke-dasharray: none;
    }

    .model__track {
      stroke: color-mix(in srgb, var(--mu-color-text) 11%, transparent);
      stroke-width: 12;
    }

    .model__dots {
      stroke: var(--mu-color-text-muted);
      stroke-width: 1.8;
      stroke-dasharray: 0.01 3.4;
    }

    .arrow {
      fill: var(--mu-color-meadow-strong);
      stroke: var(--mu-color-surface);
      stroke-width: 0.6;
    }

    .start__dot {
      fill: var(--mu-color-meadow-strong);
      stroke: var(--mu-color-surface);
      stroke-width: 1;
    }

    .num {
      circle {
        fill: var(--mu-color-signpost-yellow);
        stroke: var(--mu-color-signpost-black);
        stroke-width: 0.6;
      }

      text {
        fill: var(--mu-color-signpost-black);
        font: 800 6.4px var(--mu-font-learn);
        text-anchor: middle;
        dominant-baseline: central;
      }
    }

    .mu-pulse {
      transform-box: fill-box;
      transform-origin: center;
      animation: mu-trace-pulse 0.9s ease-in-out 3;
    }

    .ink path {
      stroke: var(--mu-color-sky-strong);
      stroke-width: 6.5;
    }

    .ink--faded {
      opacity: 0.35;
    }

    .solution {
      stroke: var(--mu-color-success);
      stroke-width: 6.5;
    }

    .anim path {
      stroke: var(--mu-color-writing);
      stroke-width: 6.5;
    }

    .pencil__body {
      fill: var(--mu-color-signpost-yellow);
      stroke: var(--mu-color-signpost-black);
      stroke-width: 0.6;
    }

    .pencil__eraser {
      fill: #f29bb0;
      stroke: var(--mu-color-signpost-black);
      stroke-width: 0.6;
    }

    .pencil__wood {
      fill: #f3d2a2;
      stroke: var(--mu-color-signpost-black);
      stroke-width: 0.6;
    }

    .pencil__lead {
      fill: var(--mu-color-signpost-black);
      stroke: none;
    }

    .pen circle {
      fill: none;
      stroke: var(--mu-color-focus);
      stroke-width: 1.2;
    }

    .pen--down circle {
      fill: color-mix(in srgb, var(--mu-color-focus) 35%, transparent);
    }

    .pen .pen__center {
      fill: var(--mu-color-focus);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
    }

    @keyframes mu-trace-pulse {
      50% {
        transform: scale(1.45);
      }
    }

    @keyframes mu-shake {
      25% {
        transform: translateX(-6px);
      }
      75% {
        transform: translateX(6px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mu-pulse,
      .surface--full {
        animation: none;
      }

      .mu-pulse {
        stroke: var(--mu-color-focus);
        stroke-width: 1.4;
      }
    }
  `,
})
export class TraceLetter extends ExerciseBase<'trace-letter'> {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');

  protected readonly viewMin = VIEW_MIN;
  protected readonly viewSize = VIEW_SIZE;
  protected readonly viewBox = `${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`;
  protected readonly keysId = `mu-trace-keys-${nextId++}`;

  protected readonly strokes = signal<readonly TraceStroke[]>([]);
  protected readonly current = signal<TraceStroke | null>(null);
  protected readonly pen = signal<TracePoint | null>(null);
  protected readonly keyboard = signal(false);
  protected readonly status = signal('');
  protected readonly full = signal(false);
  private readonly frame = signal<TraceFrame | null>(null);
  private activePointer: number | null = null;
  private animationHandle: number | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private source: 'demo' | 'help' | null = null;

  protected readonly model = computed(() => this.payload().strokes);
  protected readonly guides = computed(() => this.payload().guides);
  protected readonly guideLines = computed(() => {
    const { ascender, xHeight, baseline, descender } = this.guides();
    return [
      { key: 'ascender', y: ascender },
      { key: 'xheight', y: xHeight },
      { key: 'baseline', y: baseline },
      { key: 'descender', y: descender },
    ];
  });
  protected readonly modelStrokes = computed<ModelStroke[]>(() =>
    this.model().map((points) => {
      const dot = isDot(points);
      return {
        d: dot ? linePath([centroid(points)]) : linePath(points),
        dot,
        start: dot ? centroid(points) : points[0]!,
        label: labelOf(points),
        arrow: arrowOf(points),
      };
    }),
  );
  protected readonly emphasis = computed<Emphasis>(() => {
    switch (this.hint()) {
      case 'start-at-dot':
        return 'dots';
      case 'stroke-order':
        return 'numbers';
      case 'stroke-count':
        return 'count';
      default:
        return null;
    }
  });
  protected readonly modelVisible = computed(
    () =>
      this.payload().showModel ||
      this.demo() ||
      this.frame() !== null ||
      this.reveal() !== null ||
      this.emphasis() !== null,
  );
  protected readonly drawn = computed(() => {
    const current = this.current();
    return [...this.strokes(), ...(current ? [current] : [])].map(smoothPath);
  });
  protected readonly solution = computed(() => {
    const reveal = this.reveal();
    return reveal && this.frame() === null
      ? reveal.strokes.map((points) => linePath(points))
      : null;
  });
  protected readonly animated = computed(() => {
    const frame = this.frame();
    if (!frame) {
      return null;
    }
    const model = this.model();
    const paths = model.slice(0, frame.done).map((points) => linePath(points));
    let tip: TracePoint | null = null;
    if (frame.current) {
      const partial = partialStroke(model[frame.current.index]!, frame.current.progress);
      paths.push(linePath(partial.points));
      tip = partial.tip;
    }
    return { paths, tip };
  });

  constructor() {
    super();
    effect(() => {
      const trace = this.cue()?.trace === true;
      untracked(() => {
        if (trace) {
          this.play('demo');
        } else if (this.source === 'demo') {
          this.stop();
        }
      });
    });
    effect(() => {
      const hint = this.hint();
      untracked(() => {
        if (hint && TRACE_HINTS.includes(hint)) {
          this.play('help');
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected showMe(): void {
    if (!this.locked()) {
      this.play('help');
    }
  }

  protected clear(): void {
    if (this.locked()) {
      return;
    }
    this.strokes.set([]);
    this.current.set(null);
    this.activePointer = null;
    this.status.set(this.transloco.translate('learn.ex.trace.cleared'));
  }

  protected done(): void {
    if (this.current()) {
      this.endStroke();
    }
    const strokes = this.strokes();
    if (strokes.length > 0) {
      this.emit({ strokes: strokes.map((stroke) => stroke.map(([x, y]) => [x, y])) });
    }
  }

  protected down(event: PointerEvent): void {
    if (this.locked() || this.activePointer !== null || !event.isPrimary) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (this.strokes().length >= MAX_STROKES) {
      this.flashFull();
      return;
    }
    this.stop();
    this.keyboard.set(false);
    this.activePointer = event.pointerId;
    try {
      this.surface().nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a nicety: drawing still works inside the surface without it.
    }
    this.current.set([this.boxPoint(event)]);
  }

  protected move(event: PointerEvent): void {
    if (event.pointerId !== this.activePointer || !this.current()) {
      return;
    }
    const events = event.getCoalescedEvents?.() ?? [];
    let stroke = this.current()!;
    for (const each of events.length > 0 ? events : [event]) {
      stroke = appendPoint(stroke, this.boxPoint(each));
    }
    this.current.set(stroke);
  }

  protected up(event: PointerEvent): void {
    if (event.pointerId !== this.activePointer) {
      return;
    }
    this.activePointer = null;
    if (event.type !== 'lostpointercapture') {
      this.current.update((stroke) =>
        stroke ? appendPoint(stroke, this.boxPoint(event)) : stroke,
      );
    }
    this.endStroke();
  }

  /** The browser took the pointer away (a gesture, a palm): keep only a real stroke. */
  protected cancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointer) {
      return;
    }
    this.activePointer = null;
    if ((this.current()?.length ?? 0) < 3) {
      this.current.set(null);
    } else {
      this.endStroke();
    }
  }

  protected key(event: KeyboardEvent): void {
    if (this.locked() || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const direction = KEYS[event.key];
    if (direction) {
      event.preventDefault();
      this.movePen(direction, event.shiftKey ? KEY_FINE_STEP : KEY_STEP);
    } else if (event.key === ' ') {
      event.preventDefault();
      this.togglePen();
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      this.undo();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.done();
    }
  }

  private movePen([dx, dy]: TracePoint, step: number): void {
    this.keyboard.set(true);
    const [x, y] = this.pen() ?? this.nextStart();
    const clampToView = (value: number) =>
      Math.min(Math.max(value, VIEW_MIN), VIEW_MIN + VIEW_SIZE);
    const next: TracePoint = [clampToView(x + dx * step), clampToView(y + dy * step)];
    this.pen.set(next);
    this.current.update((stroke) => (stroke ? appendPoint(stroke, next) : stroke));
  }

  private togglePen(): void {
    this.keyboard.set(true);
    if (this.current()) {
      this.endStroke();
      this.status.set(this.transloco.translate('learn.ex.trace.penUp'));
      return;
    }
    if (this.strokes().length >= MAX_STROKES) {
      this.flashFull();
      return;
    }
    this.stop();
    const pen = this.pen() ?? this.nextStart();
    this.pen.set(pen);
    this.current.set([pen]);
    this.status.set(this.transloco.translate('learn.ex.trace.penDown'));
  }

  /** Drops the stroke being drawn, or else the last one. */
  private undo(): void {
    if (this.current()) {
      this.current.set(null);
    } else {
      this.strokes.update((strokes) => strokes.slice(0, -1));
    }
    this.announceCount();
  }

  /** Where the keyboard pen starts: the start dot of the next stroke, or the middle. */
  private nextStart(): TracePoint {
    const next = this.modelStrokes()[this.strokes().length];
    return next && this.modelVisible() ? next.start : [50, 45];
  }

  private endStroke(): void {
    const stroke = this.current();
    this.current.set(null);
    if (!stroke || stroke.length === 0) {
      return;
    }
    this.strokes.update((strokes) => [...strokes, finishStroke(stroke)]);
    this.announceCount();
  }

  private announceCount(): void {
    this.status.set(
      this.transloco.translate('learn.ex.trace.drawn', { count: this.strokes().length }),
    );
  }

  private flashFull(): void {
    this.full.set(false);
    this.status.set(this.transloco.translate('learn.ex.trace.full'));
    queueMicrotask(() => this.full.set(true));
  }

  private boxPoint(event: Pick<PointerEvent, 'clientX' | 'clientY'>): TracePoint {
    return toBox(
      event.clientX,
      event.clientY,
      this.surface().nativeElement.getBoundingClientRect(),
    );
  }

  private play(source: 'demo' | 'help'): void {
    this.stop();
    this.source = source;
    const view = this.document.defaultView;
    const now = () => view?.performance?.now() ?? Date.now();
    const stepwise = prefersReducedMotion(this.document);
    const strokes = this.model();
    const started = now();
    const tick = () => {
      const frame = frameAt(strokes, now() - started, stepwise);
      this.frame.set(frame);
      if (!frame.finished) {
        this.animationHandle = this.schedule(tick);
      } else if (source === 'help') {
        this.animationHandle = null;
        this.holdTimer = setTimeout(() => this.stop(), HOLD_FINISHED_MS);
      } else {
        this.animationHandle = null;
      }
    };
    tick();
  }

  private stop(): void {
    const view = this.document.defaultView;
    if (this.animationHandle !== null) {
      if (view?.cancelAnimationFrame) {
        view.cancelAnimationFrame(this.animationHandle);
      } else {
        clearTimeout(this.animationHandle);
      }
      this.animationHandle = null;
    }
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.source = null;
    this.frame.set(null);
  }

  private schedule(callback: () => void): number {
    const view = this.document.defaultView;
    return view?.requestAnimationFrame
      ? view.requestAnimationFrame(callback)
      : (setTimeout(callback, 16) as unknown as number);
  }
}
