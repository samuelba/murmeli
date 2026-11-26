import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const CENTER = 100;
const NUMBER_RADIUS = 59;

/** Hand angles in degrees, clockwise from 12. The hour hand moves on with the minutes. */
export function handAngles(hour: number, minute: number): { hour: number; minute: number } {
  return { hour: ((hour % 12) + minute / 60) * 30, minute: (minute % 60) * 6 };
}

function polar(angle: number, radius: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.round((CENTER + Math.sin(radians) * radius) * 10) / 10,
    y: Math.round((CENTER - Math.cos(radians) * radius) * 10) / 10,
  };
}

/** An analog school clock: 12 numbers, minute ticks, a short thick hour hand, a long minute hand. */
@Component({
  selector: 'mu-clock-face',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'description()' },
  template: `
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle class="rim" cx="100" cy="100" r="94" />
      <circle class="face" cx="100" cy="100" r="88" />
      @for (tick of ticks; track tick.key) {
        <line
          [attr.class]="tick.hour ? 'tick tick--hour' : 'tick'"
          [attr.x1]="tick.x1"
          [attr.y1]="tick.y1"
          [attr.x2]="tick.x2"
          [attr.y2]="tick.y2"
        />
      }
      @for (number of numbers; track number.value) {
        <text class="number" [attr.x]="number.x" [attr.y]="number.y">{{ number.value }}</text>
      }
      <g class="hand hand--hour" data-testid="hour-hand" [attr.transform]="rotate(angles().hour)">
        <line x1="100" y1="112" x2="100" y2="56" />
      </g>
      <g
        class="hand hand--minute"
        data-testid="minute-hand"
        [attr.transform]="rotate(angles().minute)"
      >
        <line x1="100" y1="116" x2="100" y2="22" />
      </g>
      <circle class="cap" cx="100" cy="100" r="7" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: clamp(200px, 62vw, 280px);
      aspect-ratio: 1;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .rim {
      fill: var(--mu-color-marmot);
    }

    .face {
      fill: var(--mu-color-surface);
    }

    .tick {
      stroke: var(--mu-color-text-muted);
      stroke-width: 1.5;
      stroke-linecap: round;
    }

    .tick--hour {
      stroke: var(--mu-color-text);
      stroke-width: 4;
    }

    .number {
      fill: var(--mu-color-text);
      font: 800 19px var(--mu-font-learn);
      text-anchor: middle;
      dominant-baseline: central;
    }

    .hand line {
      stroke-linecap: round;
    }

    .hand--hour line {
      stroke: var(--mu-color-text);
      stroke-width: 11;
    }

    .hand--minute line {
      stroke: var(--mu-color-sky-strong);
      stroke-width: 6;
    }

    .cap {
      fill: var(--mu-color-signpost-yellow);
      stroke: var(--mu-color-signpost-black);
      stroke-width: 2;
    }
  `,
})
export class ClockFace {
  private readonly transloco = inject(TranslocoService);

  readonly hour = input.required<number>();
  readonly minute = input.required<number>();

  protected readonly ticks = Array.from({ length: 60 }, (_, index) => {
    const hour = index % 5 === 0;
    const outer = polar(index * 6, 84);
    const inner = polar(index * 6, hour ? 76 : 80);
    return { key: index, hour, x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
  });
  protected readonly numbers = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    ...polar((index + 1) * 30, NUMBER_RADIUS),
  }));
  protected readonly angles = computed(() => handAngles(this.hour(), this.minute()));

  /** Where the hands point, in words, without saying the time (that is the question). */
  protected readonly description = computed(() => {
    const hour = ((this.hour() + 11) % 12) + 1;
    const minute = this.minute();
    const next = (hour % 12) + 1;
    const hourText =
      minute === 0
        ? this.transloco.translate('learn.ex.clock.hourOn', { hour })
        : this.transloco.translate('learn.ex.clock.hourBetween', { hour, next });
    const mark = minute % 5 === 0 ? minute / 5 || 12 : null;
    const minuteText =
      mark === null
        ? this.transloco.translate('learn.ex.clock.minuteAt', { minute })
        : this.transloco.translate('learn.ex.clock.minuteOn', { number: mark });
    return this.transloco.translate('learn.ex.clock.face', { hour: hourText, minute: minuteText });
  });

  protected rotate(angle: number): string {
    return `rotate(${Math.round(angle * 10) / 10} ${CENTER} ${CENTER})`;
  }
}
