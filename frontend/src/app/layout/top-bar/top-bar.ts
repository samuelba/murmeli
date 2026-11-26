import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND_NAME } from '../../core/brand';
import { Logo } from '../../shared/logo/logo';
import { LanguageSwitch } from '../language-switch/language-switch';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'mu-top-bar',
  imports: [RouterLink, TranslocoPipe, Logo, ThemeToggle, LanguageSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  protected readonly brandName = BRAND_NAME;
}
