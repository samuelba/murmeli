import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityChart, valueKey } from './progress-view';

const HEIGHT = 168;
const AXIS_WIDTH = 32;
const TOP = 22;
const BOTTOM = 40;
const MAX_BAR = 24;
const WEEKDAY_MIN_SLOT = 26;

/**
 * One measure per day as columns (no second axis: minutes and runs are two of these charts).
 * The SVG is drawn in real pixels for the measured width, so text and the 4px rounded bar ends
 * stay crisp. Every value is also in the table below the chart.
 */
@Component({
  selector: 'mu-activity-chart',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="figure" [attr.data-testid]="'activity-' + chart().metric">
      <figcaption class="caption" [id]="captionId()">{{ title() }}</figcaption>
      <svg
        class="chart"
        role="img"
        [attr.width]="width()"
        [attr.height]="height"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height"
        [attr.aria-labelledby]="captionId() + ' ' + summaryId()"
      >
        @for (tick of ticks(); track tick.value) {
          <line
            class="grid"
            [attr.x1]="axisWidth"
            [attr.x2]="width()"
            [attr.y1]="tick.y"
            [attr.y2]="tick.y"
          />
          <text class="tick" [attr.x]="axisWidth - 6" [attr.y]="tick.y + 4" text-anchor="end">
            {{ tick.value }}
          </text>
        }
        @for (bar of bars(); track bar.day) {
          <g class="bar" [class.bar--empty]="bar.value === 0" [attr.data-testid]="'bar-' + bar.day">
            <title>
              {{ bar.date }}: {{ unitKey(bar.value) | transloco: { count: bar.value } }}
            </title>
            <rect
              class="hit"
              [attr.x]="bar.slotX"
              y="0"
              [attr.width]="bar.slotWidth"
              [attr.height]="height"
            />
            @if (bar.value > 0) {
              <path class="mark" [attr.d]="bar.path" />
            }
            @if (bar.peak) {
              <text class="peak" [attr.x]="bar.center" [attr.y]="bar.top - 6" text-anchor="middle">
                {{ bar.value }}
              </text>
            }
            <text class="day" [attr.x]="bar.center" [attr.y]="height - 22" text-anchor="middle">
              {{ bar.dayOfMonth }}
            </text>
            @if (showWeekday()) {
              <text
                class="weekday"
                [attr.x]="bar.center"
                [attr.y]="height - 6"
                text-anchor="middle"
              >
                {{ bar.weekday }}
              </text>
            }
          </g>
        }
        <line
          class="baseline"
          [attr.x1]="axisWidth"
          [attr.x2]="width()"
          [attr.y1]="baseline"
          [attr.y2]="baseline"
        />
      </svg>
      <p class="summary" [id]="summaryId()">
        {{
          'parent.progress.activity.summary'
            | transloco
              : {
                  total: (unitKey(chart().total) | transloco: { count: chart().total }),
                  days: chart().activeDays,
                  count: chart().bars.length,
                }
        }}
        @if (peak(); as peak) {
          {{
            'parent.progress.activity.peak'
              | transloco
                : {
                    value: (unitKey(peak.value) | transloco: { count: peak.value }),
                    date: peak.date,
                  }
          }}
        }
      </p>
    </figure>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .figure {
      margin: 0;
    }

    .caption {
      margin-bottom: var(--mu-space-2);
      font-weight: 800;
    }

    .chart {
      display: block;
      width: 100%;
      overflow: visible;
      font-family: var(--mu-font-ui);
    }

    .grid {
      stroke: var(--mu-color-border);
      stroke-width: 1;
    }

    .baseline {
      stroke: var(--mu-color-border-strong);
      stroke-width: 1;
    }

    .tick,
    .day,
    .weekday {
      fill: var(--mu-color-text-muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .peak {
      fill: var(--mu-color-text);
      font-size: 13px;
      font-weight: 800;
    }

    .hit {
      fill: transparent;
    }

    .mark {
      fill: var(--mu-chart-color, var(--mu-color-secondary));
    }

    .bar:hover .hit {
      fill: color-mix(in srgb, var(--mu-color-text) 6%, transparent);
    }

    .summary {
      margin: var(--mu-space-2) 0 0;
      color: var(--mu-color-text-muted);
      font-size: 0.95rem;
    }

    @media (forced-colors: active) {
      .mark {
        fill: CanvasText;
      }
    }
  `,
})
export class ActivityChartView {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private static nextId = 0;

  readonly chart = input.required<ActivityChart>();
  readonly title = input.required<string>();

  protected readonly height = HEIGHT;
  protected readonly axisWidth = AXIS_WIDTH;
  protected readonly baseline = HEIGHT - BOTTOM;
  protected readonly width = signal(320);
  private readonly id = ActivityChartView.nextId++;
  protected unitKey(count: number): string {
    return valueKey(this.chart().metric, count);
  }
  protected readonly captionId = computed(() => `activity-${this.chart().metric}-${this.id}`);
  protected readonly summaryId = computed(() => `${this.captionId()}-summary`);

  private readonly slot = computed(
    () => (this.width() - AXIS_WIDTH) / Math.max(1, this.chart().bars.length),
  );
  protected readonly showWeekday = computed(() => this.slot() >= WEEKDAY_MIN_SLOT);
  protected readonly ticks = computed(() => {
    const plot = this.baseline - TOP;
    return this.chart().ticks.map((value) => ({
      value,
      y: this.baseline - (value / this.chart().max) * plot,
    }));
  });
  protected readonly bars = computed(() => {
    const slot = this.slot();
    const barWidth = Math.min(MAX_BAR, Math.max(4, slot - 4));
    const plot = this.baseline - TOP;
    return this.chart().bars.map((bar, index) => {
      const slotX = AXIS_WIDTH + index * slot;
      const center = slotX + slot / 2;
      const barHeight = bar.value > 0 ? Math.max(2, bar.share * plot) : 0;
      const top = this.baseline - barHeight;
      return {
        ...bar,
        slotX,
        slotWidth: slot,
        center,
        top,
        dayOfMonth: Number(bar.day.slice(8, 10)),
        path: columnPath(center - barWidth / 2, top, barWidth, barHeight),
      };
    });
  });
  protected readonly peak = computed(() => this.chart().bars.find((bar) => bar.peak) ?? null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.host.nativeElement;
      this.measure(element);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.measure(element));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measure(element: HTMLElement): void {
    const measured = Math.floor(element.getBoundingClientRect().width);
    if (measured > 0 && measured !== this.width()) {
      this.width.set(measured);
    }
  }
}

/** A column with 4px rounded corners at the data end and square corners at the baseline. */
export function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  const round = (value: number) => Math.round(value * 100) / 100;
  const [x0, y0, x1, y1] = [x, y, x + width, y + height].map(round) as [
    number,
    number,
    number,
    number,
  ];
  return (
    `M${x0},${y1} L${x0},${round(y0 + r)} Q${x0},${y0} ${round(x0 + r)},${y0} ` +
    `L${round(x1 - r)},${y0} Q${x1},${y0} ${x1},${round(y0 + r)} L${x1},${y1} Z`
  );
}
