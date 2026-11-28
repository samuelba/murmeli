import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Kid } from '../../../core/api/models';
import { BRAND_NAME } from '../../../core/brand';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { LanguageService } from '../../../core/i18n/language.service';
import { KidsService } from '../../../core/kids/kids.service';
import { AvatarView } from '../../../shared/avatar/avatar';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { ActivityChartView } from './activity-chart';
import { ProgressPractice } from './progress-practice';
import { ProgressSkills } from './progress-skills';
import { ProgressTracks } from './progress-tracks';
import { ParentProgressService } from './parent-progress.service';
import type { ParentProgressResponse } from './parent-progress.types';
import { practiceRows } from './practice-view';
import { activityChart, skillRows, summarize } from './progress-view';

type State = 'loading' | 'ready' | 'error';

/** `/parent/kids/:id/progress`: stars, time, skills and badges of one kid, for the parents. */
@Component({
  selector: 'mu-parent-progress',
  imports: [
    RouterLink,
    TranslocoPipe,
    ActivityChartView,
    AvatarView,
    FormError,
    Icon,
    ProgressPractice,
    ProgressSkills,
    ProgressTracks,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-progress.html',
  styleUrls: ['./progress-panel.scss', './parent-progress.scss'],
})
export class ParentProgress {
  private readonly kids = inject(KidsService);
  private readonly api = inject(ParentProgressService);
  private readonly language = inject(LanguageService).language;

  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly state = signal<State>('loading');
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly kid = signal<Kid | null>(null);
  protected readonly progress = signal<ParentProgressResponse | null>(null);

  protected readonly summary = computed(() => {
    const progress = this.progress();
    return progress ? summarize(progress.tracks, progress.activity) : null;
  });
  protected readonly minutesChart = computed(() =>
    activityChart(this.progress()?.activity ?? [], 'minutes', this.language()),
  );
  protected readonly runsChart = computed(() =>
    activityChart(this.progress()?.activity ?? [], 'runs', this.language()),
  );
  protected readonly skills = computed(() => {
    const progress = this.progress();
    return progress ? skillRows(progress, this.language()) : [];
  });
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly practiceTopics = computed(() =>
    practiceRows(this.progress()?.practice, this.language()),
  );
  protected readonly hasActivity = computed(() => (this.summary()?.runs ?? 0) > 0);
  private readonly dateFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.language(), { day: 'numeric', month: 'long', year: 'numeric' }),
  );

  constructor() {
    queueMicrotask(() => void this.load());
  }

  async load(): Promise<void> {
    this.state.set('loading');
    this.error.set(null);
    try {
      const [kid, progress] = await Promise.all([this.kids.get(this.id), this.api.forKid(this.id)]);
      if (!kid) {
        this.error.set({ key: 'errors.KID_NOT_FOUND' });
        this.state.set('error');
        return;
      }
      this.kid.set(kid);
      this.progress.set(progress);
      this.state.set('ready');
    } catch (error) {
      this.error.set(errorMessage(error));
      this.state.set('error');
    }
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : this.dateFormat().format(date);
  }
}
