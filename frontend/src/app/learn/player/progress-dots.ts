import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon';
import { Outcome } from './player-store';

/** One dot per item: a check for solved items, a ring for the current one. */
@Component({
  selector: 'mu-progress-dots',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="mu-visually-hidden" data-testid="progress-text">
      {{ 'learn.player.progress' | transloco: { current: current() + 1, total: dots().length } }}
    </p>
    <ol class="dots" aria-hidden="true" data-testid="progress-dots">
      @for (dot of dots(); track $index) {
        <li class="dot" [attr.data-state]="dot">
          @if (dot === 'first' || dot === 'second') {
            <mu-icon name="check" />
          }
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .dots {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .dot {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border: 3px solid var(--mu-color-border-strong);
      border-radius: 50%;
      background: var(--mu-color-surface);

      mu-icon {
        width: 16px;
        height: 16px;
      }

      &[data-state='current'] {
        border-color: var(--mu-color-sky-strong);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mu-color-sky-strong) 35%, transparent);
        transform: scale(1.15);
      }

      &[data-state='first'],
      &[data-state='second'] {
        border-color: var(--mu-color-success);
        background: var(--mu-color-success);
        color: var(--mu-color-on-success);
      }

      &[data-state='missed'] {
        border-style: dashed;
        background: var(--mu-color-marmot-soft);
      }
    }
  `,
})
export class ProgressDots {
  readonly outcomes = input.required<readonly (Outcome | null)[]>();
  readonly current = input(0);

  protected readonly dots = computed(() =>
    this.outcomes().map(
      (outcome, index) => outcome ?? (index === this.current() ? 'current' : 'open'),
    ),
  );
}
