import {
  HttpInterceptorFn,
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor } from '../auth/auth.interceptor';
import { parentGateInterceptor } from '../auth/parent-gate.interceptor';
import { totpRequiredInterceptor } from '../auth/totp-required.interceptor';
import { credentialsInterceptor } from './credentials.interceptor';
import { errorInterceptor } from './error.interceptor';

/** Order matters: the auth and gate interceptors sit inside the error mapper so they see HttpErrorResponse. */
export const HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  credentialsInterceptor,
  errorInterceptor,
  authInterceptor,
  parentGateInterceptor,
  totpRequiredInterceptor,
];

export function provideAppHttp() {
  return provideHttpClient(withFetch(), withInterceptors([...HTTP_INTERCEPTORS]));
}
