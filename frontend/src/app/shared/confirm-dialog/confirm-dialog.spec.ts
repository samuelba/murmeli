import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { byTestId, renderComponent, type } from '../../../testing/app-testing';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { injectConfirm } from './confirm';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  function setup(data: ConfirmDialogData) {
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
  }

  it('renders the translated message with params', async () => {
    setup({
      titleKey: 'parent.deleteKidTitle',
      messageKey: 'parent.deleteKidMessage',
      confirmKey: 'common.delete',
      params: { name: 'Mia' },
    });
    const { element } = await renderComponent(ConfirmDialog);
    expect(element.textContent).toContain('Mia löschen?');
    expect(byTestId<HTMLButtonElement>(element, 'confirm-ok').disabled).toBe(false);
  });

  it('enables confirm only after the exact text is typed', async () => {
    setup({
      titleKey: 'account.deleteConfirmTitle',
      messageKey: 'account.deleteConfirmMessage',
      confirmKey: 'account.delete',
      confirmText: 'LÖSCHEN',
      danger: true,
    });
    const { element, fixture } = await renderComponent(ConfirmDialog);
    const ok = byTestId<HTMLButtonElement>(element, 'confirm-ok');
    expect(ok.disabled).toBe(true);
    expect(ok.classList).toContain('mu-danger');

    type(byTestId<HTMLInputElement>(element, 'confirm-text'), 'löschen');
    await fixture.whenStable();
    expect(ok.disabled).toBe(true);
    type(byTestId<HTMLInputElement>(element, 'confirm-text'), 'LÖSCHEN ');
    await fixture.whenStable();
    expect(ok.disabled).toBe(false);
  });

  it('injectConfirm resolves true only for a confirmed dialog', async () => {
    const results = [true, undefined];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => of(results.shift()) }) },
        },
      ],
    });
    const confirm = TestBed.runInInjectionContext(() => injectConfirm());
    const data = { titleKey: 'a', messageKey: 'b', confirmKey: 'c' };
    await expect(confirm(data)).resolves.toBe(true);
    await expect(confirm(data)).resolves.toBe(false);
  });
});
