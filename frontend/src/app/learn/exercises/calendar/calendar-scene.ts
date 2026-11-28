import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type SceneUnit = 'daytime' | 'season';

const DAYTIMES = ['morning', 'noon', 'evening', 'night'] as const;
const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;

const SUN_AT = [
  { x: 40, y: 86 },
  { x: 100, y: 28 },
  { x: 160, y: 86 },
] as const;

const BLOSSOMS = [
  [78, 40],
  [96, 30],
  [116, 38],
  [86, 54],
  [110, 56],
  [124, 48],
  [72, 50],
] as const;

const FALLING = [
  [62, 78, -30],
  [132, 84, 40],
  [146, 66, 10],
  [70, 98, 60],
  [122, 104, -20],
] as const;

const FLAKES = [
  [24, 20],
  [52, 40],
  [150, 18],
  [176, 44],
  [40, 70],
  [168, 76],
  [100, 12],
  [130, 34],
] as const;

const STARS = [
  [30, 22],
  [62, 40],
  [88, 16],
  [120, 50],
  [176, 62],
] as const;

let nextId = 0;

/** A drawn time of day (sun or moon over a house) or season (one tree through the year). */
@Component({
  selector: 'mu-calendar-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'description()',
    '[attr.data-scene]': 'name()',
  },
  template: `
    <svg viewBox="0 0 200 120" aria-hidden="true" focusable="false">
      <defs>
        <clipPath [attr.id]="clipId">
          <rect width="200" height="120" rx="14" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        <rect class="sky" width="200" height="120" />
        @if (unit() === 'daytime') {
          @if (sun(); as at) {
            <circle class="sun" [attr.cx]="at.x" [attr.cy]="at.y" r="15" />
          } @else {
            @for (star of stars; track $index) {
              <circle class="star" [attr.cx]="star[0]" [attr.cy]="star[1]" r="2" />
            }
            <circle class="moon" cx="152" cy="28" r="15" />
            <circle class="moon-shadow" cx="160" cy="23" r="13" />
          }
          <path class="ground" d="M0 92 Q50 78 100 90 T200 86 V120 H0 Z" />
          <rect class="house" x="82" y="76" width="36" height="26" />
          <path class="roof" d="M76 78 L100 60 L124 78 Z" />
          <rect class="window" x="94" y="84" width="12" height="10" />
        } @else {
          @if (name() === 'summer') {
            <circle class="sun" cx="30" cy="24" r="13" />
          }
          @if (name() === 'winter') {
            @for (flake of flakes; track $index) {
              <circle class="flake" [attr.cx]="flake[0]" [attr.cy]="flake[1]" r="2.5" />
            }
          }
          <path class="ground" d="M0 100 Q100 90 200 100 V120 H0 Z" />
          <path class="trunk" d="M94 104 L96 62 L104 62 L106 104 Z" />
          <path class="branch" d="M100 74 L80 54 M100 68 L120 48 M98 62 L92 40 M102 62 L110 38" />
          @switch (name()) {
            @case ('spring') {
              <circle class="crown" cx="100" cy="46" r="30" />
              @for (blossom of blossoms; track $index) {
                <circle class="blossom" [attr.cx]="blossom[0]" [attr.cy]="blossom[1]" r="4" />
              }
            }
            @case ('summer') {
              <circle class="crown" cx="100" cy="44" r="36" />
              <circle class="crown" cx="76" cy="54" r="20" />
              <circle class="crown" cx="124" cy="54" r="20" />
            }
            @case ('fall') {
              <circle class="crown" cx="100" cy="46" r="30" />
              <circle class="crown crown--red" cx="84" cy="56" r="14" />
              <circle class="crown crown--red" cx="118" cy="40" r="12" />
              @for (leaf of falling; track $index) {
                <ellipse
                  class="leaf"
                  [attr.cx]="leaf[0]"
                  [attr.cy]="leaf[1]"
                  rx="5"
                  ry="3"
                  [attr.transform]="'rotate(' + leaf[2] + ' ' + leaf[0] + ' ' + leaf[1] + ')'"
                />
              }
            }
            @default {
              <path class="snow" d="M78 56 L84 52 M118 46 L124 44 M90 40 L95 38" />
            }
          }
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 360px);
      aspect-ratio: 200 / 120;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .ground {
      fill: #7cc26b;
    }

    .house {
      fill: #f6e7c8;
      stroke: #5b4636;
      stroke-width: 2;
    }

    .roof {
      fill: #d9534f;
      stroke: #5b4636;
      stroke-width: 2;
      stroke-linejoin: round;
    }

    .window {
      fill: #9fd7f2;
      stroke: #5b4636;
      stroke-width: 1.5;
    }

    .sun {
      fill: #ffd23f;
    }

    .moon,
    .star {
      fill: #fff3b0;
    }

    .trunk {
      fill: #8a5a33;
    }

    .branch {
      fill: none;
      stroke: #8a5a33;
      stroke-width: 4;
      stroke-linecap: round;
    }

    .crown {
      fill: #a8e07a;
    }

    .blossom {
      fill: #ff9ecf;
      stroke: #fff;
      stroke-width: 1;
    }

    .leaf {
      fill: #e8742c;
    }

    .flake {
      fill: #fff;
    }

    .snow {
      fill: none;
      stroke: #fff;
      stroke-width: 4;
      stroke-linecap: round;
    }

    :host([data-scene='morning']) .sky {
      fill: #ffe3b3;
    }

    :host([data-scene='noon']) .sky {
      fill: #8fd3f7;
    }

    :host([data-scene='evening']) {
      .sky {
        fill: #ff9f5a;
      }

      .sun {
        fill: #ff5f3a;
      }

      .window {
        fill: #ffd23f;
      }
    }

    :host([data-scene='night']) {
      .sky,
      .moon-shadow {
        fill: #1f2a55;
      }

      .ground {
        fill: #2f5d3a;
      }

      .house {
        fill: #b9ab90;
      }

      .window {
        fill: #ffd23f;
      }
    }

    :host([data-scene='spring']) .sky {
      fill: #cfeeff;
    }

    :host([data-scene='summer']) {
      .sky {
        fill: #8fd3f7;
      }

      .ground,
      .crown {
        fill: #3f9b45;
      }
    }

    :host([data-scene='fall']) {
      .sky {
        fill: #dfe8ef;
      }

      .ground {
        fill: #c9a26b;
      }

      .crown {
        fill: #f2a52e;
      }

      .crown--red {
        fill: #d9472b;
      }
    }

    :host([data-scene='winter']) {
      .sky {
        fill: #b9c8da;
      }

      .ground {
        fill: #fff;
      }
    }
  `,
})
export class CalendarScene {
  private readonly transloco = inject(TranslocoService);

  readonly unit = input.required<SceneUnit>();
  readonly index = input.required<number>();

  protected readonly clipId = `mu-calendar-scene-${(nextId += 1)}`;
  protected readonly blossoms = BLOSSOMS;
  protected readonly falling = FALLING;
  protected readonly flakes = FLAKES;
  protected readonly stars = STARS;

  protected readonly name = computed(() =>
    this.unit() === 'daytime' ? DAYTIMES[this.index() % 4]! : SEASONS[this.index() % 4]!,
  );
  protected readonly sun = computed(() =>
    this.unit() === 'daytime' ? (SUN_AT[this.index()] ?? null) : null,
  );
  protected readonly description = computed(() =>
    this.transloco.translate(`learn.ex.calendar.${this.unit()}.${this.name()}`),
  );
}
