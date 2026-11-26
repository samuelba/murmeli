import { DOCUMENT, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RecoveryCodes, ThemePreference, TotpSetup, User } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { ApiService } from '../http/api.service';
import { Language } from '../i18n/languages';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.api.post('account/password', { currentPassword, newPassword }));
  }

  async changeEmail(newEmail: string, password: string): Promise<void> {
    await firstValueFrom(this.api.post('account/email', { newEmail, password }));
  }

  async updatePreferences(preferences: {
    locale?: Language;
    theme?: ThemePreference;
  }): Promise<User> {
    const { user } = await firstValueFrom(this.api.patch<{ user: User }>('account', preferences));
    this.auth.setUser(user);
    return user;
  }

  async exportData(): Promise<void> {
    const data = await firstValueFrom(this.api.get<unknown>('account/export'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.download(blob, `murmeli-export-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async deleteAccount(password: string): Promise<void> {
    await firstValueFrom(this.api.delete('account', { password }));
    this.auth.clear();
  }

  totpSetup(): Promise<TotpSetup> {
    return firstValueFrom(this.api.post<TotpSetup>('auth/totp/setup'));
  }

  async totpEnable(code: string): Promise<readonly string[]> {
    const { recoveryCodes } = await firstValueFrom(
      this.api.post<RecoveryCodes>('auth/totp/enable', { code }),
    );
    this.patchUser({ totpEnabled: true });
    return recoveryCodes;
  }

  async totpDisable(password: string, code: string): Promise<void> {
    await firstValueFrom(this.api.post('auth/totp/disable', { password, code }));
    this.patchUser({ totpEnabled: false });
  }

  async regenerateRecoveryCodes(code: string): Promise<readonly string[]> {
    const { recoveryCodes } = await firstValueFrom(
      this.api.post<RecoveryCodes>('auth/totp/recovery-codes', { code }),
    );
    return recoveryCodes;
  }

  downloadText(text: string, filename: string): void {
    this.download(new Blob([text], { type: 'text/plain' }), filename);
  }

  private patchUser(patch: Partial<User>): void {
    const user = this.auth.user();
    if (user) {
      this.auth.setUser({ ...user, ...patch });
    }
  }

  private download(blob: Blob, filename: string): void {
    const view = this.document.defaultView;
    if (!view?.URL?.createObjectURL) {
      return;
    }
    const url = view.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    view.URL.revokeObjectURL(url);
  }
}
