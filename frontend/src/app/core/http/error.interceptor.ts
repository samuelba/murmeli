import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { isApiUrl } from './api-paths';
import { toApiError } from './api-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApiUrl(req.url)) {
        return throwError(() => toApiError(error));
      }
      return throwError(() => error);
    }),
  );
