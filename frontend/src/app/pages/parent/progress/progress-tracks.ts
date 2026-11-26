import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ParentProgressTrack, ParentProgressWorld } from './parent-progress.types';

/** Track → world → level, each world collapsible, with stars and state as text. */
@Component({
  selector: 'mu-progress-tracks',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="tracks-title" data-testid="progress-tracks">
      <h2 class="section-title" id="tracks-title">
        {{ 'parent.progress.tracks.title' | transloco }}
      </h2>
      @for (track of tracks(); track track.id) {
        <div class="track" [attr.data-testid]="'progress-track-' + track.id">
          <h3 class="track__title">{{ track.title }}</h3>
          @for (world of track.worlds; track world.id) {
            <details
              class="world"
              [attr.data-state]="world.state"
              [attr.data-testid]="'progress-world-' + world.id"
              [open]="world.state === 'unlocked'"
            >
              <summary class="world__summary">
                <span class="world__title">{{ world.title }}</span>
                <span class="world__meta">
                  <span>{{ 'kid.class.' + world.grade | transloco }}</span>
                  <span>{{ 'parent.progress.state.' + world.state | transloco }}</span>
                  <span>
                    {{
                      'parent.progress.tracks.levels'
                        | transloco: { passed: passedLevels(world), total: world.levels.length }
                    }}
                  </span>
                  <span>
                    {{
                      'parent.progress.tracks.stars'
                        | transloco: { stars: world.stars, max: world.maxStars }
                    }}
                  </span>
                </span>
              </summary>
              <ol class="levels">
                @for (level of world.levels; track level.id; let i = $index) {
                  <li
                    class="level"
                    [attr.data-state]="level.state"
                    [attr.data-testid]="'progress-level-' + level.id"
                  >
                    <span class="level__number" aria-hidden="true">{{ i + 1 }}</span>
                    <span class="level__title">{{ level.title }}</span>
                    <span
                      class="stars"
                      role="img"
                      [attr.aria-label]="
                        'parent.progress.tracks.levelStars' | transloco: { stars: level.stars }
                      "
                    >
                      @for (slot of [0, 1, 2]; track slot) {
                        <svg viewBox="0 0 24 24" aria-hidden="true" [class.on]="slot < level.stars">
                          <path
                            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
                          />
                        </svg>
                      }
                    </span>
                    <span class="level__state">
                      {{ 'parent.progress.state.' + level.state | transloco }}
                      @if (level.runs > 0) {
                        · {{ 'parent.progress.tracks.runs' | transloco: { count: level.runs } }}
                      }
                    </span>
                  </li>
                }
              </ol>
            </details>
          }
        </div>
      }
    </section>
  `,
  styleUrls: ['./progress-panel.scss', './progress-tracks.scss'],
})
export class ProgressTracks {
  readonly tracks = input.required<readonly ParentProgressTrack[]>();

  protected passedLevels(world: ParentProgressWorld): number {
    return world.levels.filter((level) => level.state === 'passed').length;
  }
}
