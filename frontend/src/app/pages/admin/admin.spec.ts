import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AdminUser } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import {
  ADMIN,
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../testing/app-testing';
import { AdminAudit } from './audit/admin-audit';
import { AdminInvites } from './invites/admin-invites';
import { InviteDialog } from './invites/invite-dialog';
import { TranslatedPaginatorIntl } from './paginator-intl';
import { AdminSettingsPage } from './settings/admin-settings';
import { AdminShell } from './shell/admin-shell';
import { AdminStatsPage } from './stats/admin-stats';
import { AdminUsers } from './users/admin-users';

describe('admin area', () => {
  let http: HttpTestingController;
  let confirmResult: boolean;

  beforeEach(() => {
    confirmResult = true;
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl },
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(confirmResult) }) },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser(ADMIN);
  });

  afterEach(() => http.verify());

  const page = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
  const member: AdminUser = {
    ...USER,
    emailVerified: false,
    disabled: false,
    kidCount: 2,
    lastLoginAt: null,
  };

  it('renders the admin navigation', async () => {
    const { element } = await renderComponent(AdminShell);
    expect(byTestId(element, 'admin-nav-users').getAttribute('href')).toBe('/admin/users');
    expect(element.querySelectorAll('nav a').length).toBe(5);
  });

  it('shows the stats cards', async () => {
    const { element, fixture } = await renderComponent(AdminStatsPage);
    http.expectOne('/api/admin/stats').flush({ users: 3, kids: 5, activeKidsLast7Days: 2 });
    await settle(fixture);
    expect(byTestId(element, 'admin-stats').textContent).toContain('Kinderprofile');
  });

  it('explains TOTP_REQUIRED', async () => {
    const { element, fixture } = await renderComponent(AdminStatsPage);
    http
      .expectOne('/api/admin/stats')
      .flush(errorBody('TOTP_REQUIRED', 403), { status: 403, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('Zwei-Faktor');
  });

  describe('users', () => {
    async function render() {
      const result = await renderComponent(AdminUsers);
      http
        .expectOne('/api/admin/users?page=1&pageSize=20')
        .flush(page([member, { ...member, ...ADMIN, emailVerified: true }]));
      await settle(result.fixture);
      return result;
    }

    it('lists users and searches with a debounce', async () => {
      const { element, fixture } = await render();
      expect(byTestId(element, 'users-table').textContent).toContain(USER.email);
      expect(element.textContent).toContain('unbestätigt');

      type(byTestId<HTMLInputElement>(element, 'user-search'), 'parent');
      await new Promise((resolve) => setTimeout(resolve, 350));
      http.expectOne('/api/admin/users?search=parent&page=1&pageSize=20').flush(page([member]));
      await settle(fixture);
    });

    it('changes the role and the active state', async () => {
      const { fixture } = await render();
      const component = fixture.componentInstance as unknown as {
        setRole(u: AdminUser, r: string): Promise<void>;
        setDisabled(
          u: AdminUser,
          e: { checked: boolean; source: { checked: boolean } },
        ): Promise<void>;
        onPage(e: { pageIndex: number; pageSize: number }): Promise<void>;
      };
      const role = component.setRole(member, 'admin');
      const roleReq = http.expectOne('/api/admin/users/u1');
      expect(roleReq.request.body).toEqual({ role: 'admin' });
      roleReq.flush({ ...member, role: 'admin' });
      await role;

      const source = { checked: false };
      const disable = component.setDisabled(member, { checked: false, source });
      const req = http.expectOne('/api/admin/users/u1');
      expect(req.request.body).toEqual({ disabled: true });
      req.flush(errorBody('LAST_ADMIN', 400), { status: 400, statusText: 'x' });
      await disable;
      await settle(fixture);
      expect(source.checked).toBe(true);
      expect(byTestId(fixture.nativeElement, 'form-error').textContent).toContain(
        'mindestens eine',
      );

      const next = component.onPage({ pageIndex: 1, pageSize: 50 });
      http.expectOne('/api/admin/users?page=2&pageSize=50').flush(page([]));
      await next;
    });

    it('resends verification and deletes after confirmation', async () => {
      const { element, fixture } = await render();
      const resend = element.querySelector<HTMLButtonElement>('button[aria-label^="Bestätigung"]');
      resend?.click();
      http
        .expectOne('/api/admin/users/u1/resend-verification')
        .flush(null, { status: 202, statusText: 'x' });
      await settle(fixture);
      expect(element.textContent).toContain('erneut gesendet');

      const remove = element.querySelector<HTMLButtonElement>('button[aria-label$="löschen"]');
      remove?.click();
      await settle(fixture);
      http.expectOne('/api/admin/users/u1').flush(null);
      await settle(fixture);
      http.expectOne('/api/admin/users?page=1&pageSize=20').flush(page([]));
      await settle(fixture);
    });
  });

  describe('invites', () => {
    it('lists, creates and revokes invites', async () => {
      const invite = {
        id: 'i1',
        email: 'new@example.com',
        role: 'parent',
        expiresAt: '2030-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'a1',
      };
      const { element, fixture } = await renderComponent(AdminInvites);
      http.expectOne('/api/admin/invites?page=1&pageSize=20').flush(page([invite]));
      await settle(fixture);
      expect(byTestId(element, 'invites-table').textContent).toContain('new@example.com');

      byTestId(element, 'create-invite').click();
      await settle(fixture);
      http.expectOne('/api/admin/invites?page=1&pageSize=20').flush(page([invite]));

      element.querySelector<HTMLButtonElement>('button[aria-label^="Einladung"]')?.click();
      await settle(fixture);
      http.expectOne('/api/admin/invites/i1').flush(null);
      await settle(fixture);
      http.expectOne('/api/admin/invites?page=1&pageSize=20').flush(page([]));
      await settle(fixture);
    });

    it('shows load errors', async () => {
      const { element, fixture } = await renderComponent(AdminInvites);
      http
        .expectOne('/api/admin/invites?page=1&pageSize=20')
        .flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });

    it('creates an invite and shows the link with the email status', async () => {
      const { element, fixture } = await renderComponent(InviteDialog);
      submit(element);
      http.expectNone('/api/admin/invites');
      type(byTestId<HTMLInputElement>(element, 'invite-email'), 'new@example.com');
      submit(element);
      const req = http.expectOne('/api/admin/invites');
      expect(req.request.body).toEqual({ email: 'new@example.com', role: 'parent' });
      req.flush({
        invite: { id: 'i1', email: 'new@example.com' },
        inviteUrl: 'https://murmeli.example/invite/tok',
        emailStatus: 'disabled',
      });
      await settle(fixture);
      expect(byTestId(element, 'invite-url').textContent).toContain('/invite/tok');
      expect(byTestId(element, 'invite-result').textContent).toContain('nicht eingerichtet');
      byTestId(element, 'invite-copy').click();
    });

    it('shows invite errors', async () => {
      const { element, fixture } = await renderComponent(InviteDialog);
      type(byTestId<HTMLInputElement>(element, 'invite-email'), 'new@example.com');
      submit(element);
      http
        .expectOne('/api/admin/invites')
        .flush(errorBody('VALIDATION_FAILED', 400), { status: 400, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });

  describe('settings', () => {
    it('toggles registration and refreshes the public config', async () => {
      const { element, fixture } = await renderComponent(AdminSettingsPage);
      http
        .expectOne('/api/admin/settings')
        .flush({ registrationEnabled: false, requireAdminTotp: false, emailEnabled: false });
      await settle(fixture);
      expect(element.textContent).toContain('nicht eingerichtet');

      byTestId(element, 'setting-registrationEnabled').querySelector('button')?.click();
      const req = http.expectOne('/api/admin/settings');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ registrationEnabled: true });
      req.flush(null);
      await vi.waitFor(() =>
        http
          .expectOne('/api/auth/config')
          .flush({ registrationEnabled: true, setupRequired: false }),
      );
      await settle(fixture);
      expect(TestBed.inject(AuthService).config()?.registrationEnabled).toBe(true);
      expect(element.textContent).toContain('Gespeichert');
    });

    it('reverts a failed toggle', async () => {
      const { element, fixture } = await renderComponent(AdminSettingsPage);
      http
        .expectOne('/api/admin/settings')
        .flush({ registrationEnabled: false, requireAdminTotp: false, emailEnabled: true });
      await settle(fixture);
      byTestId(element, 'setting-requireAdminTotp').querySelector('button')?.click();
      http.expectOne('/api/admin/settings').flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });

    it('shows load errors', async () => {
      const { element, fixture } = await renderComponent(AdminSettingsPage);
      http.expectOne('/api/admin/settings').flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });

  describe('audit log', () => {
    it('pages and filters entries', async () => {
      const entry = {
        id: 'e1',
        at: '2026-01-01T10:00:00Z',
        actorId: 'a1',
        action: 'auth.login',
        targetType: 'user',
        targetId: 'u1',
        ip: '203.0.113.0',
        meta: { ok: true },
      };
      const { element, fixture } = await renderComponent(AdminAudit);
      http.expectOne('/api/admin/audit-log?page=1&pageSize=50').flush(page([entry]));
      await settle(fixture);
      expect(byTestId(element, 'audit-table').textContent).toContain('auth.login');

      const component = fixture.componentInstance as unknown as {
        filter(a: string): Promise<void>;
        onPage(e: { pageIndex: number; pageSize: number }): Promise<void>;
      };
      const filtered = component.filter('kid.created');
      http.expectOne('/api/admin/audit-log?page=1&pageSize=50&action=kid.created').flush(page([]));
      await filtered;
      const next = component.onPage({ pageIndex: 2, pageSize: 20 });
      http
        .expectOne('/api/admin/audit-log?page=3&pageSize=20&action=kid.created')
        .flush(null, { status: 500, statusText: 'x' });
      await next;
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });

  it('translates the paginator', () => {
    const intl = TestBed.inject(MatPaginatorIntl);
    TestBed.inject(TranslocoService).setActiveLang('de-CH');
    expect(intl.itemsPerPageLabel).toBe('Einträge pro Seite');
    expect(intl.getRangeLabel(1, 10, 25)).toBe('11–20 von 25');
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 von 0');
  });
});
