import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AccountService } from '../../core/account/account.service';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors/error-message';
import { LanguageService } from '../../core/i18n/language.service';
import { LANGUAGES, Language, isLanguage } from '../../core/i18n/languages';

const SHORT_LABELS: Record<Language, string> = { 'de-CH': 'DE', 'en-US': 'EN' };

@Component({
  selector: 'mu-language-switch',
  imports: [MatButtonToggleGroup, MatButtonToggle, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-switch.html',
  styleUrl: './language-switch.scss',
})
export class LanguageSwitch {
  private readonly languageService = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly languages = LANGUAGES;
  protected readonly shortLabels = SHORT_LABELS;
  protected readonly language = this.languageService.language;
  protected readonly saving = signal(false);

  protected async select(value: unknown): Promise<void> {
    if (!isLanguage(value) || value === this.language()) {
      return;
    }
    if (!this.auth.isLoggedIn()) {
      this.languageService.setLanguage(value);
      return;
    }
    const previous = this.language();
    this.saving.set(true);
    this.languageService.useLanguage(value);
    try {
      await this.account.updatePreferences({ locale: value });
      this.languageService.setLanguage(value);
    } catch (error) {
      if (this.auth.isLoggedIn()) {
        this.languageService.useLanguage(previous);
      }
      const message = errorMessage(error);
      this.snackBar.open(
        `${this.transloco.translate('language.saveFailed')} ${this.transloco.translate(message.key, message.params)}`,
        this.transloco.translate('common.close'),
        { duration: 8000, politeness: 'assertive' },
      );
    } finally {
      this.saving.set(false);
    }
  }
}
