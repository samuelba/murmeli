import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { SkillRow } from './progress-view';

/** Every practiced skill with its confidence as a labeled bar, weakest first. */
@Component({
  selector: 'mu-progress-skills',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="skills-title" data-testid="progress-skills">
      <h2 class="section-title" id="skills-title">
        {{ 'parent.progress.skills.title' | transloco }}
      </h2>
      @if (weak().length > 0) {
        <div class="weak" data-testid="weak-skills">
          <mu-icon name="warning" />
          <div>
            <p class="weak__title">{{ 'parent.progress.skills.weakTitle' | transloco }}</p>
            <p>{{ 'parent.progress.skills.weakHint' | transloco }}</p>
          </div>
        </div>
      }
      @if (rows().length === 0) {
        <p class="mu-muted" data-testid="skills-empty">
          {{ 'parent.progress.skills.empty' | transloco }}
        </p>
      } @else {
        <ul class="skills" role="list">
          @for (row of rows(); track row.skill.id) {
            <li
              class="skill"
              [class.skill--weak]="row.weak"
              [attr.data-level]="row.level"
              [attr.data-testid]="'skill-' + row.skill.id"
            >
              <div class="skill__head">
                <span class="skill__title">{{ row.skill.title }}</span>
                @if (row.weak) {
                  <span class="tag tag--weak" data-testid="skill-weak">
                    <mu-icon name="warning" />
                    {{ 'parent.progress.skills.needsPractice' | transloco }}
                  </span>
                }
              </div>
              <div class="meter" aria-hidden="true">
                <span class="meter__fill" [style.width.%]="row.percent"></span>
              </div>
              <p class="skill__meta">
                <span class="skill__mastery" data-testid="skill-mastery">
                  {{ 'parent.progress.skills.mastery' | transloco: { percent: row.percent } }}
                  · {{ 'parent.progress.skills.level.' + row.level | transloco }}
                </span>
                <span class="skill__review">
                  @if (row.due) {
                    {{ 'parent.progress.skills.due' | transloco }}
                  } @else if (row.nextReview) {
                    {{ 'parent.progress.skills.nextReview' | transloco: { date: row.nextReview } }}
                  }
                </span>
              </p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styleUrls: ['./progress-panel.scss', './progress-skills.scss'],
})
export class ProgressSkills {
  readonly rows = input.required<readonly SkillRow[]>();

  protected readonly weak = computed(() => this.rows().filter((row) => row.weak));
}
