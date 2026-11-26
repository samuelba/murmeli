import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'mu-theme-toggle',
  imports: [MatIconButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  protected readonly isDark = this.theme.isDark;
  protected readonly labelKey = computed(() =>
    this.isDark() ? 'theme.switchToLight' : 'theme.switchToDark',
  );

  protected toggle(): void {
    this.theme.toggle();
  }
}
