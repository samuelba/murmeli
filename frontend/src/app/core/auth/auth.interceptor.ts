import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { isApiError, toApiError } from '../http/api-error';
import { API_PREFIX, isApiUrl } from '../http/api-paths';
import { SKIP_AUTH_REFRESH, SKIP_SESSION_REDIRECT } from '../http/http-context';
import { AuthService } from './auth.service';
import { SessionRefresher } from './session-refresher';

const NO_REFRESH_PATHS = [
  'auth/login',
  'auth/refresh',
  'auth/logout',
  'auth/setup',
  'auth/register',
  'auth/totp/verify',
  'auth/config',
  'auth/altcha',
  'auth/forgot-password',
  'auth/reset-password',
  'auth/verify-email',
  'auth/resend-verification',
].map((path) => `${API_PREFIX}/${path}`);

/** 401s that mean "wrong secret", not "session expired". */
const CREDENTIAL_ERRORS = new Set(['INVALID_CREDENTIALS', 'PIN_INVALID', 'TOTP_INVALID']);

function canRefresh(req: HttpRequest<unknown>): boolean {
  const path = req.url.split('?')[0];
  return (
    isApiUrl(path) &&
    !req.context.get(SKIP_AUTH_REFRESH) &&
    !NO_REFRESH_PATHS.includes(path) &&
    !path.startsWith(`${API_PREFIX}/invites/`)
  );
}

/** Only a 401 from /auth/refresh ends the session; 429, 5xx and network errors are transient. */
function sessionLost(refreshError: unknown): boolean {
  const status =
    refreshError instanceof HttpErrorResponse || isApiError(refreshError)
      ? refreshError.status
      : null;
  return status === 401;
}

function isExpiredSession(error: unknown): error is HttpErrorResponse {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    !CREDENTIAL_ERRORS.has(toApiError(error).code ?? '')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!canRefresh(req)) {
    return next(req);
  }
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!isExpiredSession(error)) {
        return throwError(() => error);
      }
      return injector
        .get(SessionRefresher)
        .refresh()
        .pipe(
          catchError((refreshError: unknown) => {
            if (sessionLost(refreshError)) {
              injector.get(AuthService).clear();
              redirectToLogin(injector.get(Router), req);
            }
            return throwError(() => error);
          }),
          switchMap(() => next(req)),
        );
    }),
  );
};

function redirectToLogin(router: Router, req: HttpRequest<unknown>): void {
  if (req.context.get(SKIP_SESSION_REDIRECT) || router.url.startsWith('/login')) {
    return;
  }
  router.navigate(['/login'], { queryParams: { returnUrl: router.url } }).catch(() => false);
}
