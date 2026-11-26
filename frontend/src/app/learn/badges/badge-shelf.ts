import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Speak } from '../../shared/speak/speak';
import { BadgeIcon } from './badge-icon';
import { BADGE_IDS, BadgeId, badgeHintKey, badgeNameKey } from './badges';

export interface BadgeShelfData {
  readonly earned: readonly BadgeId[];
}

/** The kid's trophy shelf: every badge, earned ones shining, the others with how to get them. */
@Component({
  selector: 'mu-badge-shelf',
  imports: [TranslocoPipe, BadgeIcon, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-kid-mode' },
  template: `
    <div class="box" data-testid="badge-shelf">
      <div class="title-row">
        <h2 id="badge-shelf-title" class="title">{{ 'kid.badges.title' | transloco }}</h2>
        <mu-speak [text]="'kid.badges.title' | transloco" />
      </div>
      <ul class="shelf" role="list">
        @for (badge of badges(); track badge.id) {
          <li
            class="badge"
            [class.badge--earned]="badge.earned"
            [attr.data-testid]="'shelf-badge-' + badge.id"
            [attr.data-earned]="badge.earned"
          >
            <mu-badge-icon [badge]="badge.id" [earned]="badge.earned" />
            <div class="badge__text">
              <p class="badge__name">{{ badge.nameKey | transloco }}</p>
              <p class="badge__state">
                {{ (badge.earned ? 'kid.badges.earned' : 'kid.badges.notYet') | transloco }}
              </p>
              @if (!badge.earned) {
                <p class="badge__hint">{{ badge.hintKey | transloco }}</p>
              }
            </div>
            <mu-speak
              [text]="badge.nameKey | transloco"
              [segments]="[
                badge.nameKey | transloco,
                (badge.earned ? 'kid.badges.earned' : badge.hintKey) | transloco,
              ]"
            />
          </li>
        }
      </ul>
      <button
        type="button"
        class="mu-button mu-button--sun"
        data-testid="badge-shelf-close"
        cdkFocusInitial
        (click)="ref.close()"
      >
        {{ 'common.close' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      width: min(560px, calc(100vw - 32px));
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      padding: var(--mu-space-5) var(--mu-space-4);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      color: var(--mu-color-text);
      box-shadow: var(--mu-shadow-lg);
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: var(--mu-space-3);
    }

    .title {
      margin: 0;
      font-size: var(--mu-font-size-xl);
    }

    .shelf {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--mu-space-3);
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .badge {
      display: flex;
      align-items: center;
      gap: var(--mu-space-3);
      padding: var(--mu-space-3);
      border: 2px dashed var(--mu-color-border-strong);
      border-radius: var(--mu-radius-md);
      background: var(--mu-color-surface-alt);

      &--earned {
        border-style: solid;
        border-color: var(--mu-color-primary-edge);
        background: color-mix(in srgb, var(--mu-color-sun) 22%, var(--mu-color-surface));
      }
    }

    .badge__text {
      flex: 1;
      min-width: 0;
    }

    .badge__text p {
      margin: 0;
    }

    .badge__name {
      font-weight: 800;
      font-size: 1.15rem;
    }

    .badge__state {
      font-weight: 700;
    }

    .badge__hint {
      color: var(--mu-color-text-muted);
      font-size: 1rem;
    }
  `,
})
export class BadgeShelf {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly data = inject<BadgeShelfData>(DIALOG_DATA);

  protected readonly badges = computed(() => {
    const earned = new Set(this.data.earned);
    return BADGE_IDS.map((id) => ({
      id,
      earned: earned.has(id),
      nameKey: badgeNameKey(id),
      hintKey: badgeHintKey(id),
    }));
  });
}
