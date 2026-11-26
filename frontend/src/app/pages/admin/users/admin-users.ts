import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminUser, ROLES, Role } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { LanguageService } from '../../../core/i18n/language.service';
import { injectConfirm } from '../../../shared/confirm-dialog/confirm';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';

@Component({
  selector: 'mu-admin-users',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginator,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatIconButton,
    TranslocoPipe,
    FormError,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.html',
  styleUrl: '../admin-table.scss',
})
export class AdminUsers implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly confirm = injectConfirm();

  protected readonly language = inject(LanguageService).language;
  protected readonly currentUserId = inject(AuthService).user()?.id;
  protected readonly roles = ROLES;
  protected readonly columns = ['email', 'role', 'status', 'kids', 'lastLogin', 'actions'];
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly users = signal<readonly AdminUser[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorMessage | null>(null);

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.page.set(0);
        void this.load();
      });
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async onPage(event: PageEvent): Promise<void> {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    await this.load();
  }

  protected setRole(user: AdminUser, role: Role): Promise<void> {
    return this.patch(user, { role });
  }

  protected setDisabled(user: AdminUser, event: MatSlideToggleChange): Promise<void> {
    return this.patch(user, { disabled: !event.checked }, () => {
      event.source.checked = !user.disabled;
    });
  }

  protected async resend(user: AdminUser): Promise<void> {
    await this.act(async () => {
      await this.admin.resendVerification(user.id);
      this.notice.set('admin.users.resent');
    });
  }

  protected async remove(user: AdminUser): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'admin.users.deleteTitle',
      messageKey: 'admin.users.deleteMessage',
      confirmKey: 'common.delete',
      params: { email: user.email },
      danger: true,
      confirmText: user.email,
    });
    if (confirmed) {
      await this.act(async () => {
        await this.admin.deleteUser(user.id);
        await this.load();
      });
    }
  }

  private async patch(
    user: AdminUser,
    change: { role?: Role; disabled?: boolean },
    revert?: () => void,
  ): Promise<void> {
    const ok = await this.act(async () => {
      const updated = await this.admin.updateUser(user.id, change);
      this.users.update((users) => users.map((item) => (item.id === user.id ? updated : item)));
    });
    if (!ok) {
      revert?.();
      this.users.update((users) => [...users]);
    }
  }

  private async load(): Promise<void> {
    await this.act(async () => {
      const result = await this.admin.users({
        search: this.search.value.trim() || undefined,
        page: this.page() + 1,
        pageSize: this.pageSize(),
      });
      this.users.set(result.items);
      this.total.set(result.total);
    });
  }

  private async act(action: () => Promise<void>): Promise<boolean> {
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
      return true;
    } catch (error) {
      this.error.set(errorMessage(error));
      return false;
    }
  }
}
