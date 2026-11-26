import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export const SCENES = [
  'meadow',
  'garden',
  'forest',
  'park',
  'brook',
  'bay',
  'bridge',
  'mountain',
  'peak',
  'hut',
  'house',
  'workshop',
] as const;
export type Scene = (typeof SCENES)[number];

const WATER: ReadonlySet<string> = new Set(['brook', 'bay', 'bridge']);
const FIRS: readonly [number, number, number][] = [
  [30, 470, 1],
  [70, 490, 0.8],
  [330, 465, 1.1],
  [370, 495, 0.85],
];
const FLOWERS: readonly [number, number, string][] = [
  [40, 540, '#ff6b6b'],
  [90, 560, '#fff'],
  [150, 535, '#f7c600'],
  [250, 555, '#ff9ecd'],
  [310, 540, '#fff'],
  [360, 565, '#ff6b6b'],
];

/** A decorative Alpine backdrop per world scene (flat shapes, no ids, themed by CSS). */
@Component({
  selector: 'mu-scene',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-scene]': 'kind()' },
  template: `
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice" focusable="false">
      <g class="stars">
        <circle cx="40" cy="60" r="2" />
        <circle cx="120" cy="30" r="1.5" />
        <circle cx="210" cy="80" r="2" />
        <circle cx="300" cy="40" r="1.5" />
        <circle cx="370" cy="100" r="2" />
        <circle cx="80" cy="150" r="1.5" />
      </g>
      <g class="clouds">
        <ellipse cx="80" cy="120" rx="44" ry="14" />
        <ellipse cx="105" cy="108" rx="26" ry="14" />
        <ellipse cx="310" cy="190" rx="38" ry="12" />
        <ellipse cx="330" cy="180" rx="22" ry="12" />
      </g>
      <path
        class="far"
        d="M0 360 L55 270 L100 320 L170 215 L235 300 L295 240 L350 310 L400 270 L400 600 L0 600Z"
      />
      <path
        class="snow"
        d="M150 245 L170 215 L190 245 L178 238 L170 250 L160 240Z M280 262 L295 240 L310 262 L300 257 L294 265Z"
      />
      @switch (kind()) {
        @case ('mountain') {
          <path class="rock" d="M-20 600 L120 330 L190 420 L260 300 L420 600Z" />
          <path
            class="snow"
            d="M95 378 L120 330 L145 378 L130 370 L120 384 L108 372Z M235 348 L260 300 L285 348 L270 340 L260 354 L248 342Z"
          />
        }
        @case ('peak') {
          <path class="rock" d="M0 600 L200 250 L400 600Z" />
          <path class="snow" d="M160 320 L200 250 L240 320 L222 308 L205 328 L190 310 L176 324Z" />
          <path class="cross" d="M198 222 V252 M190 232 H206" />
        }
      }
      <path class="hill" d="M0 440 Q110 380 210 430 T400 415 L400 600 L0 600Z" />
      @if (water()) {
        <path class="water" d="M0 500 Q100 480 200 505 T400 495 L400 600 L0 600Z" />
        <path class="wave" d="M40 530 q15 -8 30 0 M160 550 q15 -8 30 0 M290 535 q15 -8 30 0" />
      } @else {
        <path class="hill2" d="M0 520 Q130 470 260 510 T400 500 L400 600 L0 600Z" />
      }
      @switch (kind()) {
        @case ('forest') {
          @for (fir of firs; track $index) {
            <g
              class="fir"
              [attr.transform]="'translate(' + fir[0] + ' ' + fir[1] + ') scale(' + fir[2] + ')'"
            >
              <rect x="-4" y="0" width="8" height="18" class="trunk" />
              <path d="M0 -60 L22 -20 L12 -20 L28 4 L-28 4 L-12 -20 L-22 -20Z" />
            </g>
          }
        }
        @case ('park') {
          @for (
            tree of [
              [50, 470],
              [340, 480],
              [110, 500],
            ];
            track $index
          ) {
            <g class="tree" [attr.transform]="'translate(' + tree[0] + ' ' + tree[1] + ')'">
              <rect x="-4" y="0" width="8" height="24" class="trunk" />
              <circle cx="0" cy="-12" r="24" />
            </g>
          }
        }
        @case ('bridge') {
          <path class="bridge" d="M60 520 Q200 420 340 520" />
          <path
            class="bridge-rail"
            d="M60 505 Q200 405 340 505 M110 480 V500 M160 455 V478 M200 447 V470 M240 455 V478 M290 480 V500"
          />
        }
        @case ('bay') {
          <path class="sail" d="M300 470 L300 420 L330 470Z" />
          <path class="boat" d="M285 474 H345 L335 486 H295Z" />
        }
        @case ('hut') {
          <ng-container *ngTemplateOutlet="chalet; context: { $implicit: 'translate(290 455)' }" />
        }
        @case ('house') {
          <ng-container
            *ngTemplateOutlet="chalet; context: { $implicit: 'translate(80 470) scale(0.9)' }"
          />
        }
        @case ('workshop') {
          <ng-container *ngTemplateOutlet="chalet; context: { $implicit: 'translate(300 465)' }" />
          <circle class="gear" cx="300" cy="420" r="12" />
        }
      }
      @if (flowers()) {
        @for (flower of flowerSpots; track $index) {
          <g class="flower" [attr.transform]="'translate(' + flower[0] + ' ' + flower[1] + ')'">
            <path class="stem" d="M0 0 V14" />
            <g [attr.fill]="flower[2]">
              <circle cx="-4" cy="-3" r="4" />
              <circle cx="4" cy="-3" r="4" />
              <circle cx="-3" cy="4" r="4" />
              <circle cx="3" cy="4" r="4" />
            </g>
            <circle r="2.6" class="flower__center" />
          </g>
        }
      }
      <ng-template #chalet let-transform>
        <g class="chalet" [attr.transform]="transform">
          <rect x="-30" y="-30" width="60" height="44" class="wall" />
          <path d="M-40 -28 L0 -62 L40 -28Z" class="roof" />
          <rect x="-10" y="-14" width="20" height="28" class="door" />
          <rect x="-24" y="-20" width="10" height="10" class="window" />
          <rect x="14" y="-20" width="10" height="10" class="window" />
        </g>
      </ng-template>
    </svg>
  `,
  styleUrl: './scene.scss',
})
export class SceneView {
  readonly scene = input.required<string>();

  protected readonly kind = computed<Scene>(() =>
    (SCENES as readonly string[]).includes(this.scene()) ? (this.scene() as Scene) : 'meadow',
  );
  protected readonly water = computed(() => WATER.has(this.kind()));
  protected readonly flowers = computed(() => ['meadow', 'garden', 'park'].includes(this.kind()));
  protected readonly firs = FIRS;
  protected readonly flowerSpots = FLOWERS;
}
