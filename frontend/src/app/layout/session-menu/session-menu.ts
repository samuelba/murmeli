import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors/error-message';
import { KidMode } from '../../core/kids/kid-mode';
import { AvatarView } from '../../shared/avatar/avatar';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'mu-session-menu',
  imports: [
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    RouterLink,
    TranslocoPipe,
    AvatarView,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-menu.html',
  styleUrl: './session-menu.scss',
})
export class SessionMenu {
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly kid = inject(KidMode).kid;
  protected readonly busy = signal(false);

  protected async logout(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      const message = errorMessage(error);
      this.snackBar.open(
        `${this.transloco.translate('nav.logoutFailed')} ${this.transloco.translate(message.key, message.params)}`,
        this.transloco.translate('common.close'),
        { duration: 8000, politeness: 'assertive' },
      );
    } finally {
      this.busy.set(false);
    }
  }
}
