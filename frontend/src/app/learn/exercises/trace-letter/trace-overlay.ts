import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TraceLetterPayload } from '@murmeli/content';
import { TracePoint, VIEW_MIN, VIEW_SIZE } from './trace-geometry';

export type Emphasis = 'dots' | 'numbers' | 'count' | null;

export interface ModelStroke {
  readonly d: string;
  readonly start: TracePoint;
  readonly label: TracePoint;
  readonly arrow: { readonly at: TracePoint; readonly angle: number } | null;
}

export interface AnimatedModel {
  readonly paths: readonly string[];
  readonly tip: TracePoint | null;
}

/**
 * What the drawing surface shows, back to front: writing lines, the faint model with numbered
 * start dots and arrows, the solution, the kid's ink, Murmeli's pencil and the keyboard pen.
 */
@Component({
  selector: 'mu-trace-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
          @for (stroke of model(); track $index) {
            <path class="model__track" [attr.d]="stroke.d" />
            <path class="model__dots" [attr.d]="stroke.d" />
          }
          @for (stroke of model(); track $index) {
            @if (stroke.arrow; as arrow) {
              <path
                class="arrow"
                d="M-3 -2.8L3.4 0L-3 2.8Z"
                [attr.transform]="
                  'translate(' + arrow.at[0] + ' ' + arrow.at[1] + ') rotate(' + arrow.angle + ')'
                "
              />
            }
          }
          @for (stroke of model(); track $index) {
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
              <text [attr.x]="stroke.label[0]" [attr.y]="stroke.label[1]">{{ $index + 1 }}</text>
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
      @if (pen(); as pen) {
        <g class="pen" [class.pen--down]="penDown()" data-testid="trace-pen">
          <circle r="3.4" [attr.cx]="pen[0]" [attr.cy]="pen[1]" />
          <circle r="0.9" [attr.cx]="pen[0]" [attr.cy]="pen[1]" class="pen__center" />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
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

    @media (max-width: 600px) {
      .num circle {
        r: 6px;
      }

      .num text {
        font-size: 8.4px;
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

    @keyframes mu-trace-pulse {
      50% {
        transform: scale(1.45);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mu-pulse {
        animation: none;
        stroke: var(--mu-color-focus);
        stroke-width: 1.4;
      }
    }
  `,
})
export class TraceOverlay {
  readonly guides = input.required<TraceLetterPayload['guides']>();
  readonly model = input.required<readonly ModelStroke[]>();
  readonly modelVisible = input(true);
  readonly emphasis = input<Emphasis>(null);
  readonly solution = input<readonly string[] | null>(null);
  readonly drawn = input<readonly string[]>([]);
  readonly animated = input<AnimatedModel | null>(null);
  readonly pen = input<TracePoint | null>(null);
  readonly penDown = input(false);

  protected readonly viewMin = VIEW_MIN;
  protected readonly viewSize = VIEW_SIZE;
  protected readonly viewBox = `${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`;
  protected readonly guideLines = computed(() => {
    const { ascender, xHeight, baseline, descender } = this.guides();
    return [
      { key: 'ascender', y: ascender },
      { key: 'xheight', y: xHeight },
      { key: 'baseline', y: baseline },
      { key: 'descender', y: descender },
    ];
  });
}
