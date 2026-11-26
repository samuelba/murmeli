import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemePreference } from '../../../core/api/models';
import { AccountService } from '../../../core/account/account.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { LanguageService } from '../../../core/i18n/language.service';
import { LANGUAGES, Language } from '../../../core/i18n/languages';
import { ThemeService } from '../../../core/theme/theme.service';
import { FormError } from '../../../shared/form-error/form-error';

@Component({
  selector: 'mu-preferences-section',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, TranslocoPipe, FormError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="prefs-heading" class="mu-section-title">{{ 'account.preferences' | transloco }}</h2>
    <div class="fields">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.locale' | transloco }}</mat-label>
        <mat-select
          [value]="language()"
          (valueChange)="setLanguage($event)"
          data-testid="pref-language"
        >
          @for (option of languages; track option) {
            <mat-option [value]="option">{{ 'language.' + option | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'account.theme' | transloco }}</mat-label>
        <mat-select [value]="theme()" (valueChange)="setTheme($event)" data-testid="pref-theme">
          @for (option of themes; track option) {
            <mat-option [value]="option">{{ 'account.themes.' + option | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    <p class="mu-muted" role="status">
      @if (saved()) {
        {{ 'common.saved' | transloco }}
      }
    </p>
    <mu-form-error [error]="error()" />
  `,
  styles: `
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0 var(--mu-space-3);
    }
  `,
})
export class PreferencesSection {
  private readonly account = inject(AccountService);
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  protected readonly languages = LANGUAGES;
  protected readonly themes: readonly ThemePreference[] = ['system', 'light', 'dark'];
  protected readonly language = this.languageService.language;
  protected readonly theme = this.themeService.mode;
  protected readonly saved = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  protected async setLanguage(locale: Language): Promise<void> {
    this.languageService.setLanguage(locale);
    await this.persist({ locale });
  }

  protected async setTheme(theme: ThemePreference): Promise<void> {
    this.themeService.setMode(theme);
    await this.persist({ theme });
  }

  private async persist(preferences: { locale?: Language; theme?: ThemePreference }) {
    this.saved.set(false);
    this.error.set(null);
    try {
      await this.account.updatePreferences(preferences);
      this.saved.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
