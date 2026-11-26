import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminStats as Stats } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { FormError } from '../../../shared/form-error/form-error';

@Component({
  selector: 'mu-admin-stats',
  imports: [TranslocoPipe, FormError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-form-error [error]="error()" />
    @if (stats(); as data) {
      <ul class="cards" role="list" data-testid="admin-stats">
        @for (card of cards; track card) {
          <li class="card">
            <span class="value">{{ data[card] }}</span>
            <span class="label">{{ 'admin.stats.' + card | transloco }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--mu-space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-1);
      padding: var(--mu-space-5);
      border-radius: var(--mu-radius-lg);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
    }

    .value {
      font-size: var(--mu-font-size-xl);
      font-weight: 900;
      color: var(--mu-color-sky-strong);
    }
  `,
})
export class AdminStatsPage implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly cards = ['users', 'kids', 'activeKidsLast7Days'] as const;
  protected readonly stats = signal<Stats | null>(null);
  protected readonly error = signal<ErrorMessage | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.stats.set(await this.admin.stats());
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
