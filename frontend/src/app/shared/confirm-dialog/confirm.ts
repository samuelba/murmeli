import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

export function injectConfirm(): (data: ConfirmDialogData) => Promise<boolean> {
  const dialog = inject(MatDialog);
  return async (data) => {
    const ref = dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      width: 'min(480px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  };
}
