import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import {
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(returnUrl: string | null = null) {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  async function fillCredentials(element: HTMLElement) {
    type(byTestId<HTMLInputElement>(element, 'login-email'), ' parent@example.com ');
    type(byTestId<HTMLInputElement>(element, 'login-password'), 'secret-password');
    submit(element);
  }

  const flushMe = () =>
    http
      .expectOne('/api/auth/me')
      .flush({ user: USER, parentGateExpiresAt: null, activeKid: null });

  it('validates the fields before sending anything', async () => {
    setup();
    const { element, fixture } = await renderComponent(Login);
    submit(element);
    await fixture.whenStable();
    http.expectNone('/api/auth/login');
    expect(element.querySelectorAll('mat-error').length).toBeGreaterThan(0);
  });

  it('signs in and follows a safe return url', async () => {
    setup('/parent/account');
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'parent@example.com', password: 'secret-password' });
    req.flush({ user: USER });
    await vi.waitFor(flushMe);
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/parent/account');
  });

  it('ignores an external return url', async () => {
    setup('//evil.example');
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    http.expectOne('/api/auth/login').flush({ user: USER });
    await vi.waitFor(flushMe);
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows invalid credentials without revealing the account', async () => {
    setup();
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    http
      .expectOne('/api/auth/login')
      .flush(errorBody('INVALID_CREDENTIALS', 401), { status: 401, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain(
      'E-Mail-Adresse oder Passwort stimmen nicht.',
    );
  });

  it('offers to resend the confirmation for unverified accounts', async () => {
    setup();
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    http
      .expectOne('/api/auth/login')
      .flush(errorBody('EMAIL_NOT_VERIFIED', 403), { status: 403, statusText: 'x' });
    await settle(fixture);
    expect(element.querySelector('a[href^="/verify-email"]')?.getAttribute('href')).toContain(
      'email=',
    );
  });

  it('asks for a TOTP code, then accepts a recovery code instead', async () => {
    setup();
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    http.expectOne('/api/auth/login').flush({ totpRequired: true });
    await settle(fixture);
    expect(byTestId(element, 'page-title').textContent).toContain('Bestätigungscode');

    type(byTestId<HTMLInputElement>(element, 'login-totp-code'), '12');
    submit(element);
    await fixture.whenStable();
    http.expectNone('/api/auth/totp/verify');

    type(byTestId<HTMLInputElement>(element, 'login-totp-code'), '123456');
    submit(element);
    http
      .expectOne('/api/auth/totp/verify')
      .flush(errorBody('TOTP_INVALID', 401), { status: 401, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('Der Code stimmt nicht');

    byTestId(element, 'login-toggle-recovery').click();
    await fixture.whenStable();
    type(byTestId<HTMLInputElement>(element, 'login-recovery-code'), ' abcd-1234 ');
    submit(element);
    const req = http.expectOne('/api/auth/totp/verify');
    expect(req.request.body).toEqual({ recoveryCode: 'abcd-1234' });
    req.flush({ user: USER });
    await vi.waitFor(flushMe);
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('goes back from the TOTP step', async () => {
    setup();
    const { element, fixture } = await renderComponent(Login);
    await fillCredentials(element);
    http.expectOne('/api/auth/login').flush({ totpRequired: true });
    await settle(fixture);
    const back = [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Zurück'),
    );
    back?.click();
    await fixture.whenStable();
    expect(byTestId(element, 'login-email')).toBeTruthy();
  });
});
