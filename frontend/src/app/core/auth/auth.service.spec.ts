import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../i18n/language.service';
import { KID, USER, errorBody, provideAppTesting } from '../../../testing/app-testing';
import { resetDocumentState, stubNavigatorLanguages } from '../../../testing/browser';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    stubNavigatorLanguages(['de-CH']);
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
    vi.useRealTimers();
  });

  const future = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const flushMe = (body: object) => http.expectOne('/api/auth/me').flush(body);
  const until = (check: () => void) => vi.waitFor(check);

  it('loads config and session on init', async () => {
    const init = auth.init();
    http
      .expectOne('/api/auth/config')
      .flush({ registrationEnabled: true, emailEnabled: false, setupRequired: false });
    flushMe({ user: USER, parentGateExpiresAt: future(10), activeKid: KID });
    await init;

    expect(auth.user()).toEqual(USER);
    expect(auth.activeKid()).toEqual(KID);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.hasParentGate()).toBe(true);
    expect(auth.config()?.registrationEnabled).toBe(true);
  });

  it('tolerates a 401 from /auth/me and a failing config', async () => {
    const init = auth.init();
    http.expectOne('/api/auth/config').flush(null, { status: 500, statusText: 'x' });
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'x' });
    http.expectNone('/api/auth/refresh');
    await init;
    expect(auth.user()).toBeNull();
  });

  it('treats a failing /auth/me after 401 + failed refresh as signed out without redirect', async () => {
    const refresh = auth.refreshSession();
    http.expectOne('/api/auth/me').flush(errorBody('UNAUTHORIZED', 401), {
      status: 401,
      statusText: 'Unauthorized',
    });
    await until(() =>
      http.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'x' }),
    );
    await expect(refresh).resolves.toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('caches the config unless forced', async () => {
    const first = auth.loadConfig();
    http.expectOne('/api/auth/config').flush({ registrationEnabled: false });
    await first;
    await auth.loadConfig();
    http.expectNone('/api/auth/config');
    const forced = auth.loadConfig(true);
    http.expectOne('/api/auth/config').flush({ registrationEnabled: true });
    await expect(forced).resolves.toEqual({ registrationEnabled: true });
  });

  it('signs in and loads the session', async () => {
    const login = auth.login('parent@example.com', 'secret-password');
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'parent@example.com', password: 'secret-password' });
    req.flush({ user: { ...USER, locale: 'en-US' } });
    await until(() =>
      flushMe({
        user: { ...USER, locale: 'en-US' },
        parentGateExpiresAt: future(10),
        activeKid: null,
      }),
    );

    await expect(login).resolves.toBe('signed-in');
    expect(auth.user()?.locale).toBe('en-US');
    expect(auth.hasParentGate()).toBe(true);
  });

  it('keeps the user when /auth/me fails right after sign-in', async () => {
    const login = auth.login('a@b.ch', 'pw');
    http.expectOne('/api/auth/login').flush({ user: USER });
    await until(() => http.expectOne('/api/auth/me').flush(null, { status: 500, statusText: 'x' }));
    await login;
    expect(auth.user()).toEqual(USER);
  });

  it('reports a required TOTP step and verifies it', async () => {
    const login = auth.login('a@b.ch', 'pw');
    http.expectOne('/api/auth/login').flush({ totpRequired: true });
    await expect(login).resolves.toBe('totp-required');

    const verify = auth.verifyTotp({ recoveryCode: 'abcd-efgh' });
    const req = http.expectOne('/api/auth/totp/verify');
    expect(req.request.body).toEqual({ recoveryCode: 'abcd-efgh' });
    req.flush({ user: USER });
    await until(() => flushMe({ user: USER, parentGateExpiresAt: null, activeKid: null }));
    await verify;
    expect(auth.user()).toEqual(USER);
  });

  it('creates the first admin and clears setupRequired', async () => {
    const config = auth.loadConfig();
    http.expectOne('/api/auth/config').flush({ setupRequired: true, registrationEnabled: false });
    await config;
    const setup = auth.setup({ email: 'a@b.ch', password: 'long-password', locale: 'de-CH' });
    http.expectOne('/api/auth/setup').flush({ user: { ...USER, role: 'admin' } });
    await until(() =>
      flushMe({ user: { ...USER, role: 'admin' }, parentGateExpiresAt: null, activeKid: null }),
    );
    await setup;
    expect(auth.config()?.setupRequired).toBe(false);
    expect(auth.isAdmin()).toBe(true);
  });

  it('loads and accepts invites', async () => {
    const details = auth.inviteDetails('tok/en');
    http
      .expectOne('/api/invites/tok%2Fen')
      .flush({ email: 'x@y.ch', role: 'parent', expiresAt: future(60) });
    await expect(details).resolves.toMatchObject({ email: 'x@y.ch' });

    const accept = auth.acceptInvite('tok', 'long-password', 'en-US');
    const req = http.expectOne('/api/invites/tok/accept');
    expect(req.request.body).toEqual({
      password: 'long-password',
      locale: 'en-US',
      acceptTerms: true,
    });
    req.flush({ user: USER });
    await until(() => flushMe({ user: USER, parentGateExpiresAt: null, activeKid: null }));
    await accept;
  });

  it('unlocks, expires and locks the parent gate', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const unlock = auth.unlockParentGate('pw');
    http.expectOne('/api/auth/parent-gate').flush({ parentGateExpiresAt: future(10) });
    await unlock;
    expect(auth.hasParentGateNow()).toBe(true);

    vi.advanceTimersByTime(10 * 60_000 + 100);
    expect(auth.hasParentGate()).toBe(false);

    const again = auth.unlockParentGate('pw');
    http.expectOne('/api/auth/parent-gate').flush({ parentGateExpiresAt: future(10) });
    await again;
    const lock = auth.lockParentGate();
    http.expectOne('/api/auth/parent-gate/lock').flush(null);
    await lock;
    expect(auth.hasParentGate()).toBe(false);
  });

  it('drops the gate when a kid profile becomes active', async () => {
    const refresh = auth.refreshSession();
    flushMe({
      user: { ...USER, locale: 'de-CH' },
      parentGateExpiresAt: future(5),
      activeKid: null,
    });
    await refresh;

    auth.setActiveKid({ ...KID, language: 'en-US' });
    expect(auth.activeKid()?.language).toBe('en-US');
    expect(auth.hasParentGate()).toBe(false);

    auth.setActiveKid(null);
    expect(auth.activeKid()).toBeNull();
  });

  it('retries a failed logout once and keeps the session when both attempts fail', async () => {
    auth.setUser(USER);
    const logout = auth.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'x' });
    await vi.waitFor(() =>
      http.expectOne('/api/auth/logout').flush(null, { status: 0, statusText: '' }),
    );
    await expect(logout).rejects.toMatchObject({ status: 0 });
    expect(auth.user()).toEqual(USER);
  });

  it('clears the session after a successful retry or a 401', async () => {
    auth.setUser(USER);
    const retried = auth.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 502, statusText: 'x' });
    await vi.waitFor(() => http.expectOne('/api/auth/logout').flush(null));
    await retried;
    expect(auth.user()).toBeNull();

    auth.setUser(USER);
    const expired = auth.logout();
    http.expectOne('/api/auth/logout').flush(errorBody('UNAUTHORIZED', 401), {
      status: 401,
      statusText: 'x',
    });
    await expired;
    expect(auth.user()).toBeNull();
  });

  it('resets to the remembered language on clear', async () => {
    const language = TestBed.inject(LanguageService);
    language.setLanguage('de-CH');
    const refresh = auth.refreshSession();
    flushMe({ user: USER, parentGateExpiresAt: null, activeKid: { ...KID, language: 'en-US' } });
    await refresh;
    language.useLanguage('en-US');

    auth.clear();
    expect(language.language()).toBe('de-CH');
  });

  it('keeps the session on a transient /auth/me failure', async () => {
    auth.setUser(USER);
    const refresh = auth.refreshSession();
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'x' });
    await expect(refresh).resolves.toBe(false);
    expect(auth.user()).toEqual(USER);
  });

  it('ignores an invalid gate timestamp and marks the gate expired', async () => {
    const refresh = auth.refreshSession();
    flushMe({ user: USER, parentGateExpiresAt: 'not-a-date', activeKid: null });
    await refresh;
    expect(auth.parentGateExpiresAt()).toBeNull();
    auth.markParentGateExpired();
    expect(auth.hasParentGate()).toBe(false);
  });
});
