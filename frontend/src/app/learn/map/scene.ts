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
  'tower',
  'alp',
  'market',
] as const;
export type Scene = (typeof SCENES)[number];

type PropKind = 'fir' | 'tree' | 'bush' | 'stone' | 'flower' | 'chalet' | 'cow' | 'stall' | 'fence';

interface Prop {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
  readonly flip?: boolean;
  readonly color?: string;
}

const RED = '#ff6b6b';
const PINK = '#ff9ecd';
const WHITE = '#ffffff';
const YELLOW = '#f7c600';
const VIOLET = '#b48cff';

function flowers(spots: readonly (readonly [number, number])[], colors: readonly string[]): Prop[] {
  return spots.map(([x, y], index) => ({
    kind: 'flower',
    x,
    y,
    color: colors[index % colors.length],
  }));
}

function firs(spots: readonly (readonly [number, number, number])[]): Prop[] {
  return spots.map(([x, y, scale]) => ({ kind: 'fir', x, y, scale }));
}

const MEADOW_FLOWERS = [
  [60, 560],
  [130, 585],
  [210, 548],
  [300, 590],
  [500, 588],
  [590, 552],
  [670, 580],
  [745, 556],
] as const;

const PROPS: Record<Scene, readonly Prop[]> = {
  meadow: [
    ...firs([
      [70, 470, 0.8],
      [730, 462, 0.9],
    ]),
    { kind: 'stone', x: 640, y: 520 },
    ...flowers(MEADOW_FLOWERS, [RED, WHITE, YELLOW, PINK]),
  ],
  garden: [
    { kind: 'fence', x: 110, y: 520 },
    { kind: 'fence', x: 690, y: 520 },
    { kind: 'bush', x: 250, y: 505 },
    { kind: 'bush', x: 560, y: 505, scale: 1.2 },
    ...flowers(
      [...MEADOW_FLOWERS, [40, 540], [360, 575], [440, 560], [770, 590]],
      [RED, PINK, VIOLET, YELLOW, WHITE],
    ),
  ],
  forest: firs([
    [30, 480, 1.1],
    [95, 500, 0.9],
    [160, 470, 1.2],
    [235, 505, 0.85],
    [300, 465, 0.7],
    [505, 470, 0.75],
    [570, 500, 0.9],
    [640, 470, 1.25],
    [705, 505, 0.95],
    [775, 480, 1.1],
    [60, 590, 1],
    [740, 595, 1.05],
  ]),
  park: [
    { kind: 'tree', x: 80, y: 500, scale: 1.2 },
    { kind: 'tree', x: 230, y: 470, scale: 0.8 },
    { kind: 'tree', x: 600, y: 470, scale: 0.9 },
    { kind: 'tree', x: 730, y: 510, scale: 1.25 },
    { kind: 'bush', x: 330, y: 520 },
    ...flowers(
      [
        [160, 575],
        [470, 585],
        [660, 570],
      ],
      [WHITE, YELLOW, PINK],
    ),
  ],
  brook: [
    { kind: 'stone', x: 150, y: 540 },
    { kind: 'stone', x: 520, y: 555, scale: 1.3 },
    { kind: 'stone', x: 690, y: 525, scale: 0.8 },
    ...firs([
      [60, 470, 0.9],
      [740, 470, 1],
    ]),
    ...flowers(
      [
        [250, 500],
        [610, 495],
      ],
      [YELLOW, WHITE],
    ),
  ],
  bay: [
    { kind: 'tree', x: 70, y: 450, scale: 0.8 },
    { kind: 'stone', x: 720, y: 585 },
  ],
  bridge: firs([
    [70, 470, 1],
    [150, 490, 0.8],
    [660, 480, 0.85],
    [740, 465, 1.05],
  ]),
  mountain: [
    { kind: 'stone', x: 120, y: 560, scale: 1.4 },
    { kind: 'stone', x: 690, y: 575, scale: 1.1 },
    ...firs([
      [40, 500, 0.8],
      [770, 495, 0.85],
    ]),
  ],
  peak: [
    { kind: 'stone', x: 160, y: 570 },
    { kind: 'stone', x: 650, y: 560, scale: 1.3 },
  ],
  hut: [
    { kind: 'chalet', x: 650, y: 470 },
    ...firs([
      [80, 480, 1.1],
      [160, 500, 0.85],
      [760, 495, 0.9],
    ]),
    { kind: 'stone', x: 520, y: 560 },
  ],
  house: [
    { kind: 'chalet', x: 140, y: 490, scale: 0.95 },
    { kind: 'chalet', x: 660, y: 480, scale: 0.85, flip: true },
    { kind: 'tree', x: 760, y: 520, scale: 0.9 },
    { kind: 'fence', x: 300, y: 560, scale: 0.8 },
  ],
  workshop: [
    { kind: 'chalet', x: 640, y: 485 },
    { kind: 'tree', x: 110, y: 500 },
    { kind: 'stone', x: 250, y: 570 },
  ],
  tower: [
    { kind: 'chalet', x: 150, y: 495, scale: 0.8 },
    { kind: 'tree', x: 760, y: 505, scale: 0.9 },
    { kind: 'bush', x: 470, y: 520 },
  ],
  alp: [
    { kind: 'chalet', x: 660, y: 450, scale: 0.75 },
    { kind: 'fence', x: 150, y: 470, scale: 0.8 },
    { kind: 'cow', x: 220, y: 560 },
    { kind: 'cow', x: 560, y: 545, scale: 0.85, flip: true },
    { kind: 'cow', x: 380, y: 500, scale: 0.6 },
    ...flowers(
      [
        [80, 580],
        [300, 590],
        [700, 585],
      ],
      [WHITE, VIOLET, YELLOW],
    ),
  ],
  market: [
    { kind: 'stall', x: 150, y: 540 },
    { kind: 'stall', x: 650, y: 545, flip: true },
    { kind: 'tree', x: 40, y: 480, scale: 0.8 },
    { kind: 'tree', x: 770, y: 485, scale: 0.85 },
  ],
};

const RIVER: ReadonlySet<Scene> = new Set(['bay', 'bridge']);
const PICKETS = [-60, -32, -4, 24, 52];
const BUNTING = [130, 210, 290, 370, 450, 530, 610, 690].map((x) => {
  const t = (x - 60) / 680;
  return `M${x - 7} ${Math.round(330 + 140 * t * (1 - t))} l14 0 l-7 18Z`;
});

/** A decorative Alpine landscape per world (flat shapes, no ids, themed by CSS). */
@Component({
  selector: 'mu-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-scene]': 'kind()' },
  template: `
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" focusable="false">
      <g class="stars">
        <circle cx="80" cy="70" r="2.5" />
        <circle cx="210" cy="40" r="2" />
        <circle cx="330" cy="110" r="2.5" />
        <circle cx="470" cy="50" r="2" />
        <circle cx="590" cy="120" r="2" />
        <circle cx="720" cy="60" r="2.5" />
        <circle cx="150" cy="190" r="2" />
        <circle cx="660" cy="210" r="2" />
      </g>
      <circle class="sun" cx="680" cy="120" r="34" />
      <g class="clouds">
        <ellipse cx="160" cy="150" rx="60" ry="18" />
        <ellipse cx="195" cy="134" rx="34" ry="18" />
        <ellipse cx="540" cy="220" rx="48" ry="15" />
        <ellipse cx="565" cy="208" rx="28" ry="14" />
      </g>
      <path
        class="far"
        d="M0 380 L90 290 L160 340 L260 230 L350 320 L430 260 L520 330 L610 240 L700 310 L800 270 L800 600 L0 600Z"
      />
      <path
        class="snow"
        d="M232 270 L260 230 L288 270 L272 262 L260 276 L248 264Z M584 278 L610 240 L636 278 L622 270 L610 284 L598 272Z"
      />
      @switch (kind()) {
        @case ('mountain') {
          <path class="rock" d="M-40 600 L200 300 L320 420 L460 250 L620 400 L700 330 L840 600Z" />
          <path
            class="snow"
            d="M168 340 L200 300 L232 340 L216 332 L200 348 L184 334Z M420 300 L460 250 L500 300 L482 290 L462 310 L442 292Z M680 352 L700 330 L720 352 L708 348 L700 356 L692 348Z"
          />
        }
        @case ('peak') {
          <path class="rock" d="M60 600 L400 190 L740 600Z" />
          <path
            class="snow"
            d="M334 270 L400 190 L466 270 L440 258 L418 284 L398 262 L376 286 L356 262Z"
          />
          <path class="cross" d="M400 150 V192 M386 164 H414" />
        }
        @case ('alp') {
          <path class="pasture" d="M-20 460 Q200 330 420 420 T820 380 L820 600 L-20 600Z" />
        }
      }
      <path class="hill" d="M0 450 Q160 390 330 440 T660 430 T800 420 L800 600 L0 600Z" />
      @if (kind() === 'tower') {
        <g class="tower">
          <rect class="tower__wall" x="560" y="250" width="72" height="210" />
          <path class="roof" d="M548 254 L596 168 L644 254Z" />
          <path class="flagpole" d="M596 168 V140" />
          <path class="pennant" d="M596 140 L618 147 L596 154Z" />
          <circle class="clock" cx="596" cy="296" r="24" />
          <path class="clock__hands" d="M596 296 V280 M596 296 H610" />
          <rect class="window" x="584" y="350" width="24" height="30" rx="12" />
          <rect class="door" x="580" y="410" width="32" height="50" rx="16" />
        </g>
      }
      @if (river()) {
        <path class="water" d="M0 490 Q400 465 800 490 L800 560 Q400 530 0 560Z" />
        <path
          class="wave"
          d="M90 520 q18 -9 36 0 M300 505 q18 -9 36 0 M520 512 q18 -9 36 0 M680 525 q18 -9 36 0"
        />
      }
      <path class="hill2" d="M0 540 Q200 500 400 535 T800 525 L800 600 L0 600Z" />
      @switch (kind()) {
        @case ('bay') {
          <path class="sand" d="M0 575 Q400 545 800 575 L800 600 L0 600Z" />
          <path class="sail" d="M560 470 L560 412 L600 470Z" />
          <path class="hull" d="M540 474 H620 L606 490 H554Z" />
          <path class="sail sail--red" d="M210 500 L210 462 L236 500Z" />
          <path class="hull" d="M198 503 H250 L241 513 H207Z" />
        }
        @case ('bridge') {
          <path class="bridge" d="M210 525 Q400 405 590 525" />
          <path
            class="bridge-rail"
            d="M210 505 Q400 385 590 505 M260 478 V502 M320 452 V478 M400 442 V466 M480 452 V478 M540 478 V502"
          />
        }
        @case ('brook') {
          <path class="stream" d="M-10 600 C120 540 260 600 400 552 S640 500 810 520" />
          <path class="wave" d="M120 568 q14 -7 28 0 M380 560 q14 -7 28 0 M620 518 q14 -7 28 0" />
        }
        @case ('workshop') {
          <circle class="gear" cx="560" cy="400" r="22" />
          <g class="logs">
            <circle cx="740" cy="560" r="12" />
            <circle cx="764" cy="560" r="12" />
            <circle cx="752" cy="539" r="12" />
          </g>
        }
        @case ('hut') {
          <g class="smoke">
            <circle cx="676" cy="356" r="8" />
            <circle cx="686" cy="334" r="11" />
            <circle cx="680" cy="304" r="14" />
          </g>
        }
        @case ('market') {
          <path class="bunting" d="M60 330 Q400 400 740 330" />
          @for (flag of bunting; track $index) {
            <path class="bunting__flag" [class.bunting__flag--alt]="$odd" [attr.d]="flag" />
          }
        }
      }
      @for (prop of props(); track $index) {
        <g [attr.transform]="prop.transform">
          @switch (prop.kind) {
            @case ('fir') {
              <rect class="trunk" x="-5" y="-16" width="10" height="16" />
              <path class="fir" d="M0 -96 L30 -54 L16 -54 L38 -16 L-38 -16 L-16 -54 L-30 -54Z" />
            }
            @case ('tree') {
              <rect class="trunk" x="-5" y="-34" width="10" height="34" />
              <circle class="leaf" cx="0" cy="-58" r="30" />
              <circle class="leaf" cx="-20" cy="-44" r="18" />
              <circle class="leaf" cx="20" cy="-46" r="20" />
            }
            @case ('bush') {
              <circle class="leaf" cx="-14" cy="-12" r="14" />
              <circle class="leaf" cx="12" cy="-12" r="16" />
              <circle class="leaf" cx="0" cy="-22" r="16" />
            }
            @case ('stone') {
              <ellipse class="rock" cx="0" cy="-8" rx="20" ry="12" />
            }
            @case ('flower') {
              <path class="stem" d="M0 0 V-16" />
              <g [attr.fill]="prop.color">
                <circle cx="-5" cy="-20" r="5" />
                <circle cx="5" cy="-20" r="5" />
                <circle cx="0" cy="-26" r="5" />
                <circle cx="0" cy="-14" r="5" />
              </g>
              <circle class="flower__center" cx="0" cy="-20" r="3" />
            }
            @case ('chalet') {
              <rect class="wall" x="-44" y="-62" width="88" height="62" />
              <rect class="roof" x="20" y="-100" width="12" height="28" />
              <path class="roof" d="M-58 -56 L0 -104 L58 -56Z" />
              <rect class="door" x="-12" y="-36" width="24" height="36" />
              <rect class="window" x="-34" y="-50" width="14" height="14" />
              <rect class="window" x="20" y="-50" width="14" height="14" />
            }
            @case ('cow') {
              <rect class="cow__leg" x="-26" y="-20" width="7" height="20" />
              <rect class="cow__leg" x="-12" y="-20" width="7" height="20" />
              <rect class="cow__leg" x="10" y="-20" width="7" height="20" />
              <rect class="cow__leg" x="22" y="-20" width="7" height="20" />
              <ellipse class="cow" cx="0" cy="-36" rx="36" ry="20" />
              <ellipse class="cow__spot" cx="-12" cy="-40" rx="11" ry="8" />
              <ellipse class="cow__spot" cx="16" cy="-30" rx="8" ry="6" />
              <path class="cow__horn" d="M34 -58 l-5 -9 M46 -58 l5 -9" />
              <ellipse class="cow" cx="40" cy="-48" rx="14" ry="12" />
              <ellipse class="cow__muzzle" cx="48" cy="-42" rx="8" ry="6" />
              <circle class="bell" cx="32" cy="-30" r="5" />
            }
            @case ('stall') {
              <rect class="wood" x="-56" y="-84" width="7" height="84" />
              <rect class="wood" x="49" y="-84" width="7" height="84" />
              <rect class="wood" x="-60" y="-38" width="120" height="14" />
              <rect class="awning" x="-66" y="-104" width="132" height="22" />
              @for (offset of pickets; track offset) {
                <rect class="awning__stripe" [attr.x]="offset" y="-104" width="14" height="22" />
              }
              <circle class="fruit" cx="-38" cy="-45" r="8" />
              <circle class="fruit" cx="-22" cy="-45" r="8" />
              <circle class="fruit" cx="-30" cy="-57" r="8" />
              <circle class="fruit fruit--yellow" cx="14" cy="-45" r="8" />
              <circle class="fruit fruit--yellow" cx="30" cy="-45" r="8" />
              <circle class="fruit fruit--green" cx="22" cy="-57" r="8" />
            }
            @case ('fence') {
              @for (offset of pickets; track offset) {
                <rect class="wood" [attr.x]="offset" y="-40" width="10" height="40" rx="3" />
              }
              <rect class="wood" x="-66" y="-30" width="132" height="6" />
              <rect class="wood" x="-66" y="-14" width="132" height="6" />
            }
          }
        </g>
      }
    </svg>
  `,
  styleUrl: './scene.scss',
})
export class SceneView {
  readonly scene = input.required<string>();

  protected readonly kind = computed<Scene>(() =>
    (SCENES as readonly string[]).includes(this.scene()) ? (this.scene() as Scene) : 'meadow',
  );
  protected readonly river = computed(() => RIVER.has(this.kind()));
  protected readonly props = computed(() =>
    PROPS[this.kind()].map((prop) => {
      const scale = prop.scale ?? 1;
      return {
        kind: prop.kind,
        color: prop.color,
        transform: `translate(${prop.x} ${prop.y}) scale(${prop.flip ? -scale : scale} ${scale})`,
      };
    }),
  );
  protected readonly pickets = PICKETS;
  protected readonly bunting = BUNTING;
}
