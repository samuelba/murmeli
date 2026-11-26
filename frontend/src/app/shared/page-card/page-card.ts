import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

@Component({
  selector: 'mu-page-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.narrow]': 'narrow()' },
  template: `
    <section class="card" [attr.aria-labelledby]="headingId()">
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      margin-inline: auto;
    }

    :host(.narrow) {
      max-width: 520px;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-4);
      padding: var(--mu-space-5) var(--mu-space-4);
      border-radius: var(--mu-radius-lg);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
    }

    @media (min-width: 600px) {
      .card {
        padding: var(--mu-space-6);
      }
    }
  `,
})
export class PageCard {
  readonly headingId = input('page-heading');
  readonly narrow = input(false, { transform: booleanAttribute });
}
