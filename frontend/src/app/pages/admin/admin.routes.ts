import { Routes } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslatedPaginatorIntl } from './paginator-intl';
import { AdminShell } from './shell/admin-shell';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShell,
    providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'admin.title',
        loadComponent: () => import('./stats/admin-stats').then((m) => m.AdminStatsPage),
      },
      {
        path: 'users',
        title: 'admin.nav_users',
        loadComponent: () => import('./users/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'invites',
        title: 'admin.nav_invites',
        loadComponent: () => import('./invites/admin-invites').then((m) => m.AdminInvites),
      },
      {
        path: 'settings',
        title: 'admin.nav_settings',
        loadComponent: () => import('./settings/admin-settings').then((m) => m.AdminSettingsPage),
      },
      {
        path: 'audit-log',
        title: 'admin.nav_audit',
        loadComponent: () => import('./audit/admin-audit').then((m) => m.AdminAudit),
      },
    ],
  },
];
