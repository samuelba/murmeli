import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { ALTCHA_LOADER } from '../../shared/altcha/altcha-loader';
import {
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../testing/app-testing';
import { Register } from './register';

describe('Register', () => {
  let http: HttpTestingController;

  async function setup(registrationEnabled: boolean) {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: ALTCHA_LOADER, useValue: () => Promise.resolve() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const config = TestBed.inject(AuthService).loadConfig();
    http
      .expectOne('/api/auth/config')
      .flush({ registrationEnabled, emailEnabled: true, setupRequired: false });
    await config;
    const result = await renderComponent(Register);
    await settle(result.fixture);
    return result;
  }

  afterEach(() => http.verify());

  function fill(element: HTMLElement) {
    type(byTestId<HTMLInputElement>(element, 'register-email'), 'new@example.com');
    type(byTestId<HTMLInputElement>(element, 'new-password'), 'a long password 42');
    type(byTestId<HTMLInputElement>(element, 'new-password-confirm'), 'a long password 42');
    byTestId(element, 'register-terms').querySelector('input')?.click();
  }

  function verifyAltcha(element: HTMLElement, payload: string | null = 'payload') {
    element.querySelector('altcha-widget')?.dispatchEvent(
      new CustomEvent('statechange', {
        detail: { state: payload ? 'verified' : 'error', payload },
      }),
    );
  }

  it('explains that registration is closed', async () => {
    const { element } = await setup(false);
    expect(byTestId(element, 'registration-closed').textContent).toContain('Einladung');
    expect(element.querySelector('form')).toBeNull();
  });

  it('requires consent and a solved ALTCHA', async () => {
    const { element, fixture } = await setup(true);
    type(byTestId<HTMLInputElement>(element, 'register-email'), 'new@example.com');
    submit(element);
    await fixture.whenStable();
    expect(element.textContent).toContain('Bitte bestätige die Datenschutzerklärung');
    expect(element.textContent).toContain('Bitte bestätige zuerst, dass du ein Mensch bist.');
    http.expectNone('/api/auth/register');
  });

  it('registers and shows the inbox hint', async () => {
    const { element, fixture } = await setup(true);
    fill(element);
    verifyAltcha(element);
    submit(element);
    const req = http.expectOne('/api/auth/register');
    expect(req.request.body).toEqual({
      email: 'new@example.com',
      password: 'a long password 42',
      locale: 'de-CH',
      acceptTerms: true,
      altcha: 'payload',
    });
    req.flush({ ok: true }, { status: 202, statusText: 'Accepted' });
    await settle(fixture);
    expect(byTestId(element, 'register-done').textContent).toContain('new@example.com');
  });

  it('maps server errors and resets the ALTCHA', async () => {
    const { element, fixture } = await setup(true);
    fill(element);
    verifyAltcha(element);
    submit(element);
    http.expectOne('/api/auth/register').flush(
      {
        ...errorBody('VALIDATION_FAILED', 400),
        details: [{ field: 'password', constraints: ['x'], messages: ['x'] }],
      },
      { status: 400, statusText: 'x' },
    );
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('markierten Angaben');
    submit(element);
    await fixture.whenStable();
    http.expectNone('/api/auth/register');
  });
});
