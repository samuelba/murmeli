import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Invite } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { LanguageService } from '../../../core/i18n/language.service';
import { injectConfirm } from '../../../shared/confirm-dialog/confirm';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { InviteDialog } from './invite-dialog';

@Component({
  selector: 'mu-admin-invites',
  imports: [
    DatePipe,
    MatTableModule,
    MatPaginator,
    MatButton,
    MatIconButton,
    TranslocoPipe,
    FormError,
    Icon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-stack">
      <div class="toolbar">
        <h2 class="mu-section-title">{{ 'admin.invites.title' | transloco }}</h2>
        <button matButton="filled" type="button" data-testid="create-invite" (click)="create()">
          <mu-icon name="add" /> {{ 'admin.invites.create' | transloco }}
        </button>
      </div>
      <mu-form-error [error]="error()" />
      <div class="table-wrap" tabindex="0" [attr.aria-label]="'admin.invites.title' | transloco">
        <table mat-table [dataSource]="invites()" data-testid="invites-table">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'fields.email' | transloco }}</th>
            <td mat-cell *matCellDef="let invite">{{ invite.email }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.role' | transloco }}</th>
            <td mat-cell *matCellDef="let invite">{{ 'roles.' + invite.role | transloco }}</td>
          </ng-container>
          <ng-container matColumnDef="expires">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.invites.expires' | transloco }}</th>
            <td mat-cell *matCellDef="let invite">
              {{ invite.expiresAt | date: 'short' : undefined : language() }}
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="mu-visually-hidden">{{ 'admin.actions' | transloco }}</span>
            </th>
            <td mat-cell *matCellDef="let invite" class="actions">
              <button
                matIconButton
                type="button"
                class="danger-icon"
                [attr.aria-label]="'admin.invites.revoke' | transloco: { email: invite.email }"
                (click)="revoke(invite)"
              >
                <mu-icon name="delete" />
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
          <tr class="mat-mdc-row" *matNoDataRow>
            <td class="mat-mdc-cell" [attr.colspan]="columns.length">
              {{ 'admin.empty' | transloco }}
            </td>
          </tr>
        </table>
      </div>
      <mat-paginator
        [length]="total()"
        [pageIndex]="page()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 20, 50, 100]"
        (page)="onPage($event)"
      />
    </div>
  `,
  styleUrl: '../admin-table.scss',
})
export class AdminInvites implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = injectConfirm();

  protected readonly language = inject(LanguageService).language;
  protected readonly columns = ['email', 'role', 'expires', 'actions'];
  protected readonly invites = signal<readonly Invite[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly error = signal<ErrorMessage | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async create(): Promise<void> {
    const ref = this.dialog.open(InviteDialog, {
      width: 'min(520px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
    });
    await firstValueFrom(ref.afterClosed());
    await this.load();
  }

  protected async revoke(invite: Invite): Promise<void> {
    const confirmed = await this.confirm({
      titleKey: 'admin.invites.revokeTitle',
      messageKey: 'admin.invites.revokeMessage',
      confirmKey: 'admin.invites.revokeConfirm',
      params: { email: invite.email },
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.admin.revokeInvite(invite.id);
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  protected async onPage(event: PageEvent): Promise<void> {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    await this.load();
  }

  private async load(): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.admin.invites({ page: this.page() + 1, pageSize: this.pageSize() });
      this.invites.set(result.items);
      this.total.set(result.total);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
