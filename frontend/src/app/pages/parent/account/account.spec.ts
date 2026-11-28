import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ThemeService } from '../../../core/theme/theme.service';
import {
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../../testing/app-testing';
import { resetDocumentState, stubObjectUrls } from '../../../../testing/browser';
import { AccountPage } from './account-page';
import { DataSection } from './data-section';
import { EmailSection } from './email-section';
import { PasswordSection } from './password-section';
import { PreferencesSection } from './preferences-section';
import { TotpSection } from './totp-section';

describe('account settings', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let confirmResult: boolean;
  let createObjectURL: ReturnType<typeof stubObjectUrls>['create'];

  beforeEach(() => {
    confirmResult = true;
    createObjectURL = stubObjectUrls('blob:x').create;
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(confirmResult) }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  const fail = (url: string, code: string, status = 400) =>
    http.expectOne(url).flush(errorBody(code, status), { status, statusText: 'x' });

  it('renders every section', async () => {
    const { element } = await renderComponent(AccountPage);
    for (const id of [
      'prefs-heading',
      'password-heading',
      'email-heading',
      'totp-heading',
      'data-heading',
    ]) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('saves language and theme preferences', async () => {
    const { fixture } = await renderComponent(PreferencesSection);
    const section = fixture.componentInstance as unknown as {
      setLanguage(l: string): Promise<void>;
      setTheme(t: string): Promise<void>;
    };
    const language = section.setLanguage('en-US');
    const req = http.expectOne('/api/account');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ locale: 'en-US' });
    req.flush({ user: { ...USER, locale: 'en-US' } });
    await language;
    expect(TestBed.inject(LanguageService).language()).toBe('en-US');
    expect(auth.user()?.locale).toBe('en-US');

    const theme = section.setTheme('dark');
    fail('/api/account', 'VALIDATION_FAILED');
    await theme;
    await settle(fixture);
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
    expect(byTestId(fixture.nativeElement, 'form-error')).toBeTruthy();
  });

  it('changes the password', async () => {
    const { element, fixture } = await renderComponent(PasswordSection);
    type(byTestId<HTMLInputElement>(element, 'current-password'), 'old password');
    type(byTestId<HTMLInputElement>(element, 'new-password'), 'a new long password');
    type(byTestId<HTMLInputElement>(element, 'new-password-confirm'), 'a new long password');
    submit(element);
    const req = http.expectOne('/api/account/password');
    expect(req.request.body).toEqual({
      currentPassword: 'old password',
      newPassword: 'a new long password',
    });
    req.flush({});
    await settle(fixture);
    expect(element.textContent).toContain('Passwort ist geändert');

    submit(element);
    http.expectNone('/api/account/password');
  });

  it('shows password change errors', async () => {
    const { element, fixture } = await renderComponent(PasswordSection);
    type(byTestId<HTMLInputElement>(element, 'current-password'), 'wrong');
    type(byTestId<HTMLInputElement>(element, 'new-password'), 'a new long password');
    type(byTestId<HTMLInputElement>(element, 'new-password-confirm'), 'a new long password');
    submit(element);
    fail('/api/account/password', 'INVALID_CREDENTIALS', 401);
    await settle(fixture);
    expect(byTestId(element, 'form-error')).toBeTruthy();
  });

  it('requests an email change', async () => {
    const { element, fixture } = await renderComponent(EmailSection);
    expect(element.textContent).toContain(USER.email);
    type(byTestId<HTMLInputElement>(element, 'new-email'), 'new@example.com');
    type(element.querySelector('input[type="password"]') as HTMLInputElement, 'pw');
    submit(element);
    const req = http.expectOne('/api/account/email');
    expect(req.request.body).toEqual({ newEmail: 'new@example.com', password: 'pw' });
    req.flush({}, { status: 202, statusText: 'Accepted' });
    await settle(fixture);
    expect(element.textContent).toContain('new@example.com');

    type(byTestId<HTMLInputElement>(element, 'new-email'), 'other@example.com');
    type(element.querySelector('input[type="password"]') as HTMLInputElement, 'pw');
    submit(element);
    fail('/api/account/email', 'INVALID_CREDENTIALS', 401);
    await settle(fixture);
    expect(byTestId(element, 'form-error')).toBeTruthy();
  });

  it('sets up TOTP and shows recovery codes', async () => {
    const { element, fixture } = await renderComponent(TotpSection);
    expect(byTestId(element, 'totp-status').textContent).toContain('Ausgeschaltet');
    byTestId(element, 'totp-start').click();
    http.expectOne('/api/auth/totp/setup').flush({
      otpauthUrl: 'otpauth://totp/Murmeli:p?secret=ABCDEF&issuer=Murmeli',
      qrDataUrl: 'data:image/png;base64,AAAA',
    });
    await settle(fixture);
    expect(byTestId(element, 'totp-qr').getAttribute('src')).toContain('data:image/png');
    expect(byTestId(element, 'totp-secret').textContent).toContain('ABCDEF');

    submit(element);
    http.expectNone('/api/auth/totp/enable');
    type(byTestId<HTMLInputElement>(element, 'totp-enable-code'), '123456');
    submit(element);
    const codes = Array.from({ length: 10 }, (_, i) => `code-${i}`);
    http.expectOne('/api/auth/totp/enable').flush({ recoveryCodes: codes });
    await settle(fixture);
    expect(byTestId(element, 'recovery-codes').textContent).toContain('code-9');
    expect(auth.user()?.totpEnabled).toBe(true);

    const download = [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Herunterladen'),
    );
    download?.click();
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('explains a required TOTP setup and focuses the section', async () => {
    const { element, fixture } = await renderComponent(TotpSection, { required: true });
    await settle(fixture);
    expect(byTestId(element, 'totp-required-notice').textContent).toContain('Pflicht');
    expect(document.activeElement?.id).toBe('totp-heading');
  });

  it('copes with a malformed otpauth url', async () => {
    const { element, fixture } = await renderComponent(TotpSection);
    byTestId(element, 'totp-start').click();
    http.expectOne('/api/auth/totp/setup').flush({ otpauthUrl: 'not a url', qrDataUrl: 'data:,' });
    await settle(fixture);
    expect(byTestId(element, 'totp-secret').textContent?.trim()).toBe('');
  });

  it('cancels a TOTP setup and reports errors', async () => {
    const { element, fixture } = await renderComponent(TotpSection);
    byTestId(element, 'totp-start').click();
    fail('/api/auth/totp/setup', 'PARENT_GATE_REQUIRED', 400);
    await settle(fixture);
    expect(byTestId(element, 'form-error')).toBeTruthy();

    byTestId(element, 'totp-start').click();
    http
      .expectOne('/api/auth/totp/setup')
      .flush({ otpauthUrl: 'otpauth://totp/x?secret=S', qrDataUrl: 'data:,' });
    await settle(fixture);
    const cancel = [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Abbrechen'),
    );
    cancel?.click();
    await fixture.whenStable();
    expect(byTestId(element, 'totp-start')).toBeTruthy();
  });

  it('disables TOTP and regenerates recovery codes', async () => {
    auth.setUser({ ...USER, totpEnabled: true });
    const { element, fixture } = await renderComponent(TotpSection);
    const [disableForm, regenerateForm] = [...element.querySelectorAll('form')];
    const inputs = (form: Element) => [...form.querySelectorAll('input')];

    regenerateForm.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone('/api/auth/totp/recovery-codes');
    type(inputs(regenerateForm)[0], '654321');
    regenerateForm.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne('/api/auth/totp/recovery-codes').flush({ recoveryCodes: ['r1'] });
    await settle(fixture);
    expect(byTestId(element, 'recovery-codes').textContent).toContain('r1');

    disableForm.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone('/api/auth/totp/disable');
    type(inputs(disableForm)[0], 'pw');
    type(inputs(disableForm)[1], '111111');
    disableForm.dispatchEvent(new Event('submit', { cancelable: true }));
    const req = http.expectOne('/api/auth/totp/disable');
    expect(req.request.body).toEqual({ password: 'pw', code: '111111' });
    req.flush(null);
    await settle(fixture);
    expect(auth.user()?.totpEnabled).toBe(false);
  });

  it('exports data and deletes the account after typed confirmation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { element, fixture } = await renderComponent(DataSection);
    byTestId(element, 'export-data').click();
    http.expectOne('/api/account/export').flush({ user: USER, kids: [] });
    await settle(fixture);
    expect(createObjectURL).toHaveBeenCalled();

    submit(element);
    await settle(fixture);
    http.expectNone('/api/account');

    confirmResult = false;
    type(byTestId<HTMLInputElement>(element, 'delete-password'), 'pw');
    submit(element);
    await settle(fixture);
    http.expectNone('/api/account');

    confirmResult = true;
    submit(element);
    await settle(fixture);
    const req = http.expectOne('/api/account');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 'pw' });
    req.flush(null);
    await settle(fixture);
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows export errors', async () => {
    const { element, fixture } = await renderComponent(DataSection);
    byTestId(element, 'export-data').click();
    fail('/api/account/export', 'PARENT_GATE_REQUIRED', 400);
    await settle(fixture);
    expect(byTestId(element, 'form-error')).toBeTruthy();
  });
});
