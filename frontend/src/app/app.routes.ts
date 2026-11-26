import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'welcome.pageTitle',
    loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'login',
    title: 'login.pageTitle',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'register.pageTitle',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: '**',
    title: 'notFound.pageTitle',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
