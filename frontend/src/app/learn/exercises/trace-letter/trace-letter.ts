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
import { Icon } from '../../../shared/icon/icon';
import type { HintKey } from '../../learn.models';
import { ExerciseBase } from '../shared/exercise-base';
import {
  TracePoint,
  arrowOf,
  centroid,
  isDot,
  labelOf,
  linePath,
  partialStroke,
  smoothPath,
} from './trace-geometry';
import { AnimatedModel, Emphasis, ModelStroke, TraceOverlay } from './trace-overlay';
import { TracePen } from './trace-pen';
import { ModelPlayback } from './trace-playback';

const TRACE_HINTS: readonly HintKey[] = [
  'stroke-count',
  'stroke-order',
  'start-at-dot',
  'trace-slowly',
];
const EMPHASIS: Partial<Record<HintKey, Emphasis>> = {
  'start-at-dot': 'dots',
  'stroke-order': 'numbers',
  'stroke-count': 'count',
};

let nextId = 0;

/**
 * Trace a letter or digit with a finger, a stylus or the mouse. Guide lines, the faint model,
 * numbered start dots and direction arrows help; "Zeig mir, wie es geht" draws the model with a
 * pencil. Keyboard users move a pen with the arrow keys and set it down with the space bar.
 */
@Component({
  selector: 'mu-trace-letter',
  imports: [TranslocoPipe, Icon, TraceOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <p class="count" data-testid="trace-stroke-count" [class.mu-cue]="emphasis() === 'count'">
        {{ 'learn.ex.trace.strokes' | transloco: { count: payload().strokes.length } }}
      </p>
      <div
        #surface
        class="surface"
        tabindex="0"
        role="application"
        data-testid="trace-surface"
        [class.mu-cue]="highlighted('canvas')"
        [class.surface--full]="pen.full()"
        [attr.aria-roledescription]="'learn.ex.trace.role' | transloco"
        [attr.aria-label]="'learn.ex.trace.surface' | transloco: { char: payload().char }"
        [attr.aria-describedby]="keysId"
        [attr.aria-disabled]="locked() ? 'true' : null"
        (pointerdown)="pen.down($event)"
        (pointermove)="pen.move($event)"
        (pointerup)="pen.up($event)"
        (pointercancel)="pen.cancel($event)"
        (lostpointercapture)="pen.up($event)"
        (keydown)="pen.key($event)"
        (blur)="pen.keyboard.set(false)"
      >
        <mu-trace-overlay
          [guides]="payload().guides"
          [model]="modelStrokes()"
          [modelVisible]="modelVisible()"
          [emphasis]="emphasis()"
          [solution]="solution()"
          [drawn]="drawn()"
          [animated]="animated()"
          [pen]="pen.keyboard() ? pen.pen() : null"
          [penDown]="pen.current() !== null"
        />
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
          <mu-icon name="visibility" />
          {{ 'learn.ex.trace.showMe' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="trace-clear"
          [attr.aria-disabled]="locked() || pen.strokes().length === 0 ? 'true' : null"
          (click)="clear()"
        >
          <mu-icon name="refresh" />
          {{ 'learn.ex.trace.again' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--primary mu-ex__check"
          data-testid="trace-done"
          [attr.aria-disabled]="locked() || !ready() ? 'true' : null"
          (click)="done()"
        >
          <mu-icon name="check" />
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

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
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
      .surface--full {
        animation: none;
      }
    }
  `,
})
export class TraceLetter extends ExerciseBase<'trace-letter'> {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly playback = new ModelPlayback(this.document);

  protected readonly keysId = `mu-trace-keys-${nextId++}`;
  protected readonly status = signal('');
  protected readonly pen = new TracePen({
    locked: () => this.locked(),
    model: () => this.payload().strokes,
    nextStart: (index) => {
      const next = this.modelStrokes()[index];
      return next && this.modelVisible() ? next.start : [50, 45];
    },
    rect: () => this.surface().nativeElement.getBoundingClientRect(),
    capture: (pointerId) => {
      try {
        this.surface().nativeElement.setPointerCapture?.(pointerId);
      } catch {
        // Capture is a nicety: drawing still works inside the surface without it.
      }
    },
    announce: (key, params) => this.status.set(this.transloco.translate(key, params)),
    drawingStarts: () => this.playback.stop(),
    submit: () => this.done(),
  });

  protected readonly modelStrokes = computed<ModelStroke[]>(() =>
    this.payload().strokes.map((points) => {
      const dot = isDot(points);
      return {
        d: dot ? linePath([centroid(points)]) : linePath(points),
        start: dot ? centroid(points) : points[0]!,
        label: labelOf(points),
        arrow: arrowOf(points),
      };
    }),
  );
  protected readonly emphasis = computed<Emphasis>(() => {
    const hint = this.hint();
    return (hint && EMPHASIS[hint]) ?? null;
  });
  protected readonly modelVisible = computed(
    () =>
      this.payload().showModel ||
      this.demo() ||
      this.playback.frame() !== null ||
      this.reveal() !== null ||
      this.emphasis() !== null,
  );
  /** "Fertig" waits until at least as many strokes as the model has are drawn. */
  protected readonly ready = computed(
    () => this.pen.strokes().length >= this.payload().strokes.length,
  );
  protected readonly drawn = computed(() => {
    const current = this.pen.current();
    return [...this.pen.strokes(), ...(current ? [current] : [])].map(smoothPath);
  });
  protected readonly solution = computed(() => {
    const reveal = this.reveal();
    return reveal && this.playback.frame() === null
      ? reveal.strokes.map((points) => linePath(points))
      : null;
  });
  protected readonly animated = computed<AnimatedModel | null>(() => {
    const frame = this.playback.frame();
    if (!frame) {
      return null;
    }
    const model = this.payload().strokes;
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
          this.playback.play(this.payload().strokes, 'demo');
        } else if (this.playback.source === 'demo') {
          this.playback.stop();
        }
      });
    });
    effect(() => {
      const hint = this.hint();
      untracked(() => {
        if (hint && TRACE_HINTS.includes(hint)) {
          this.playback.play(this.payload().strokes, 'help');
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.playback.stop());
  }

  protected showMe(): void {
    if (!this.locked()) {
      this.playback.play(this.payload().strokes, 'help');
    }
  }

  protected clear(): void {
    if (!this.locked()) {
      this.pen.clear();
    }
  }

  protected done(): void {
    if (this.locked()) {
      return;
    }
    const strokes = this.pen.finish();
    if (this.ready()) {
      this.emit({ strokes: strokes.map((stroke) => stroke.map(([x, y]) => [x, y])) });
    }
  }
}
