import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { toApiError } from '../http/api-error';
import { isApiUrl } from '../http/api-paths';
import { SKIP_PARENT_GATE_PROMPT } from '../http/http-context';
import { ParentGateService } from './parent-gate.service';

export const PARENT_GATE_REQUIRED = 'PARENT_GATE_REQUIRED';

/** The gate expired server-side mid-task: ask for the password, then retry once. */
export const parentGateInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url) || req.context.get(SKIP_PARENT_GATE_PROMPT)) {
    return next(req);
  }
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: unknown) => {
      const gateRequired =
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        toApiError(error).code === PARENT_GATE_REQUIRED;
      if (!gateRequired) {
        return throwError(() => error);
      }
      const gate = injector.get(ParentGateService);
      gate.markExpired();
      return from(gate.prompt()).pipe(
        switchMap((unlocked) => (unlocked ? next(req) : throwError(() => error))),
      );
    }),
  );
};
