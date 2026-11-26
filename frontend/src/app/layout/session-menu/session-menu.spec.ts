import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  ADMIN,
  KID,
  USER,
  byTestId,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../testing/app-testing';
import { SessionMenu } from './session-menu';

describe('SessionMenu', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('renders nothing for guests', async () => {
    const { element } = await renderComponent(SessionMenu);
    expect(element.textContent?.trim()).toBe('');
  });

  it('shows the active kid as a chip in kid mode', async () => {
    auth.setUser(USER);
    auth.setActiveKid(KID);
    const { element } = await renderComponent(SessionMenu);
    expect(byTestId(element, 'kid-chip').textContent).toContain('Mia');
    expect(element.querySelector('[data-testid="account-menu"]')).toBeNull();
  });

  it('opens the account menu with admin entry and logs out', async () => {
    auth.setUser(ADMIN);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { element, fixture } = await renderComponent(SessionMenu);
    byTestId(element, 'account-menu').click();
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="menu-admin"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-testid="menu-logout"]')?.click();
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('reports a failed logout and keeps the user signed in', async () => {
    auth.setUser(USER);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { element, fixture } = await renderComponent(SessionMenu);
    byTestId(element, 'account-menu').click();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('[data-testid="menu-logout"]')?.click();
    http.expectOne('/api/auth/logout').flush(null, { status: 503, statusText: 'x' });
    await vi.waitFor(() =>
      http.expectOne('/api/auth/logout').flush(null, { status: 503, statusText: 'x' }),
    );
    await settle(fixture);
    await vi.waitFor(() =>
      expect(document.querySelector('mat-snack-bar-container')?.textContent).toContain(
        'Abmelden hat nicht geklappt.',
      ),
    );
    expect(auth.user()).toEqual(USER);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides the admin entry for parents', async () => {
    auth.setUser(USER);
    const { element, fixture } = await renderComponent(SessionMenu);
    byTestId(element, 'account-menu').click();
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="menu-admin"]')).toBeNull();
    expect(document.querySelector('[data-testid="menu-parent"]')).not.toBeNull();
  });
});
