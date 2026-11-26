import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';

/** "Listen" illustration for exercises that are heard, not seen. */
@Component({
  selector: 'mu-hear-badge',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ear"><mu-icon name="speaker" /></span>
    <span class="text">{{ 'learn.ex.hear' | transloco }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-2);
      font-weight: 800;
      color: var(--mu-color-text-muted);
    }

    .ear {
      display: grid;
      place-items: center;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--mu-color-sky) 30%, var(--mu-color-surface));
      color: var(--mu-color-sky-strong);
      animation: mu-bob 2.4s ease-in-out infinite;

      mu-icon {
        width: 56px;
        height: 56px;
      }
    }
  `,
})
export class HearBadge {}
