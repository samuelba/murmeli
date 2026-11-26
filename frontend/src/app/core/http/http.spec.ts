import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiUrl, isApiUrl } from './api-paths';
import { errorCodeOf, isApiError, toApiError } from './api-error';
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

    it('drops empty query params and sends DELETE bodies', async () => {
      const api = TestBed.inject(ApiService);
      const list = firstValueFrom(api.get('items', { q: '', page: 1, x: undefined }));
      http.expectOne('/api/items?page=1').flush([]);
      await list;
      const removed = firstValueFrom(api.delete('account', { password: 'pw' }));
      const req = http.expectOne('/api/account');
      expect(req.request.body).toEqual({ password: 'pw' });
      req.flush(null);
      await removed;
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
      await expect(result).rejects.toMatchObject({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Slow down',
        retryAfterSeconds: null,
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

    it('reads Retry-After, field details and the request id', () => {
      const error = toApiError(
        new HttpErrorResponse({
          status: 400,
          error: {
            errorCode: 'VALIDATION_FAILED',
            message: 'Validation failed',
            requestId: 'req-1',
            details: [
              { field: 'email', constraints: ['isEmail'], messages: ['email must be an email'] },
              { nope: true },
            ],
          },
          headers: new HttpHeaders({ 'Retry-After': '12' }),
        }),
      );
      expect(error.retryAfterSeconds).toBe(12);
      expect(error.requestId).toBe('req-1');
      expect(error.details).toEqual([
        { field: 'email', constraints: ['isEmail'], messages: ['email must be an email'] },
      ]);
    });

    it('parses an HTTP-date Retry-After and ignores garbage', () => {
      const future = new Date(Date.now() + 90_000).toUTCString();
      const dated = toApiError(
        new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': future }) }),
      );
      const garbage = toApiError(
        new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': 'soon' }) }),
      );
      expect(dated.retryAfterSeconds).toBeGreaterThan(80);
      expect(garbage.retryAfterSeconds).toBeNull();
    });

    it('extracts error codes from either error shape', () => {
      const http = new HttpErrorResponse({ status: 401, error: { errorCode: 'PIN_INVALID' } });
      expect(errorCodeOf(http)).toBe('PIN_INVALID');
      expect(errorCodeOf(toApiError(http))).toBe('PIN_INVALID');
      expect(errorCodeOf(new Error('x'))).toBeNull();
    });

    it('rejects values that are not ApiErrors', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError({ status: '500', message: 'x' })).toBe(false);
    });
  });
});
