import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { AUDIT_ACTIONS, AuditEntry } from '../../../core/api/models';
import { AdminService } from '../../../core/admin/admin.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { LanguageService } from '../../../core/i18n/language.service';
import { FormError } from '../../../shared/form-error/form-error';

@Component({
  selector: 'mu-admin-audit',
  imports: [
    DatePipe,
    JsonPipe,
    MatTableModule,
    MatPaginator,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    TranslocoPipe,
    FormError,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-stack">
      <mat-form-field appearance="outline" class="search">
        <mat-label>{{ 'admin.audit.filter' | transloco }}</mat-label>
        <mat-select [value]="action()" (valueChange)="filter($event)" data-testid="audit-filter">
          <mat-option value="">{{ 'admin.audit.all' | transloco }}</mat-option>
          @for (option of actions; track option) {
            <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mu-form-error [error]="error()" />
      <div class="table-wrap" tabindex="0" [attr.aria-label]="'admin.nav_audit' | transloco">
        <table mat-table [dataSource]="entries()" data-testid="audit-table">
          <ng-container matColumnDef="at">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.at' | transloco }}</th>
            <td mat-cell *matCellDef="let entry">
              {{ entry.at | date: 'short' : undefined : language() }}
            </td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.action' | transloco }}</th>
            <td mat-cell *matCellDef="let entry" class="mu-code">{{ entry.action }}</td>
          </ng-container>
          <ng-container matColumnDef="target">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.target' | transloco }}</th>
            <td mat-cell *matCellDef="let entry" class="mu-code">
              {{ entry.targetType ?? '–' }} {{ entry.targetId ?? '' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="ip">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.ip' | transloco }}</th>
            <td mat-cell *matCellDef="let entry" class="mu-code">{{ entry.ip ?? '–' }}</td>
          </ng-container>
          <ng-container matColumnDef="meta">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.meta' | transloco }}</th>
            <td mat-cell *matCellDef="let entry" class="mu-code">
              {{ entry.meta ? (entry.meta | json) : '' }}
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
        [pageSizeOptions]="[20, 50, 100]"
        (page)="onPage($event)"
      />
    </div>
  `,
  styleUrl: '../admin-table.scss',
})
export class AdminAudit implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly language = inject(LanguageService).language;
  protected readonly actions = AUDIT_ACTIONS;
  protected readonly columns = ['at', 'action', 'target', 'ip', 'meta'];
  protected readonly entries = signal<readonly AuditEntry[]>([]);
  protected readonly action = signal('');
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(50);
  protected readonly error = signal<ErrorMessage | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async filter(action: string): Promise<void> {
    this.action.set(action);
    this.page.set(0);
    await this.load();
  }

  protected async onPage(event: PageEvent): Promise<void> {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    await this.load();
  }

  private async load(): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.admin.auditLog({
        page: this.page() + 1,
        pageSize: this.pageSize(),
        action: this.action() || undefined,
      });
      this.entries.set(result.items);
      this.total.set(result.total);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
