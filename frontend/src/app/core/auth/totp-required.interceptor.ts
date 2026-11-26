import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../http/api-error';
import { isApiUrl } from '../http/api-paths';

export const ACCOUNT_URL = '/parent/account';
export const TOTP_REQUIRED_NOTICE = 'totp-required';

/** Admins without TOTP (when requireAdminTotp is on) are sent to the TOTP setup with a notice. */
export const totpRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) {
    return next(req);
  }
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        toApiError(error).code === 'TOTP_REQUIRED'
      ) {
        const router = injector.get(Router);
        if (!router.url.startsWith(ACCOUNT_URL)) {
          router
            .navigate([ACCOUNT_URL], {
              queryParams: { notice: TOTP_REQUIRED_NOTICE },
              fragment: 'totp',
            })
            .catch(() => false);
        }
      }
      return throwError(() => error);
    }),
  );
};
