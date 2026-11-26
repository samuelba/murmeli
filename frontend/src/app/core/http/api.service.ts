import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './api-paths';

type QueryParams = Record<
  string,
  string | number | boolean | readonly (string | number | boolean)[]
>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(apiUrl(path), { params: this.toParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(apiUrl(path), body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(apiUrl(path), body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(apiUrl(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(apiUrl(path));
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    return params ? new HttpParams({ fromObject: params }) : undefined;
  }
}
