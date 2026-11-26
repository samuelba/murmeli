import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mu-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-stack">
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'admin.title' | transloco }}
      </h1>
      <nav class="tabs" [attr.aria-label]="'admin.nav' | transloco">
        <ul role="list">
          @for (link of links; track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: link.exact }"
                [attr.data-testid]="'admin-nav-' + link.key"
              >
                {{ 'admin.nav_' + link.key | transloco }}
              </a>
            </li>
          }
        </ul>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .tabs ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mu-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tabs a {
      display: inline-flex;
      align-items: center;
      min-height: var(--mu-touch-adult);
      padding: 0 var(--mu-space-4);
      border-radius: var(--mu-radius-pill);
      border: 2px solid var(--mu-color-border);
      background: var(--mu-color-surface);
      color: var(--mu-color-text);
      font-weight: 700;
      text-decoration: none;
    }

    .tabs a.active {
      border-color: var(--mu-color-secondary);
      background: var(--mu-color-secondary);
      color: var(--mu-color-on-secondary);
    }
  `,
})
export class AdminShell {
  protected readonly links = [
    { key: 'overview', path: '/admin', exact: true },
    { key: 'users', path: '/admin/users', exact: false },
    { key: 'invites', path: '/admin/invites', exact: false },
    { key: 'settings', path: '/admin/settings', exact: false },
    { key: 'audit', path: '/admin/audit-log', exact: false },
  ];
}
