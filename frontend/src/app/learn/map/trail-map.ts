import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { KidsService } from '../../core/kids/kids.service';
import { SafeStorage } from '../../core/storage/safe-storage';
import { AvatarView } from '../../shared/avatar/avatar';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';
import { LearnApi } from '../learn-api.service';
import { MapResponse, MapTrack } from '../learn.models';
import { SceneView } from './scene';
import { Signpost } from './signpost';
import { currentLevelId, placeLevels, trailHeight, trailPath, worldComplete } from './trail-layout';

export const TRACK_STORAGE_KEY = 'mu-learn-track';

/** `/learn`: the Alpine trail per track, from the valley (first world) up to the summit. */
@Component({
  selector: 'mu-trail-map',
  imports: [TranslocoPipe, AvatarView, FormError, Icon, Mascot, SceneView, Signpost, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trail-map.html',
  styleUrl: './trail-map.scss',
})
export class TrailMap {
  private readonly api = inject(LearnApi);
  private readonly kids = inject(KidsService);
  private readonly router = inject(Router);
  private readonly storage = inject(SafeStorage);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private scrolledTo: string | null = null;

  protected readonly kid = inject(AuthService).activeKid;
  protected readonly map = signal<MapResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ErrorMessage | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  private readonly audio = inject(AudioService);
  private readonly effects = inject(SoundEffects);
  private readonly transloco = inject(TranslocoService);
  private readonly trackKey = `${TRACK_STORAGE_KEY}:${this.kid()?.id ?? ''}`;
  private readonly chosenTrack = signal<string | null>(this.storage.get(this.trackKey));

  protected readonly tracks = computed(() => this.map()?.tracks ?? []);
  protected readonly track = computed<MapTrack | null>(() => {
    const tracks = this.tracks();
    return tracks.find((track) => track.id === this.chosenTrack()) ?? tracks[0] ?? null;
  });
  protected readonly current = computed(() => currentLevelId(this.track()));
  protected readonly worlds = computed(() =>
    (this.track()?.worlds ?? []).map((world, index) => {
      const levels = placeLevels(world.levels, index);
      const height = trailHeight(world.levels.length);
      return {
        world,
        levels,
        height,
        path: trailPath(levels, height),
        complete: worldComplete(world),
      };
    }),
  );

  constructor() {
    void this.load();
    afterRenderEffect(() => {
      const current = this.current();
      if (current && current !== untracked(() => this.scrolledTo)) {
        untracked(() => this.scrollTo(current));
      }
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.map.set(await this.api.map());
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected chooseTrack(id: string): void {
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
    if (target === undefined || tracks.length < 2) {
      return;
    }
    event.preventDefault();
    const next = tracks[(target + tracks.length) % tracks.length]!;
    this.chooseTrack(next.id);
    this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(`tab-${next.id}`)}`)?.focus();
  }

  protected locked(): void {
    this.effects.play('locked');
    this.audio.speak(this.transloco.translate('kid.navigation.locked'));
  }

  protected play(levelId: string): void {
    void this.router.navigate(['/learn/level', levelId]);
  }

  protected practice(): void {
    void this.router.navigateByUrl('/learn/practice');
  }

  protected async switchProfile(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.kids.deactivate();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  private scrollTo(levelId: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(
      `[data-testid="level-${CSS.escape(levelId)}"]`,
    );
    if (!target) {
      return;
    }
    this.scrolledTo = levelId;
    const reduce = this.document.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    target.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
}
