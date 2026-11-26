import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-parent-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, FormError, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <nav class="nav" [attr.aria-label]="'parent.nav' | transloco">
        <ul role="list">
          @for (link of links(); track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: link.exact }"
                [attr.data-testid]="link.testId"
              >
                <mu-icon [name]="link.icon" />
                <span>{{ link.label | transloco }}</span>
              </a>
            </li>
          }
        </ul>
        <button type="button" class="lock" data-testid="lock-parent-area" (click)="lock()">
          <mu-icon name="lock" />
          <span>{{ 'parent.lock' | transloco }}</span>
        </button>
      </nav>
      <mu-form-error [error]="error()" />
      <router-outlet />
    </div>
  `,
  styleUrl: './parent-shell.scss',
})
export class ParentShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly links = computed(() => [
    {
      path: '/parent',
      label: 'parent.kids',
      icon: 'family' as const,
      exact: true,
      testId: 'nav-kids',
    },
    {
      path: '/parent/account',
      label: 'parent.account',
      icon: 'person' as const,
      exact: false,
      testId: 'nav-account',
    },
    ...(this.auth.isAdmin()
      ? [
          {
            path: '/admin',
            label: 'parent.admin',
            icon: 'shield' as const,
            exact: false,
            testId: 'nav-admin',
          },
        ]
      : []),
  ]);

  protected async lock(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.lockParentGate();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
