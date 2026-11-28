import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { SafeStorage } from '../../core/storage/safe-storage';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';
import { LearnApi } from '../learn-api.service';
import { PracticeCatalogResponse, PracticeTopicView, PracticeTrackView } from '../learn.models';
import { hasModifier } from '../map/keys';
import { TopicGlyph } from './topic-glyph';

export const PRACTICE_TRACK_STORAGE_KEY = 'mu-practice-track';

/** The step meter shows at most this many segments; longer ladders show a bar. */
const MAX_SEGMENTS = 6;

/** `/learn/practice`: pick a topic to practice, or let Murmeli pick a mix. */
@Component({
  selector: 'mu-practice-ground',
  imports: [TranslocoPipe, FormError, Icon, Mascot, Speak, TopicGlyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './practice-ground.html',
  styleUrls: ['./practice-ground.scss', './practice-topics.scss'],
})
export class PracticeGround {
  private readonly api = inject(LearnApi);
  private readonly router = inject(Router);
  private readonly storage = inject(SafeStorage);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly audio = inject(AudioService);
  private readonly effects = inject(SoundEffects);
  private readonly transloco = inject(TranslocoService);
  private readonly kid = inject(AuthService).activeKid;
  private readonly injector = inject(Injector);

  protected readonly catalog = signal<PracticeCatalogResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ErrorMessage | null>(null);
  /** Why the last tap did not start anything, shown and announced (`kid.practice.*`). */
  protected readonly blocked = signal<string | null>(null);
  private readonly trackKey = `${PRACTICE_TRACK_STORAGE_KEY}:${this.kid()?.id ?? ''}`;
  private readonly chosenTrack = signal<string | null>(this.storage.get(this.trackKey));

  protected readonly tracks = computed(() =>
    (this.catalog()?.tracks ?? []).filter((track) => track.topics.length > 0),
  );
  protected readonly track = computed<PracticeTrackView | null>(() => {
    const tracks = this.tracks();
    return tracks.find((track) => track.id === this.chosenTrack()) ?? tracks[0] ?? null;
  });
  protected readonly mix = computed(() => this.catalog()?.mix ?? null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.catalog.set(await this.api.practiceCatalog());
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('#page-heading')
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  protected open(topic: PracticeTopicView): void {
    if (topic.state === 'locked') {
      this.block('kid.practice.locked');
      return;
    }
    void this.router.navigate(['/learn/practice', topic.id]);
  }

  protected startMix(): void {
    if (!this.mix()?.available) {
      this.block('kid.practice.mixLocked');
      return;
    }
    void this.router.navigateByUrl('/learn/practice/mix');
  }

  protected toMap(): void {
    void this.router.navigateByUrl('/learn');
  }

  protected chooseTrack(id: string): void {
    this.blocked.set(null);
    this.chosenTrack.set(id);
    this.storage.set(this.trackKey, id);
  }

  protected onTabKey(event: KeyboardEvent, index: number): void {
    const tracks = this.tracks();
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tracks.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined || tracks.length < 2 || hasModifier(event)) {
      return;
    }
    event.preventDefault();
    const next = tracks[(target + tracks.length) % tracks.length]!;
    this.chooseTrack(next.id);
    this.host.nativeElement
      .querySelector<HTMLElement>(`#${CSS.escape(`practice-tab-${next.id}`)}`)
      ?.focus();
  }

  /** "Stufe 3 von 6" as segments, or a filled share for long ladders. */
  protected segments(topic: PracticeTopicView): readonly boolean[] {
    const max = Math.max(1, topic.maxLevel);
    return max > MAX_SEGMENTS ? [] : Array.from({ length: max }, (_, index) => index < topic.level);
  }

  protected share(topic: PracticeTopicView): number {
    return topic.maxLevel > 0 ? Math.min(100, (topic.level / topic.maxLevel) * 100) : 0;
  }

  private block(key: string): void {
    this.blocked.set(key);
    this.effects.play('locked');
    this.audio.speak(this.transloco.translate(key));
  }
}
