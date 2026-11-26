import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ALTCHA_LOADER } from '../shared/altcha/altcha-loader';
import {
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../testing/app-testing';
import { resetDocumentState } from '../../testing/browser';
import { ForgotPassword } from './forgot-password/forgot-password';
import { Invite } from './invite/invite';
import { About } from './about/about';
import { Legal } from './legal/legal';
import { ResetPassword } from './reset-password/reset-password';
import { Setup } from './setup/setup';
import { AuthService } from '../core/auth/auth.service';
import { VerifyEmail } from './verify-email/verify-email';

describe('public pages', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let routerNavigate: ReturnType<typeof vi.spyOn>;

  function setup(
    query: Record<string, string> = {},
    params: Record<string, string> = {},
    data = {},
  ) {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: ALTCHA_LOADER, useValue: () => Promise.resolve() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(query),
              paramMap: convertToParamMap(params),
            },
            data: of(data),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    routerNavigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  const expectTokenRemoved = () =>
    expect(routerNavigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { token: null }, replaceUrl: true }),
    );

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  const verify = (element: HTMLElement) =>
    element
      .querySelector('altcha-widget')
      ?.dispatchEvent(
        new CustomEvent('statechange', { detail: { state: 'verified', payload: 'p' } }),
      );

  const fillPasswords = (element: HTMLElement, password = 'a long password 42') => {
    type(byTestId<HTMLInputElement>(element, 'new-password'), password);
    type(byTestId<HTMLInputElement>(element, 'new-password-confirm'), password);
  };

  describe('Setup', () => {
    it('asks for the setup code when the server requires one', async () => {
      setup();
      const loading = TestBed.inject(AuthService).loadConfig();
      http.expectOne('/api/auth/config').flush({
        registrationEnabled: true,
        emailEnabled: true,
        setupRequired: true,
        setupTokenRequired: true,
      });
      await loading;
      const { element, fixture } = await renderComponent(Setup);
      type(byTestId<HTMLInputElement>(element, 'setup-email'), 'admin@example.com');
      fillPasswords(element);
      submit(element);
      http.expectNone('/api/auth/setup');

      type(byTestId<HTMLInputElement>(element, 'setup-token'), ' secret-token ');
      submit(element);
      const req = http.expectOne('/api/auth/setup');
      expect(req.request.body).toEqual({
        email: 'admin@example.com',
        password: 'a long password 42',
        locale: 'de-CH',
        setupToken: 'secret-token',
      });
      req.flush(errorBody('SETUP_TOKEN_INVALID', 403), { status: 403, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain(
        'Einrichtungs-Code stimmt nicht',
      );
    });

    it('creates the first admin and opens the app', async () => {
      setup();
      const { element, fixture } = await renderComponent(Setup);
      expect(element.querySelector('[data-testid="setup-token"]')).toBeNull();
      type(byTestId<HTMLInputElement>(element, 'setup-email'), 'admin@example.com');
      fillPasswords(element);
      submit(element);
      const req = http.expectOne('/api/auth/setup');
      expect(req.request.body).toEqual({
        email: 'admin@example.com',
        password: 'a long password 42',
        locale: 'de-CH',
      });
      req.flush({ user: { ...USER, role: 'admin' } });
      await vi.waitFor(() =>
        http
          .expectOne('/api/auth/me')
          .flush({ user: USER, parentGateExpiresAt: null, activeKid: null }),
      );
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/');
    });

    it('reports SETUP_COMPLETE', async () => {
      setup();
      const { element, fixture } = await renderComponent(Setup);
      submit(element);
      http.expectNone('/api/auth/setup');
      type(byTestId<HTMLInputElement>(element, 'setup-email'), 'admin@example.com');
      fillPasswords(element);
      submit(element);
      http
        .expectOne('/api/auth/setup')
        .flush(errorBody('SETUP_COMPLETE', 403), { status: 403, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain('bereits abgeschlossen');
    });
  });

  describe('VerifyEmail', () => {
    it.each([
      ['registration', 'Du kannst dich jetzt anmelden'],
      ['email_change', 'neue E-Mail-Adresse ist bestätigt'],
    ])('confirms a %s token', async (kind, text) => {
      setup({ token: 'tok' });
      const { element, fixture } = await renderComponent(VerifyEmail);
      const req = http.expectOne('/api/auth/verify-email');
      expect(req.request.body).toEqual({ token: 'tok' });
      req.flush({ ok: true, type: kind });
      await settle(fixture);
      expectTokenRemoved();
      expect(byTestId(element, 'verify-success').textContent).toContain(text);
    });

    it('offers a resend after an invalid token', async () => {
      setup({ token: 'bad', email: 'p@example.com' });
      const { element, fixture } = await renderComponent(VerifyEmail);
      http
        .expectOne('/api/auth/verify-email')
        .flush(errorBody('TOKEN_INVALID', 400), { status: 400, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain('ungültig');
      expect(byTestId<HTMLInputElement>(element, 'resend-email').value).toBe('p@example.com');

      submit(element);
      await fixture.whenStable();
      http.expectNone('/api/auth/resend-verification');

      verify(element);
      submit(element);
      const req = http.expectOne('/api/auth/resend-verification');
      expect(req.request.body).toEqual({ email: 'p@example.com', altcha: 'p' });
      req.flush({ ok: true });
      await settle(fixture);
      expect(byTestId(element, 'verify-resent')).toBeTruthy();
    });

    it('shows rate limits on resend', async () => {
      setup({ email: 'p@example.com' });
      const { element, fixture } = await renderComponent(VerifyEmail);
      await settle(fixture);
      verify(element);
      submit(element);
      http
        .expectOne('/api/auth/resend-verification')
        .flush(errorBody('RATE_LIMITED', 429), { status: 429, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain('Zu viele Versuche');
      submit(element);
      await fixture.whenStable();
      http.expectNone('/api/auth/resend-verification');
    });
  });

  describe('ForgotPassword', () => {
    it('needs an email and the ALTCHA, then confirms without revealing accounts', async () => {
      setup();
      const { element, fixture } = await renderComponent(ForgotPassword);
      await settle(fixture);
      type(byTestId<HTMLInputElement>(element, 'forgot-email'), 'p@example.com');
      submit(element);
      await fixture.whenStable();
      expect(byTestId(element, 'form-error').textContent).toContain('Mensch');

      verify(element);
      submit(element);
      http.expectOne('/api/auth/forgot-password').flush({ ok: true });
      await settle(fixture);
      expect(byTestId(element, 'forgot-done').textContent).toContain('Falls ein Konto');
      expect(fixture.componentInstance['altcha']()).toBeNull();
    });

    it('shows server errors', async () => {
      setup();
      const { element, fixture } = await renderComponent(ForgotPassword);
      await settle(fixture);
      type(byTestId<HTMLInputElement>(element, 'forgot-email'), 'p@example.com');
      verify(element);
      submit(element);
      http.expectOne('/api/auth/forgot-password').flush(null, { status: 0, statusText: '' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });

  describe('ResetPassword', () => {
    it('rejects a missing token', async () => {
      setup();
      const { element } = await renderComponent(ResetPassword);
      expect(byTestId(element, 'form-error').textContent).toContain('ungültig');
    });

    it('sets the new password', async () => {
      setup({ token: 'tok' });
      const { element, fixture } = await renderComponent(ResetPassword);
      fillPasswords(element);
      submit(element);
      const req = http.expectOne('/api/auth/reset-password');
      expect(req.request.body).toEqual({ token: 'tok', password: 'a long password 42' });
      req.flush({ ok: true });
      await settle(fixture);
      expect(byTestId(element, 'reset-done')).toBeTruthy();
      expectTokenRemoved();
    });

    it('links to a new request when the token expired', async () => {
      setup({ token: 'old' });
      const { element, fixture } = await renderComponent(ResetPassword);
      fillPasswords(element);
      submit(element);
      http
        .expectOne('/api/auth/reset-password')
        .flush(errorBody('TOKEN_INVALID', 400), { status: 400, statusText: 'x' });
      await settle(fixture);
      expect(element.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    });
  });

  describe('Invite', () => {
    it('accepts a valid invite', async () => {
      setup({}, { token: 'inv' });
      const { element, fixture } = await renderComponent(Invite);
      http
        .expectOne('/api/invites/inv')
        .flush({ email: 'new@example.com', role: 'parent', expiresAt: '2030-01-01T00:00:00Z' });
      await settle(fixture);
      expect(byTestId(element, 'invite-email').textContent).toContain('new@example.com');

      fillPasswords(element);
      submit(element);
      await fixture.whenStable();
      http.expectNone('/api/invites/inv/accept');
      expect(element.textContent).toContain('Datenschutzerklärung');

      byTestId(element, 'invite-terms').querySelector('input')?.click();
      submit(element);
      http.expectOne('/api/invites/inv/accept').flush({ user: USER });
      await vi.waitFor(() =>
        http
          .expectOne('/api/auth/me')
          .flush({ user: USER, parentGateExpiresAt: null, activeKid: null }),
      );
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/');
    });

    it('explains an invalid invite', async () => {
      setup({}, { token: 'gone' });
      const { element, fixture } = await renderComponent(Invite);
      http
        .expectOne('/api/invites/gone')
        .flush(errorBody('INVITE_INVALID', 404), { status: 404, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain('Einladung ist ungültig');
    });

    it('reports accept failures', async () => {
      setup({}, { token: 'inv' });
      const { element, fixture } = await renderComponent(Invite);
      http
        .expectOne('/api/invites/inv')
        .flush({ email: 'new@example.com', role: 'parent', expiresAt: '2030-01-01T00:00:00Z' });
      await settle(fixture);
      fillPasswords(element);
      byTestId(element, 'invite-terms').querySelector('input')?.click();
      submit(element);
      http
        .expectOne('/api/invites/inv/accept')
        .flush(errorBody('INVITE_INVALID', 404), { status: 404, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });

  describe('Legal', () => {
    it.each([
      ['privacy', 'Datenschutz', 'Keine Tracker'],
      ['terms', 'Nutzungsbedingungen', 'Elternkonto'],
    ])('renders the %s draft', async (kind, title, section) => {
      setup({}, {}, { kind });
      const { element } = await renderComponent(Legal);
      expect(byTestId(element, 'page-title').textContent).toContain(title);
      expect(byTestId(element, 'legal-draft')).toBeTruthy();
      expect(element.textContent).toContain(section);
      expect(byTestId(element, 'operator-none').textContent).toContain(
        'Betrieben von der Person oder Organisation, die diese Instanz hostet.',
      );
      expect(element.textContent).not.toContain('folgen');
    });

    async function withLegal(kind: string, legal: Record<string, string | null>) {
      setup({}, {}, { kind });
      const loaded = TestBed.inject(AuthService).loadConfig();
      http.expectOne('/api/auth/config').flush({
        registrationEnabled: true,
        emailEnabled: true,
        setupRequired: false,
        legal,
      });
      await loaded;
      return (await renderComponent(Legal)).element;
    }

    it('shows the operator from the server config, with the privacy note on privacy only', async () => {
      const legal = {
        operatorName: 'Familie Muster',
        contactEmail: 'hallo@example.ch',
        address: 'Bergweg 1\n3000 Bern',
        privacyNote: 'Wir hosten bei uns zu Hause.',
      };
      const privacy = await withLegal('privacy', legal);
      expect(byTestId(privacy, 'operator-name').textContent).toBe('Familie Muster');
      expect(byTestId(privacy, 'operator-address').textContent).toBe('Bergweg 1\n3000 Bern');
      expect(byTestId(privacy, 'operator-email').getAttribute('href')).toBe(
        'mailto:hallo@example.ch',
      );
      expect(byTestId(privacy, 'operator-privacy-note').textContent).toContain('zu Hause');
      expect(privacy.querySelector('[data-testid="operator-none"]')).toBeNull();
    });

    it('leaves out empty fields and never links a malformed address', async () => {
      const terms = await withLegal('terms', {
        operatorName: '  ',
        contactEmail: 'not an email',
        address: null,
        privacyNote: 'nur Datenschutz',
      });
      expect(terms.querySelector('[data-testid="operator-name"]')).toBeNull();
      expect(byTestId(terms, 'operator-email').tagName).toBe('SPAN');
      expect(terms.querySelector('[data-testid="operator-privacy-note"]')).toBeNull();
    });

    it('links only plain addresses (no query, one-letter domain or odd characters)', async () => {
      const odd = await withLegal('terms', {
        operatorName: 'X',
        contactEmail: 'a@b.c?subject=hi',
        address: null,
        privacyNote: null,
      });
      expect(byTestId(odd, 'operator-email').tagName).toBe('SPAN');
    });

    it('falls back to the neutral note when every field is empty', async () => {
      const element = await withLegal('privacy', {
        operatorName: null,
        contactEmail: '',
        address: null,
        privacyNote: null,
      });
      expect(byTestId(element, 'operator-none')).toBeTruthy();
    });
  });

  describe('About', () => {
    it('explains the app, the AI voices, the licenses and the version', async () => {
      setup();
      const { element } = await renderComponent(About);
      expect(byTestId(element, 'page-title').textContent).toContain('Über Murmeli');
      expect(byTestId(element, 'about-curriculum').textContent).toContain(
        'nicht mit dem Lehrplan 21',
      );
      expect(byTestId(element, 'about-voices').textContent).toContain(
        'künstlicher Intelligenz erzeugt (Qwen3-TTS)',
      );
      const pictures = byTestId(element, 'credit-pictures');
      expect(pictures.textContent).toContain('Noto Emoji');
      expect(pictures.querySelector('a')?.getAttribute('href')).toBe('/pictures/LICENSE');
      expect(byTestId(element, 'credit-fonts').textContent).toContain('SIL Open Font License');
      expect(byTestId(element, 'credit-artwork').textContent).toContain('eigene Zeichnungen');
      expect(byTestId(element, 'app-version').textContent).toMatch(/Version \d+\.\d+\.\d+/);
    });
  });
});
