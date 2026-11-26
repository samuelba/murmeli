import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './api-paths';

type QueryValue = string | number | boolean | readonly (string | number | boolean)[];
export type QueryParams = Record<string, QueryValue | undefined>;

export interface RequestOptions {
  readonly context?: HttpContext;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams, options: RequestOptions = {}): Observable<T> {
    return this.http.get<T>(apiUrl(path), { params: this.toParams(params), ...options });
  }

  post<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(apiUrl(path), body, options);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(apiUrl(path), body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(apiUrl(path), body);
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.http.delete<T>(apiUrl(path), body === undefined ? {} : { body });
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }
    const defined = Object.fromEntries(
      Object.entries(params).filter(
        (entry): entry is [string, QueryValue] => entry[1] !== '' && entry[1] !== undefined,
      ),
    );
    return new HttpParams({ fromObject: defined });
  }
}
