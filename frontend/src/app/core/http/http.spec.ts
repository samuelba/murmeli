import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiUrl, isApiUrl } from './api-paths';
import { isApiError, toApiError } from './api-error';
import { ApiService } from './api.service';
import { provideAppHttp } from './provide-http';

describe('core http', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppHttp(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('api paths', () => {
    it('builds /api urls', () => {
      expect(apiUrl('health')).toBe('/api/health');
      expect(apiUrl('/kids/1')).toBe('/api/kids/1');
    });

    it('detects api urls', () => {
      expect(isApiUrl('/api')).toBe(true);
      expect(isApiUrl('/api/health')).toBe(true);
      expect(isApiUrl('/apis')).toBe(false);
      expect(isApiUrl('/i18n/de-CH.json')).toBe(false);
    });
  });

  describe('ApiService', () => {
    it.each([
      ['get', 'GET'],
      ['delete', 'DELETE'],
    ] as const)('%s sends %s to /api with credentials', async (method, verb) => {
      const result = firstValueFrom(TestBed.inject(ApiService)[method]<{ ok: boolean }>('items'));
      const req = http.expectOne('/api/items');
      expect(req.request.method).toBe(verb);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ ok: true });
      await expect(result).resolves.toEqual({ ok: true });
    });

    it.each([
      ['post', 'POST'],
      ['put', 'PUT'],
      ['patch', 'PATCH'],
    ] as const)('%s sends a JSON body with %s', async (method, verb) => {
      const result = firstValueFrom(TestBed.inject(ApiService)[method]('items', { a: 1 }));
      const req = http.expectOne('/api/items');
      expect(req.request.method).toBe(verb);
      expect(req.request.body).toEqual({ a: 1 });
      req.flush({});
      await result;
    });

    it('encodes query params', async () => {
      const result = firstValueFrom(TestBed.inject(ApiService).get('items', { page: 2, q: 'a' }));
      http.expectOne('/api/items?page=2&q=a').flush([]);
      await expect(result).resolves.toEqual([]);
    });
  });

  describe('interceptors', () => {
    it('leaves non-api requests without credentials', async () => {
      const result = firstValueFrom(TestBed.inject(HttpClient).get('/i18n/de-CH.json'));
      const req = http.expectOne('/i18n/de-CH.json');
      expect(req.request.withCredentials).toBe(false);
      req.flush({});
      await result;
    });

    it('maps api failures to ApiError', async () => {
      const result = firstValueFrom(TestBed.inject(ApiService).get('items'));
      http
        .expectOne('/api/items')
        .flush(
          { errorCode: 'RATE_LIMITED', message: 'Slow down' },
          { status: 429, statusText: 'Too Many' },
        );
      await expect(result).rejects.toEqual({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Slow down',
      });
    });

    it('passes non-api failures through unchanged', async () => {
      const result = firstValueFrom(TestBed.inject(HttpClient).get('/i18n/xx.json'));
      http.expectOne('/i18n/xx.json').flush(null, { status: 404, statusText: 'Not Found' });
      await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    });
  });

  describe('toApiError', () => {
    it('falls back to the HTTP message when the body is not JSON', () => {
      const error = toApiError(
        new HttpErrorResponse({
          status: 502,
          statusText: 'Bad Gateway',
          error: 'oops',
          url: '/api/x',
        }),
      );
      expect(error.status).toBe(502);
      expect(error.code).toBeNull();
      expect(error.message).toContain('502');
      expect(isApiError(error)).toBe(true);
    });

    it('rejects values that are not ApiErrors', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError({ status: '500', message: 'x' })).toBe(false);
    });
  });
});
