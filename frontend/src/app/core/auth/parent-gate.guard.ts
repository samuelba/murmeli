import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ParentGateService } from './parent-gate.service';

export const parentGateGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const gate = inject(ParentGateService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.hasParentGateNow()) {
    return true;
  }
  if (auth.parentGateExpiresAt() !== null) {
    await auth.refreshSession();
    if (auth.hasParentGateNow()) {
      return true;
    }
  }
  return (await gate.prompt()) || router.createUrlTree(['/']);
};
