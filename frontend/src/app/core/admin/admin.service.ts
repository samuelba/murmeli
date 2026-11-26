import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminSettings,
  AdminStats,
  AdminUser,
  AuditEntry,
  CreatedInvite,
  Invite,
  Paginated,
  Role,
} from '../api/models';
import { ApiService } from '../http/api.service';

export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  users(query: PageQuery & { search?: string }): Promise<Paginated<AdminUser>> {
    return firstValueFrom(this.api.get<Paginated<AdminUser>>('admin/users', { ...query }));
  }

  updateUser(id: string, patch: { role?: Role; disabled?: boolean }): Promise<AdminUser> {
    return firstValueFrom(
      this.api.patch<AdminUser>(`admin/users/${encodeURIComponent(id)}`, patch),
    );
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`admin/users/${encodeURIComponent(id)}`));
  }

  async resendVerification(id: string): Promise<void> {
    await firstValueFrom(
      this.api.post(`admin/users/${encodeURIComponent(id)}/resend-verification`),
    );
  }

  invites(query: PageQuery): Promise<Paginated<Invite>> {
    return firstValueFrom(this.api.get<Paginated<Invite>>('admin/invites', { ...query }));
  }

  createInvite(email: string, role: Role): Promise<CreatedInvite> {
    return firstValueFrom(this.api.post<CreatedInvite>('admin/invites', { email, role }));
  }

  async revokeInvite(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(`admin/invites/${encodeURIComponent(id)}`));
  }

  settings(): Promise<AdminSettings> {
    return firstValueFrom(this.api.get<AdminSettings>('admin/settings'));
  }

  async updateSettings(
    patch: Partial<Pick<AdminSettings, 'registrationEnabled' | 'requireAdminTotp'>>,
  ): Promise<void> {
    await firstValueFrom(this.api.patch('admin/settings', patch));
  }

  auditLog(query: PageQuery & { action?: string }): Promise<Paginated<AuditEntry>> {
    return firstValueFrom(this.api.get<Paginated<AuditEntry>>('admin/audit-log', { ...query }));
  }

  stats(): Promise<AdminStats> {
    return firstValueFrom(this.api.get<AdminStats>('admin/stats'));
  }
}
