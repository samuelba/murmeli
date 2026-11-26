import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { errorBody, provideAppTesting } from '../../../testing/app-testing';
import { quietSession } from '../http/http-context';
import { AuthService } from './auth.service';
import { ParentGateService } from './parent-gate.service';

describe('parent gate', () => {
  let http: HttpTestingController;
  let dialogResult: boolean | undefined;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialogResult = true;
    open = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: MatDialog, useValue: { open } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('ParentGateService', () => {
    it('skips the dialog while the gate is open', async () => {
      const auth = TestBed.inject(AuthService);
      const unlock = auth.unlockParentGate('pw');
      http
        .expectOne('/api/auth/parent-gate')
        .flush({ parentGateExpiresAt: new Date(Date.now() + 60_000).toISOString() });
      await unlock;

      await expect(TestBed.inject(ParentGateService).ensure()).resolves.toBe(true);
      expect(open).not.toHaveBeenCalled();
    });

    it('opens a single dialog for concurrent prompts', async () => {
      const gate = TestBed.inject(ParentGateService);
      const results = await Promise.all([gate.ensure(), gate.prompt()]);
      expect(results).toEqual([true, true]);
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('reports a cancelled dialog', async () => {
      dialogResult = undefined;
      await expect(TestBed.inject(ParentGateService).prompt()).resolves.toBe(false);
    });
  });

  describe('parentGateInterceptor', () => {
    const gateRequired = () =>
      [errorBody('PARENT_GATE_REQUIRED', 403), { status: 403, statusText: 'Forbidden' }] as const;

    it('prompts and retries after a successful unlock', async () => {
      const result = firstValueFrom(TestBed.inject(HttpClient).post('/api/kids', { a: 1 }));
      http.expectOne('/api/kids').flush(...gateRequired());
      await vi.waitFor(() => expect(open).toHaveBeenCalled());
      await vi.waitFor(() => http.expectOne('/api/kids').flush({ id: 'k1' }));
      await expect(result).resolves.toEqual({ id: 'k1' });
    });

    it('fails with the original error when the parent cancels', async () => {
      dialogResult = false;
      const result = firstValueFrom(TestBed.inject(HttpClient).delete('/api/kids/1'));
      http.expectOne('/api/kids/1').flush(...gateRequired());
      await expect(result).rejects.toMatchObject({ code: 'PARENT_GATE_REQUIRED' });
    });

    it('leaves quiet requests and other 403s alone', async () => {
      const client = TestBed.inject(HttpClient);
      const quiet = firstValueFrom(client.get('/api/auth/me', { context: quietSession() }));
      http.expectOne('/api/auth/me').flush(...gateRequired());
      await expect(quiet).rejects.toBeTruthy();

      const other = firstValueFrom(client.get('/api/admin/users'));
      http
        .expectOne('/api/admin/users')
        .flush(errorBody('TOTP_REQUIRED', 403), { status: 403, statusText: 'x' });
      await expect(other).rejects.toMatchObject({ code: 'TOTP_REQUIRED' });
      expect(open).not.toHaveBeenCalled();
    });
  });
});
