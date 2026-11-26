import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon';
import type { MapLevel } from '../learn.models';

/** A yellow Swiss hiking signpost for one level: number, stars, and its state. */
@Component({
  selector: 'mu-signpost',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-state]': 'level().state' },
  template: `
    <button
      type="button"
      class="post"
      [class.post--left]="pointsLeft()"
      [class.post--shake]="shaking()"
      [attr.aria-disabled]="locked() ? 'true' : null"
      [attr.aria-label]="
        ('learn.map.level' | transloco: { number: number(), title: level().title }) +
        ', ' +
        ('learn.map.state.' + level().state | transloco: { stars: level().stars })
      "
      [attr.data-testid]="'level-' + level().id"
      [attr.data-state]="level().state"
      (click)="open()"
    >
      <span class="plaque">
        @if (locked()) {
          <mu-icon name="lock" />
        } @else {
          <span class="number">{{ number() }}</span>
        }
        @if (level().state === 'skipped') {
          <span class="check"><mu-icon name="check" /></span>
        }
      </span>
      <span class="pole" aria-hidden="true"></span>
      <span class="stars" aria-hidden="true">
        @for (slot of [0, 1, 2]; track slot) {
          <svg viewBox="0 0 24 24" [class.on]="slot < level().stars">
            <path
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            />
          </svg>
        }
      </span>
    </button>
  `,
  styleUrl: './signpost.scss',
})
export class Signpost {
  readonly level = input.required<MapLevel>();
  readonly number = input.required<number>();
  readonly pointsLeft = input(false);
  readonly opened = output<string>();
  /** A tap on a locked level, so the map can answer with a sound and a word. */
  readonly blocked = output<string>();

  protected readonly shaking = signal(false);
  private shakeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.shakeTimer));
  }

  protected readonly locked = computed(() => this.level().state === 'locked');

  protected open(): void {
    if (!this.locked()) {
      this.opened.emit(this.level().id);
      return;
    }
    clearTimeout(this.shakeTimer);
    this.shaking.set(true);
    this.shakeTimer = setTimeout(() => this.shaking.set(false), 600);
    this.blocked.emit(this.level().id);
  }
}
