import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ParentGateService } from '../core/auth/parent-gate.service';
import {
  KID,
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../testing/app-testing';
import { resetDocumentState } from '../../testing/browser';
import { ParentDashboard } from './parent/dashboard/parent-dashboard';
import { ParentShell } from './parent/shell/parent-shell';
import { ProfilePicker } from './profile-picker/profile-picker';

describe('family pages', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let ensure: ReturnType<typeof vi.fn>;
  let confirmResult: boolean;

  beforeEach(() => {
    ensure = vi.fn().mockResolvedValue(true);
    confirmResult = true;
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: ParentGateService, useValue: { ensure, prompt: ensure } },
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(confirmResult) }) },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  const NO_PIN = { ...KID, id: 'k2', nickname: 'Noah', hasPin: false };

  async function picker(kids = [KID, NO_PIN]) {
    const result = await renderComponent(ProfilePicker);
    http.expectOne('/api/kids').flush(kids);
    await settle(result.fixture);
    return result;
  }

  describe('ProfilePicker', () => {
    it('shows a tile per kid plus add and parents buttons', async () => {
      const { element } = await picker();
      expect(byTestId(element, 'page-title').textContent).toContain('Wer lernt heute?');
      expect(byTestId(element, 'kid-tile-k1').textContent).toContain('Mia');
      expect(
        byTestId(element, 'kid-tile-k1').querySelector('[data-testid="tile-lock"]'),
      ).not.toBeNull();
      expect(
        byTestId(element, 'kid-tile-k2').querySelector('[data-testid="tile-lock"]'),
      ).toBeNull();
      expect(byTestId(element, 'add-profile')).toBeTruthy();
      expect(byTestId(element, 'parents-button')).toBeTruthy();
      expect(element.querySelector('mu-speak')).not.toBeNull();
    });

    it('shows the empty state and hides add at the limit', async () => {
      const { element } = await picker([]);
      expect(byTestId(element, 'picker-empty')).toBeTruthy();
      const full = Array.from({ length: 8 }, (_, i) => ({ ...NO_PIN, id: `k${i}` }));
      const second = await renderComponent(ProfilePicker);
      http.expectOne('/api/kids').flush(full);
      await settle(second.fixture);
      expect(second.element.querySelector('[data-testid="add-profile"]')).toBeNull();
    });

    it('activates a kid without PIN straight away', async () => {
      const { element, fixture } = await picker();
      byTestId(element, 'kid-tile-k2').click();
      const req = http.expectOne('/api/kids/k2/activate');
      expect(req.request.body).toEqual({});
      req.flush(NO_PIN);
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/learn');
      expect(TestBed.inject(AuthService).activeKid()?.id).toBe('k2');
    });

    it('asks for the picture PIN and activates with it', async () => {
      const { element, fixture } = await picker();
      byTestId(element, 'kid-tile-k1').click();
      await settle(fixture);
      expect(byTestId(element, 'pin-view')).toBeTruthy();
      expect(document.activeElement?.id).toBe('pin-heading');

      for (const index of [0, 1, 2, 3]) {
        byTestId(element, `pin-picture-${index}`).click();
      }
      const req = http.expectOne('/api/kids/k1/activate');
      expect(req.request.body).toEqual({ pin: [0, 1, 2, 3] });
      req.flush(KID);
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/learn');
    });

    it('encourages after a wrong PIN and locks after too many', async () => {
      const { element, fixture } = await picker();
      byTestId(element, 'kid-tile-k1').click();
      await settle(fixture);
      const enter = () =>
        [4, 4, 4, 4].forEach((i) => byTestId(element, `pin-picture-${i}`).click());

      enter();
      http
        .expectOne('/api/kids/k1/activate')
        .flush(errorBody('PIN_INVALID', 401), { status: 401, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'pin-feedback').textContent).toContain('Fast!');
      expect(element.querySelector('mu-mascot[data-pose="encouraging"]')).not.toBeNull();

      enter();
      http.expectOne('/api/kids/k1/activate').flush(errorBody('PIN_LOCKED', 429), {
        status: 429,
        statusText: 'x',
        headers: { 'Retry-After': '300' },
      });
      await settle(fixture);
      expect(byTestId(element, 'pin-feedback').textContent).toContain('5 Minuten');
      expect(byTestId(element, 'pin-picture-0').getAttribute('aria-disabled')).toBe('true');
      expect(element.querySelector('.feedback')?.getAttribute('role')).toBe('alert');

      byTestId(element, 'pin-back').click();
      await settle(fixture);
      expect(byTestId(element, 'kid-tile-k1')).toBeTruthy();
    });

    it('opens the parent gate before adding a profile', async () => {
      const { element, fixture } = await picker();
      byTestId(element, 'add-profile').click();
      await settle(fixture);
      expect(ensure).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/parent/kids/new');

      byTestId(element, 'parents-button').click();
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/parent');
    });

    it('shows load errors', async () => {
      const { element, fixture } = await renderComponent(ProfilePicker);
      http.expectOne('/api/kids').flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error').textContent).toContain('Server');
    });
  });

  describe('ParentDashboard', () => {
    it('lists kids with class and language and deletes after confirming', async () => {
      const { element, fixture } = await renderComponent(ParentDashboard);
      http.expectOne('/api/kids').flush([KID, NO_PIN]);
      await settle(fixture);
      expect(byTestId(element, 'kid-row-k1').textContent).toContain('Kindergarten 2');
      expect(byTestId(element, 'kid-row-k1').textContent).toContain('Deutsch');
      expect(byTestId(element, 'edit-kid-k1').getAttribute('href')).toBe('/parent/kids/k1');

      byTestId(element, 'delete-kid-k2').click();
      await settle(fixture);
      http.expectOne('/api/kids/k2').flush(null);
      await settle(fixture);
      expect(element.querySelector('[data-testid="kid-row-k2"]')).toBeNull();
    });

    it('keeps the kid when the parent cancels and shows errors', async () => {
      confirmResult = false;
      const { element, fixture } = await renderComponent(ParentDashboard);
      http.expectOne('/api/kids').flush([KID]);
      await settle(fixture);
      byTestId(element, 'delete-kid-k1').click();
      await settle(fixture);
      http.expectNone('/api/kids/k1');

      confirmResult = true;
      byTestId(element, 'delete-kid-k1').click();
      await settle(fixture);
      http.expectOne('/api/kids/k1').flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });

    it('shows the empty state and load errors', async () => {
      const { element, fixture } = await renderComponent(ParentDashboard);
      http.expectOne('/api/kids').flush([]);
      await settle(fixture);
      expect(byTestId(element, 'no-kids')).toBeTruthy();

      const failing = await renderComponent(ParentDashboard);
      http.expectOne('/api/kids').flush(null, { status: 500, statusText: 'x' });
      await settle(failing.fixture);
      expect(byTestId(failing.element, 'form-error')).toBeTruthy();
    });
  });

  describe('ParentShell', () => {
    it('shows the admin link for admins and locks the parent area', async () => {
      const auth = TestBed.inject(AuthService);
      auth.setUser({ ...USER, role: 'admin' });
      const { element, fixture } = await renderComponent(ParentShell);
      expect(byTestId(element, 'nav-admin')).toBeTruthy();

      byTestId(element, 'lock-parent-area').click();
      http.expectOne('/api/auth/parent-gate/lock').flush(null);
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/');
    });

    it('hides the admin link for parents and shows lock errors', async () => {
      TestBed.inject(AuthService).setUser(USER);
      const { element, fixture } = await renderComponent(ParentShell);
      expect(element.querySelector('[data-testid="nav-admin"]')).toBeNull();
      byTestId(element, 'lock-parent-area').click();
      http.expectOne('/api/auth/parent-gate/lock').flush(null, { status: 500, statusText: 'x' });
      await settle(fixture);
      expect(byTestId(element, 'form-error')).toBeTruthy();
    });
  });
});
