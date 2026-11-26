import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  isLoggedInMatch,
  kidGuard,
  noActiveKidGuard,
  setupGuard,
  setupPageGuard,
} from './core/auth/guards';
import { parentGateGuard } from './core/auth/parent-gate.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [isLoggedInMatch],
    canActivate: [noActiveKidGuard],
    title: 'picker.pageTitle',
    loadComponent: () =>
      import('./pages/profile-picker/profile-picker').then((m) => m.ProfilePicker),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [setupGuard],
    title: 'welcome.pageTitle',
    loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'setup',
    canActivate: [setupPageGuard],
    title: 'setup.pageTitle',
    loadComponent: () => import('./pages/setup/setup').then((m) => m.Setup),
  },
  {
    path: 'login',
    canActivate: [setupGuard, guestGuard],
    title: 'login.pageTitle',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [setupGuard, guestGuard],
    title: 'register.pageTitle',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: 'verify-email',
    title: 'verifyEmail.pageTitle',
    loadComponent: () => import('./pages/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'forgotPassword.pageTitle',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'resetPassword.pageTitle',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'invite/:token',
    canActivate: [guestGuard],
    title: 'invite.pageTitle',
    loadComponent: () => import('./pages/invite/invite').then((m) => m.Invite),
  },
  {
    path: 'privacy',
    title: 'legal.privacyTitle',
    data: { kind: 'privacy' },
    loadComponent: () => import('./pages/legal/legal').then((m) => m.Legal),
  },
  {
    path: 'terms',
    title: 'legal.termsTitle',
    data: { kind: 'terms' },
    loadComponent: () => import('./pages/legal/legal').then((m) => m.Legal),
  },
  {
    path: 'learn',
    canActivate: [authGuard, kidGuard],
    loadChildren: () => import('./learn/learn.routes').then((m) => m.LEARN_ROUTES),
  },
  {
    path: 'parent',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        canActivate: [parentGateGuard],
        loadChildren: () => import('./pages/parent/parent.routes').then((m) => m.PARENT_ROUTES),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        canActivate: [parentGateGuard],
        loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  {
    path: '**',
    title: 'notFound.pageTitle',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
