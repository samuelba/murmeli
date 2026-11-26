import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
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

  protected readonly languages = LANGUAGES;
  protected readonly shortLabels = SHORT_LABELS;
  protected readonly language = this.languageService.language;

  protected select(value: unknown): void {
    if (isLanguage(value)) {
      this.languageService.setLanguage(value);
    }
  }
}
