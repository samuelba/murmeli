import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { BadgeIcon } from '../badges/badge-icon';
import { BadgeShelf, BadgeShelfData } from '../badges/badge-shelf';
import { KidBadges } from '../badges/kid-badges.service';
import { LearnApi } from '../learn-api.service';
import { prefersReducedMotion } from '../exercises/shared/motion';
import { MapResponse, MapTrack } from '../learn.models';
import { currentLevelId, currentWorldIndex, layoutWorld } from './trail-layout';
import { hasModifier } from './keys';
import { WorldStrip } from './world-strip';
import { SlideDirection, WorldTrail } from './world-trail';

export const TRACK_STORAGE_KEY = 'mu-learn-track';
export const WORLD_QUERY_PARAM = 'world';
/** The width a trail is laid out for until the page has been measured. */
const DEFAULT_WIDTH = 720;
const SWIPE_DISTANCE = 80;
/** A tap that ends a swipe must not also open the signpost under the finger. */
const SWIPE_CLICK_GUARD_MS = 500;

/** `/learn`: one world of a track at a time, with a strip of all its worlds to move between. */
@Component({
  selector: 'mu-trail-map',
  imports: [
    TranslocoPipe,
    AvatarView,
    BadgeIcon,
    FormError,
    Icon,
    Mascot,
    Speak,
    WorldStrip,
    WorldTrail,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trail-map.html',
  styleUrl: './trail-map.scss',
})
export class TrailMap {
  private readonly api = inject(LearnApi);
  private readonly kids = inject(KidsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(SafeStorage);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly audio = inject(AudioService);
  private readonly effects = inject(SoundEffects);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(Dialog);
  private readonly kidBadges = inject(KidBadges);
  private scrolledTo: string | null = null;
  private swipeStart: { x: number; y: number; pointer: number } | null = null;
  private swipedAt = Number.NEGATIVE_INFINITY;

  protected readonly kid = inject(AuthService).activeKid;
  protected readonly map = signal<MapResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<ErrorMessage | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly direction = signal<SlideDirection | null>(null);
  /** Read out by screen readers when the kid moves to another world. */
  protected readonly announcement = signal('');
  private readonly width = signal(DEFAULT_WIDTH);
  private readonly trackKey = `${TRACK_STORAGE_KEY}:${this.kid()?.id ?? ''}`;
  private readonly chosenTrack = signal<string | null>(this.storage.get(this.trackKey));
  private readonly chosenWorld = signal<string | null>(
    this.route.snapshot.queryParamMap.get(WORLD_QUERY_PARAM),
  );

  protected readonly tracks = computed(() => this.map()?.tracks ?? []);
  protected readonly track = computed<MapTrack | null>(() => {
    const tracks = this.tracks();
    return tracks.find((track) => track.id === this.chosenTrack()) ?? tracks[0] ?? null;
  });
  protected readonly badges = computed(() => {
    const map = this.map();
    const kid = this.kid();
    return map && kid ? this.kidBadges.earned(kid.id, map) : [];
  });
  protected readonly current = computed(() => currentLevelId(this.track()));
  protected readonly currentWorld = computed(() => currentWorldIndex(this.track()));
  protected readonly view = computed(() => {
    const track = this.track();
    const worlds = track?.worlds ?? [];
    const chosen = worlds.findIndex((world) => world.id === this.chosenWorld());
    const index = chosen >= 0 ? chosen : this.currentWorld();
    const world = worlds[index];
    if (!track || !world) {
      return null;
    }
    return {
      track,
      world,
      index,
      last: worlds.length - 1,
      layout: layoutWorld(world, this.width()),
    };
  });

  constructor() {
    void this.load();
    afterNextRender(() => this.observeWidth());
    afterRenderEffect(() => {
      const view = this.view();
      if (!view) {
        return;
      }
      const current = this.current();
      const here = view.world.levels.some((level) => level.id === current);
      if (current && here && current !== untracked(() => this.scrolledTo)) {
        untracked(() => this.scrollTo(current));
      }
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const map = await this.api.map();
      const owner = map.tracks.find((track) =>
        track.worlds.some((world) => world.id === this.chosenWorld()),
      );
      if (owner) {
        this.chosenTrack.set(owner.id);
      }
      this.map.set(map);
    } catch (error) {
      this.loadError.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected chooseTrack(id: string): void {
    if (id === this.track()?.id) {
      return;
    }
    this.chosenTrack.set(id);
    this.storage.set(this.trackKey, id);
    this.direction.set(null);
    if (this.chosenWorld() !== null) {
      this.chosenWorld.set(null);
      this.syncUrl(null);
    }
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
    this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(`tab-${next.id}`)}`)?.focus();
  }

  protected goTo(index: number): void {
    const view = this.view();
    const world = view?.track.worlds[index];
    if (!view || !world || index === view.index) {
      return;
    }
    this.direction.set(index > view.index ? 'next' : 'previous');
    this.chosenWorld.set(world.id);
    this.syncUrl(world.id);
    this.announcement.set(
      this.transloco.translate('learn.map.world', {
        title: world.title,
        state: this.transloco.translate(`learn.map.worldState.${world.state}`),
      }),
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.isPrimary === false || event.pointerType === 'mouse') {
      return;
    }
    this.swipeStart = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    const view = this.view();
    if (!start || !view || start.pointer !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 1.5 * Math.abs(dy)) {
      return;
    }
    this.swipedAt = performance.now();
    this.goTo(view.index + (dx < 0 ? 1 : -1));
  }

  protected onPointerCancel(): void {
    this.swipeStart = null;
  }

  protected locked(): void {
    if (this.justSwiped()) {
      return;
    }
    this.effects.play('locked');
    this.audio.speak(this.transloco.translate('kid.navigation.locked'));
  }

  protected play(levelId: string): void {
    if (this.justSwiped()) {
      return;
    }
    void this.router.navigate(['/learn/level', levelId]);
  }

  protected openBadges(): void {
    this.dialog.open<void, BadgeShelfData>(BadgeShelf, {
      data: { earned: this.badges() },
      ariaLabelledBy: 'badge-shelf-title',
      backdropClass: 'mu-dialog-backdrop',
      autoFocus: 'first-tabbable',
    });
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

  private justSwiped(): boolean {
    return performance.now() - this.swipedAt < SWIPE_CLICK_GUARD_MS;
  }

  private syncUrl(worldId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [WORLD_QUERY_PARAM]: worldId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private observeWidth(): void {
    const host = this.host.nativeElement;
    if (host.clientWidth > 0) {
      this.width.set(host.clientWidth);
    }
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) {
        this.width.set(entry.contentRect.width);
      }
    });
    observer.observe(host);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private scrollTo(levelId: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(
      `[data-testid="level-${CSS.escape(levelId)}"]`,
    );
    if (!target) {
      return;
    }
    this.scrolledTo = levelId;
    target.scrollIntoView?.({
      block: 'nearest',
      behavior: prefersReducedMotion(this.document) ? 'auto' : 'smooth',
    });
  }
}
