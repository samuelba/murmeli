import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const isLoggedInMatch: CanMatchFn = () => inject(AuthService).isLoggedIn();

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isLoggedIn() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/']);

export const setupGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const config = await auth.loadConfig().catch(() => null);
  return config?.setupRequired ? router.createUrlTree(['/setup']) : true;
};

export const setupPageGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const config = await auth.loadConfig(true).catch(() => null);
  return config?.setupRequired === true || router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/']);

export const kidGuard: CanActivateFn = () =>
  inject(AuthService).activeKid() !== null || inject(Router).createUrlTree(['/']);

export const noActiveKidGuard: CanActivateFn = () =>
  inject(AuthService).activeKid() === null || inject(Router).createUrlTree(['/learn']);
