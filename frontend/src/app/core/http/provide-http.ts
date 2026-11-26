import {
  HttpInterceptorFn,
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { credentialsInterceptor } from './credentials.interceptor';
import { errorInterceptor } from './error.interceptor';

export const HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  credentialsInterceptor,
  errorInterceptor,
];

export function provideAppHttp() {
  return provideHttpClient(withFetch(), withInterceptors([...HTTP_INTERCEPTORS]));
}
