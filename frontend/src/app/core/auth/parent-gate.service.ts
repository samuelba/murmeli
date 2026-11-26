import { Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ParentGateService {
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private pending: Promise<boolean> | null = null;

  async ensure(): Promise<boolean> {
    return this.auth.hasParentGateNow() || this.prompt();
  }

  prompt(): Promise<boolean> {
    this.pending ??= this.openDialog().finally(() => (this.pending = null));
    return this.pending;
  }

  markExpired(): void {
    this.auth.markParentGateExpired();
  }

  private async openDialog(): Promise<boolean> {
    const [{ MatDialog }, { ParentGateDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('../../shared/parent-gate-dialog/parent-gate-dialog'),
    ]);
    const ref = this.injector.get(MatDialog).open(ParentGateDialog, {
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      width: 'min(440px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
