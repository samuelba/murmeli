import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import {
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../testing/app-testing';
import { ParentGateDialog } from './parent-gate-dialog';

describe('ParentGateDialog', () => {
  let close: ReturnType<typeof vi.fn>;
  let http: HttpTestingController;

  beforeEach(() => {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: MatDialogRef, useValue: { close } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requires a password', async () => {
    const { element, fixture } = await renderComponent(ParentGateDialog);
    submit(element);
    await fixture.whenStable();
    http.expectNone('/api/auth/parent-gate');
    expect(element.textContent).toContain('Bitte ausfüllen.');
  });

  it('unlocks the gate and closes with true', async () => {
    const { element, fixture } = await renderComponent(ParentGateDialog);
    type(byTestId<HTMLInputElement>(element, 'parent-gate-password'), 'secret');
    submit(element);
    const req = http.expectOne('/api/auth/parent-gate');
    expect(req.request.body).toEqual({ password: 'secret' });
    req.flush({ parentGateExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    await settle(fixture);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows a wrong password and clears the field', async () => {
    const { element, fixture } = await renderComponent(ParentGateDialog);
    const input = byTestId<HTMLInputElement>(element, 'parent-gate-password');
    type(input, 'wrong');
    submit(element);
    http
      .expectOne('/api/auth/parent-gate')
      .flush(errorBody('INVALID_CREDENTIALS', 401), { status: 401, statusText: 'x' });
    await settle(fixture);

    expect(byTestId(element, 'form-error').textContent).toContain('Passwort stimmen nicht');
    expect(input.value).toBe('');
    expect(close).not.toHaveBeenCalled();
  });
});
