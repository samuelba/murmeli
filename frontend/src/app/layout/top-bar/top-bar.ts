import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND_NAME } from '../../core/brand';
import { KidMode } from '../../core/kids/kid-mode';
import { Logo } from '../../shared/logo/logo';
import { LanguageSwitch } from '../language-switch/language-switch';
import { SessionMenu } from '../session-menu/session-menu';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'mu-top-bar',
  imports: [RouterLink, TranslocoPipe, Logo, ThemeToggle, LanguageSwitch, SessionMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  protected readonly brandName = BRAND_NAME;
  protected readonly kidMode = inject(KidMode).active;
}
