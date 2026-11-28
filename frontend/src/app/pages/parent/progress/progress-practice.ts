import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { BRAND_NAME } from '../../../core/brand';
import type { ParentPracticeDay } from './parent-progress.types';
import { PracticeTopicRow, missesKey, practiceSummary, recentKey, totalKey } from './practice-view';

/** The practice ground: per topic the step, the first-try share and the open mistakes. */
@Component({
  selector: 'mu-progress-practice',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="practice-title" data-testid="progress-practice">
      <h2 class="section-title" id="practice-title">
        {{ 'parent.progress.practice.title' | transloco }}
      </h2>
      @if (rows().length === 0) {
        <p class="mu-muted" data-testid="practice-empty">
          {{ 'parent.progress.practice.empty' | transloco }}
        </p>
      } @else {
        <div class="summary">
          <h3 class="summary__title">{{ 'parent.progress.practice.recentTitle' | transloco }}</h3>
          <dl class="summary__stats" data-testid="practice-summary">
            <div class="stat">
              <dt>{{ 'parent.progress.practice.recentItems' | transloco }}</dt>
              <dd data-testid="practice-items">{{ summary().items }}</dd>
            </div>
            <div class="stat">
              <dt>{{ 'parent.progress.practice.recentFirstTry' | transloco }}</dt>
              <dd data-testid="practice-first-try">
                @if (summary().percent !== null) {
                  {{
                    'parent.progress.practice.percent' | transloco: { percent: summary().percent }
                  }}
                } @else {
                  {{ 'parent.progress.practice.noPercent' | transloco }}
                }
              </dd>
            </div>
            <div class="stat">
              <dt>{{ 'parent.progress.practice.recentDays' | transloco }}</dt>
              <dd data-testid="practice-days">{{ summary().activeDays }}</dd>
            </div>
          </dl>
        </div>
        <ul class="topics" role="list">
          @for (row of rows(); track row.topic.id) {
            <li
              class="topic"
              [attr.data-state]="row.topic.state"
              [attr.data-testid]="'practice-topic-' + row.topic.id"
            >
              <div class="topic__head">
                <span class="topic__title">{{ row.topic.title }}</span>
                @if (row.topic.state !== 'open') {
                  <span class="tag" data-testid="practice-state">
                    {{ 'parent.progress.practice.state.' + row.topic.state | transloco }}
                  </span>
                }
              </div>
              <div class="meter" aria-hidden="true">
                <span class="meter__fill" [style.width.%]="row.levelPercent"></span>
              </div>
              <p class="topic__level" data-testid="practice-level">
                {{
                  'parent.progress.practice.level'
                    | transloco: { level: row.topic.level, max: row.topic.maxLevel }
                }}
                <span class="mu-muted">
                  ·
                  {{ 'parent.progress.practice.levels' | transloco: { levels: row.topic.levels } }}
                </span>
              </p>
              <p class="topic__line" data-testid="practice-recent">
                @if (row.recentPercent !== null) {
                  {{
                    recentKey(row.topic.recentItems)
                      | transloco: { items: row.topic.recentItems, percent: row.recentPercent }
                  }}
                } @else {
                  {{ 'parent.progress.practice.recentNone' | transloco }}
                }
              </p>
              @if (row.topic.items > 0) {
                <p class="topic__line">
                  {{
                    totalKey(row.topic.items, row.topic.runs)
                      | transloco: { items: row.topic.items, runs: row.topic.runs }
                  }}
                </p>
              }
              <p class="topic__line mu-muted">
                @if (row.lastPracticed) {
                  {{
                    'parent.progress.practice.lastPracticed'
                      | transloco: { date: row.lastPracticed }
                  }}
                } @else {
                  {{ 'parent.progress.practice.never' | transloco }}
                }
              </p>
              @if (row.topic.openMistakes > 0) {
                <details class="mistakes" data-testid="practice-mistakes">
                  <summary>
                    <mu-icon name="refresh" />
                    {{
                      'parent.progress.practice.mistakes'
                        | transloco: { count: row.topic.openMistakes }
                    }}
                  </summary>
                  <p class="mu-muted">
                    {{ 'parent.progress.practice.mistakesHint' | transloco: brand }}
                  </p>
                  <ul class="mistakes__list" role="list">
                    @for (mistake of row.topic.mistakes; track $index) {
                      <li class="mistake" data-testid="practice-mistake">
                        <span class="mistake__text">
                          {{ mistake.question }}
                          @if (mistake.answer !== null) {
                            <span aria-hidden="true">→</span>
                            <span class="mu-visually-hidden">{{
                              'parent.progress.practice.answerLabel' | transloco
                            }}</span>
                            {{ mistake.answer }}
                          }
                        </span>
                        <span class="mu-muted">
                          <span aria-hidden="true">{{
                            'parent.progress.practice.misses' | transloco: { count: mistake.misses }
                          }}</span>
                          <span class="mu-visually-hidden">{{
                            missesKey(mistake.misses) | transloco: { count: mistake.misses }
                          }}</span>
                        </span>
                      </li>
                    }
                  </ul>
                </details>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styleUrls: ['./progress-panel.scss', './progress-practice.scss'],
})
export class ProgressPractice {
  readonly rows = input.required<readonly PracticeTopicRow[]>();
  readonly days = input<readonly ParentPracticeDay[]>([]);

  protected readonly summary = computed(() => practiceSummary(this.days()));
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly recentKey = recentKey;
  protected readonly totalKey = totalKey;
  protected readonly missesKey = missesKey;
}
