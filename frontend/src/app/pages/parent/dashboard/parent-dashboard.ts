import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Kid } from '../../../core/api/models';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { KidsService } from '../../../core/kids/kids.service';
import { AvatarView } from '../../../shared/avatar/avatar';
import { injectConfirm } from '../../../shared/confirm-dialog/confirm';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { PageCard } from '../../../shared/page-card/page-card';
import { MAX_KIDS } from '../../profile-picker/profile-picker';

@Component({
  selector: 'mu-parent-dashboard',
  imports: [
    RouterLink,
    MatButton,
    MatIconButton,
    TranslocoPipe,
    AvatarView,
    FormError,
    Icon,
    PageCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-dashboard.html',
  styleUrl: './parent-dashboard.scss',
})
export class ParentDashboard implements OnInit {
  private readonly kidsService = inject(KidsService);
  private readonly confirm = injectConfirm();

  protected readonly maxKids = MAX_KIDS;
  protected readonly kids = signal<readonly Kid[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ErrorMessage | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async remove(kid: Kid): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'parent.deleteKidTitle',
      messageKey: 'parent.deleteKidMessage',
      confirmKey: 'common.delete',
      params: { name: kid.nickname },
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.kidsService.remove(kid.id);
      this.kids.update((kids) => kids.filter((item) => item.id !== kid.id));
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.kids.set(await this.kidsService.list());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
