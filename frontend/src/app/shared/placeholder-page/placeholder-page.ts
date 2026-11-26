import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mu-placeholder-page',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" [attr.aria-labelledby]="headingId">
      <h1 [id]="headingId" data-testid="page-title">{{ titleKey() | transloco }}</h1>
      <p>{{ messageKey() | transloco }}</p>
      <a class="mu-button mu-button--primary" routerLink="/" data-testid="back-home">
        {{ 'common.backHome' | transloco }}
      </a>
    </section>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--mu-space-4);
      padding: var(--mu-space-6) var(--mu-space-5);
      border-radius: var(--mu-radius-lg);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
    }

    h1 {
      margin: 0;
      font-size: var(--mu-font-size-xl);
      color: var(--mu-color-meadow-strong);
    }

    p {
      margin: 0;
      color: var(--mu-color-text-muted);
    }
  `,
})
export class PlaceholderPage {
  readonly titleKey = input.required<string>();
  readonly messageKey = input('common.comingSoon');

  protected readonly headingId = 'page-heading';
}
