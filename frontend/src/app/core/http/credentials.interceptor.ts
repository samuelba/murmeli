import { HttpInterceptorFn } from '@angular/common/http';
import { isApiUrl } from './api-paths';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(isApiUrl(req.url) ? req.clone({ withCredentials: true }) : req);
