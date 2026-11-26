import { HttpClient, HttpContext } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { USER, errorBody, provideAppTesting } from '../../../testing/app-testing';
import { SKIP_SESSION_REDIRECT } from '../http/http-context';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let router: Router;

  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('refreshes once for concurrent 401s and retries each request', async () => {
    const first = firstValueFrom(client.get('/api/kids'));
    const second = firstValueFrom(client.get('/api/account/export'));
    http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/account/export').flush(errorBody('UNAUTHORIZED', 401), unauthorized);

    const refresh = http.expectOne('/api/auth/refresh');
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ ok: true });

    await vi.waitFor(() => http.expectOne('/api/kids').flush([{ id: 'k1' }]));
    http.expectOne('/api/account/export').flush({ ok: 1 });
    await expect(first).resolves.toEqual([{ id: 'k1' }]);
    await expect(second).resolves.toEqual({ ok: 1 });
  });

  it('retries only once and then surfaces the error', async () => {
    const result = firstValueFrom(client.get('/api/kids'));
    http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/auth/refresh').flush({ ok: true });
    await vi.waitFor(() =>
      http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized),
    );
    await expect(result).rejects.toMatchObject({ status: 401 });
    http.expectNone('/api/auth/refresh');
  });

  it('clears the session and sends the user to /login when refresh fails', async () => {
    const auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    const result = firstValueFrom(client.get('/api/kids'));
    http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/auth/refresh').flush(errorBody('SESSION_EXPIRED', 401), unauthorized);

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it.each([
    [429, 'RATE_LIMITED'],
    [503, 'INTERNAL_ERROR'],
    [0, null],
  ])('keeps the session when refresh fails with %i', async (status, code) => {
    const auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    const result = firstValueFrom(client.get('/api/kids'));
    http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http
      .expectOne('/api/auth/refresh')
      .flush(code ? errorBody(code, status) : null, { status, statusText: 'x' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.user()).toEqual(USER);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not nest returnUrl when already on /login', async () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/login?returnUrl=%2Fparent');
    const result = firstValueFrom(client.get('/api/kids'));
    http.expectOne('/api/kids').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/auth/refresh').flush(errorBody('SESSION_EXPIRED', 401), unauthorized);
    await expect(result).rejects.toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect for quiet requests', async () => {
    const context = new HttpContext().set(SKIP_SESSION_REDIRECT, true);
    const result = firstValueFrom(client.get('/api/auth/me', { context }));
    http.expectOne('/api/auth/me').flush(errorBody('UNAUTHORIZED', 401), unauthorized);
    http.expectOne('/api/auth/refresh').flush({}, unauthorized);
    await expect(result).rejects.toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['INVALID_CREDENTIALS', 'PIN_INVALID', 'TOTP_INVALID'])(
    'passes %s through without refreshing',
    async (code) => {
      const result = firstValueFrom(client.post('/api/auth/parent-gate', {}));
      http.expectOne('/api/auth/parent-gate').flush(errorBody(code, 401), unauthorized);
      await expect(result).rejects.toMatchObject({ code });
      http.expectNone('/api/auth/refresh');
    },
  );

  it.each(['/api/auth/login', '/api/auth/refresh', '/api/invites/abc/accept'])(
    'never refreshes for %s',
    async (url) => {
      const result = firstValueFrom(client.post(url, {}));
      http.expectOne(url).flush(errorBody('UNAUTHORIZED', 401), unauthorized);
      await expect(result).rejects.toBeTruthy();
      http.expectNone('/api/auth/refresh');
    },
  );

  it('ignores other statuses and non-api urls', async () => {
    const forbidden = firstValueFrom(client.get('/api/admin/users'));
    http
      .expectOne('/api/admin/users')
      .flush(errorBody('FORBIDDEN', 403), { status: 403, statusText: 'x' });
    await expect(forbidden).rejects.toMatchObject({ status: 403 });

    const asset = firstValueFrom(client.get('/i18n/de-CH.json'));
    http.expectOne('/i18n/de-CH.json').flush(null, unauthorized);
    await expect(asset).rejects.toBeTruthy();
    http.expectNone('/api/auth/refresh');
  });
});

describe('authInterceptor with Web Locks', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'locks', {
      configurable: true,
      value: { request },
    });
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    http.verify();
    Reflect.deleteProperty(window.navigator, 'locks');
  });

  it('skips the refresh when another tab already rotated the cookies', async () => {
    const result = firstValueFrom(client.get('/api/kids'));
    http
      .expectOne('/api/kids')
      .flush(errorBody('UNAUTHORIZED', 401), { status: 401, statusText: 'x' });
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush({ user: USER }));
    http.expectNone('/api/auth/refresh');
    await vi.waitFor(() => http.expectOne('/api/kids').flush([]));
    await expect(result).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith('mu-refresh', expect.any(Function));
  });

  it('refreshes under the lock when the probe still fails', async () => {
    const result = firstValueFrom(client.get('/api/kids'));
    http
      .expectOne('/api/kids')
      .flush(errorBody('UNAUTHORIZED', 401), { status: 401, statusText: 'x' });
    await vi.waitFor(() =>
      http.expectOne('/api/auth/me').flush(errorBody('UNAUTHORIZED', 401), {
        status: 401,
        statusText: 'x',
      }),
    );
    http.expectNone('/api/auth/refresh/probe');
    await vi.waitFor(() => http.expectOne('/api/auth/refresh').flush({ ok: true }));
    await vi.waitFor(() => http.expectOne('/api/kids').flush([1]));
    await expect(result).resolves.toEqual([1]);
  });
});
