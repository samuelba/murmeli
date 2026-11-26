import { Routes } from '@angular/router';
import { ParentShell } from './shell/parent-shell';

export const PARENT_ROUTES: Routes = [
  {
    path: '',
    component: ParentShell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'parent.pageTitle',
        loadComponent: () => import('./dashboard/parent-dashboard').then((m) => m.ParentDashboard),
      },
      {
        path: 'kids/new',
        title: 'kidForm.createTitle',
        loadComponent: () => import('./kid-form/kid-form').then((m) => m.KidForm),
      },
      {
        path: 'kids/:id/progress',
        title: 'parent.progress.pageTitle',
        loadComponent: () => import('./progress/parent-progress').then((m) => m.ParentProgress),
      },
      {
        path: 'kids/:id',
        title: 'kidForm.editTitle',
        loadComponent: () => import('./kid-form/kid-form').then((m) => m.KidForm),
      },
      {
        path: 'account',
        title: 'account.title',
        loadComponent: () => import('./account/account-page').then((m) => m.AccountPage),
      },
    ],
  },
];
