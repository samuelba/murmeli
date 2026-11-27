import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface Finger {
  readonly x: number;
  readonly top: number;
}

const FINGERS: readonly Finger[] = [
  { x: 30, top: 14 },
  { x: 45, top: 6 },
  { x: 60, top: 10 },
  { x: 74, top: 22 },
];
const FOLDED_TOP = 50;

/** Raised fingers, counted the Swiss way: the thumb first. Two hands above five. */
@Component({
  selector: 'mu-fingers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (hand of hands(); track $index) {
      <svg viewBox="-16 0 116 120" focusable="false" [class.mirror]="$index === 1">
        <g class="hand">
          <rect
            class="thumb"
            x="6"
            [attr.y]="hand.thumb ? 44 : 66"
            width="16"
            [attr.height]="hand.thumb ? 44 : 22"
            rx="8"
            transform="rotate(-28 22 92)"
          />
          @for (finger of hand.fingers; track finger.x) {
            <rect
              [attr.x]="finger.x - 7"
              [attr.y]="finger.top"
              width="14"
              [attr.height]="70 - finger.top"
              rx="7"
            />
          }
          <rect x="20" y="52" width="64" height="58" rx="22" />
        </g>
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 4px;
    }

    svg {
      width: 84px;
      height: 86px;
    }

    .mirror {
      transform: scaleX(-1);
    }

    .hand rect {
      fill: #f6cfa6;
      stroke: #8a5a30;
      stroke-width: 3;
    }
  `,
})
export class Fingers {
  readonly count = input.required<number>();

  protected readonly hands = computed(() => {
    const count = Math.max(0, Math.min(10, this.count()));
    const sizes = count > 5 ? [5, count - 5] : [count];
    return sizes.map((raised) => ({
      thumb: raised >= 1,
      fingers: FINGERS.map((finger, index) => ({
        x: finger.x,
        top: index + 2 <= raised ? finger.top : FOLDED_TOP,
      })),
    }));
  });
}
