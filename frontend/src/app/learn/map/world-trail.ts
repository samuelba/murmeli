import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mascot } from '../../shared/mascot/mascot';
import type { MapWorld } from '../learn.models';
import { SceneView } from './scene';
import { Signpost } from './signpost';
import { WorldLayout, worldComplete } from './trail-layout';

export type SlideDirection = 'next' | 'previous';

/** One world's landscape with its trail of signposts, sliding in from the side it came from. */
@Component({
  selector: 'mu-world-trail',
  imports: [TranslocoPipe, Mascot, SceneView, Signpost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-state]': 'world().state' },
  template: `
    @for (slide of [world()]; track slide.id) {
      <div class="slide" [attr.data-from]="from()">
        <mu-scene [scene]="slide.scene" />
        <svg
          class="path"
          aria-hidden="true"
          preserveAspectRatio="none"
          [attr.viewBox]="'0 0 100 ' + layout().height"
        >
          <path class="path__bed" [attr.d]="layout().path" />
          <path class="path__dash" [attr.d]="layout().path" />
        </svg>
        @if (complete(slide)) {
          <span
            class="summit"
            role="img"
            [style.left.%]="layout().summitX"
            [attr.aria-label]="'learn.map.summit' | transloco"
            [attr.data-testid]="'summit-' + slide.id"
          >
            <svg viewBox="0 0 48 64" aria-hidden="true">
              <rect x="6" y="4" width="5" height="58" rx="2" fill="#6b4a2b" />
              <path d="M11 6 H44 L36 18 L44 30 H11Z" fill="#e5322d" />
              <path
                d="M24 12 L26 16.5 L31 17 L27.2 20.2 L28.4 25 L24 22.4 L19.6 25 L20.8 20.2 L17 17 L22 16.5Z"
                fill="#fff"
              />
            </svg>
          </span>
        }
        <ol class="levels">
          @for (placed of layout().levels; track placed.level.id) {
            <li>
              <mu-signpost
                [style.left.%]="placed.x"
                [style.top.px]="placed.y"
                [level]="placed.level"
                [number]="placed.number"
                [pointsLeft]="placed.pointsLeft"
                (opened)="opened.emit($event)"
                (blocked)="blocked.emit($event)"
              />
              @if (placed.level.id === current()) {
                <mu-mascot
                  class="here"
                  pose="happy"
                  data-testid="map-mascot"
                  [class.here--left]="placed.openLeft"
                  [style.left.%]="placed.x"
                  [style.top.px]="placed.y"
                />
              }
            </li>
          }
        </ol>
      </div>
    }
  `,
  styleUrl: './world-trail.scss',
})
export class WorldTrail {
  readonly world = input.required<MapWorld>();
  readonly layout = input.required<WorldLayout>();
  /** The level to play next, where Murmeli waits. */
  readonly current = input<string | null>(null);
  /** The side the world slides in from; none when the map opens. */
  readonly from = input<SlideDirection | null>(null);
  readonly opened = output<string>();
  readonly blocked = output<string>();

  protected complete(world: MapWorld): boolean {
    return worldComplete(world);
  }
}
