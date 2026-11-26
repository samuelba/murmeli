import { HttpTestingController } from '@angular/common/http/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { KID, USER, provideAppTesting } from '../../../testing/app-testing';
import { AuthService } from './auth.service';
import {
  adminGuard,
  authGuard,
  guestGuard,
  isLoggedInMatch,
  kidGuard,
  noActiveKidGuard,
  setupGuard,
  setupPageGuard,
} from './guards';
import { parentGateGuard } from './parent-gate.guard';
import { ParentGateService } from './parent-gate.service';
import { safeReturnUrl } from './return-url';

describe('route guards', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let prompt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prompt = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: ParentGateService, useValue: { prompt } }],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function run(guard: CanActivateFn, url = '/x') {
    return runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  const serialize = (result: unknown) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  async function signIn(
    parentGateExpiresAt: string | null = null,
    activeKid = null as typeof KID | null,
  ) {
    const refresh = auth.refreshSession();
    http.expectOne('/api/auth/me').flush({ user: USER, parentGateExpiresAt, activeKid });
    await refresh;
  }

  it('authGuard sends guests to /login with a return url', async () => {
    expect(serialize(run(authGuard, '/parent'))).toBe('/login?returnUrl=%2Fparent');
    await signIn();
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard keeps signed-in users away from guest pages', async () => {
    expect(run(guestGuard)).toBe(true);
    await signIn();
    expect(serialize(run(guestGuard))).toBe('/');
  });

  it('isLoggedInMatch follows the session', async () => {
    const match = () =>
      runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
        isLoggedInMatch({} as never, [], {} as never),
      );
    expect(match()).toBe(false);
    await signIn();
    expect(match()).toBe(true);
  });

  it('setupGuard redirects to /setup while setup is required', async () => {
    const result = run(setupGuard) as Promise<unknown>;
    http.expectOne('/api/auth/config').flush({ setupRequired: true });
    expect(serialize(await result)).toBe('/setup');
  });

  it('setupGuard lets the page load when the config is unavailable', async () => {
    const result = run(setupGuard) as Promise<unknown>;
    http.expectOne('/api/auth/config').flush(null, { status: 502, statusText: 'x' });
    expect(await result).toBe(true);
  });

  it('setupPageGuard only allows /setup while setup is required', async () => {
    const open = run(setupPageGuard) as Promise<unknown>;
    http.expectOne('/api/auth/config').flush({ setupRequired: true });
    expect(await open).toBe(true);

    const closed = run(setupPageGuard) as Promise<unknown>;
    http.expectOne('/api/auth/config').flush({ setupRequired: false });
    expect(serialize(await closed)).toBe('/login');
  });

  it('adminGuard requires the admin role', () => {
    expect(serialize(run(adminGuard))).toBe('/');
    auth.setUser({ ...USER, role: 'admin' });
    expect(run(adminGuard)).toBe(true);
  });

  it('kidGuard and noActiveKidGuard follow the active kid', async () => {
    expect(serialize(run(kidGuard))).toBe('/');
    expect(run(noActiveKidGuard)).toBe(true);
    await signIn(null, KID);
    expect(run(kidGuard)).toBe(true);
    expect(serialize(run(noActiveKidGuard))).toBe('/learn');
  });

  describe('parentGateGuard', () => {
    const future = () => new Date(Date.now() + 60_000).toISOString();
    const past = () => new Date(Date.now() - 1_000).toISOString();

    it('sends guests to /login', async () => {
      expect(serialize(await run(parentGateGuard))).toBe('/login');
    });

    it('passes while the gate is open', async () => {
      await signIn(future());
      expect(await run(parentGateGuard)).toBe(true);
      expect(prompt).not.toHaveBeenCalled();
    });

    it('rechecks the server when the local gate expired (it renews on use)', async () => {
      await signIn(past());
      const result = run(parentGateGuard) as Promise<unknown>;
      await vi.waitFor(() =>
        http
          .expectOne('/api/auth/me')
          .flush({ user: USER, parentGateExpiresAt: future(), activeKid: null }),
      );
      expect(await result).toBe(true);
      expect(prompt).not.toHaveBeenCalled();
    });

    it('asks for the password and continues on success', async () => {
      await signIn();
      expect(await run(parentGateGuard)).toBe(true);
      expect(prompt).toHaveBeenCalled();
    });

    it('goes back to the profile picker when the parent cancels', async () => {
      prompt.mockResolvedValue(false);
      await signIn(past());
      const result = run(parentGateGuard) as Promise<unknown>;
      await vi.waitFor(() =>
        http
          .expectOne('/api/auth/me')
          .flush({ user: USER, parentGateExpiresAt: null, activeKid: null }),
      );
      expect(serialize(await result)).toBe('/');
    });
  });

  it.each([
    [null, '/'],
    ['', '/'],
    ['/parent?x=1', '/parent?x=1'],
    ['//evil.example', '/'],
    ['/\\evil', '/'],
    ['https://evil.example', '/'],
  ])('safeReturnUrl(%j) is %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
