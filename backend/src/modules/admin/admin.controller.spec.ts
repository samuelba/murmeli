import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Request } from 'express';
import type { DataSource } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { InviteService } from '../auth/invites/invite.service';
import type { AuthMailer } from '../auth/services/auth-mailer';
import type { RegistrationService } from '../auth/services/registration.service';
import type { SettingsService } from '../settings/settings.service';
import type { UsersService } from '../users/users.service';
import {
  AuditLogQuery,
  CreateInviteDto,
  UpdateSettingsDto,
  UpdateUserDto,
  UserSearchQuery,
} from './admin.dto';
import { AdminController } from './admin.controller';
import { AdminOverviewService, STATS_SQL } from './admin-overview.service';
import { AdminUsersController } from './admin-users.controller';
import type { AdminRecoveryService } from './admin-recovery.service';
import type { AdminUsersService } from './admin-users.service';

const auth = { userId: 'a1', role: 'admin' as const, familyId: 'fam' };
const request = { ip: '203.0.113.4', headers: {} } as unknown as Request;
const actor = { userId: 'a1', ip: '203.0.113.4' };

function errorsFor(dto: new () => object, raw: Record<string, unknown>) {
  return validateSync(plainToInstance(dto, raw)).map((e) => e.property);
}

describe('admin DTOs', () => {
  it('validates the user search query', () => {
    expect(errorsFor(UserSearchQuery, { search: ' anna ', page: '1' })).toEqual(
      [],
    );
    expect(plainToInstance(UserSearchQuery, { search: ' anna ' }).search).toBe(
      'anna',
    );
    expect(errorsFor(UserSearchQuery, { search: 'x'.repeat(255) })).toEqual([
      'search',
    ]);
  });

  it('validates the audit action filter', () => {
    expect(errorsFor(AuditLogQuery, { action: 'auth.login' })).toEqual([]);
    expect(errorsFor(AuditLogQuery, { action: 'auth.nope' })).toEqual([
      'action',
    ]);
  });

  it('validates user, invite and settings changes', () => {
    expect(errorsFor(UpdateUserDto, { role: 'admin', disabled: true })).toEqual(
      [],
    );
    expect(errorsFor(UpdateUserDto, { role: 'root' })).toEqual(['role']);
    expect(
      errorsFor(CreateInviteDto, { email: 'a@b.ch', role: 'parent' }),
    ).toEqual([]);
    expect(
      errorsFor(CreateInviteDto, { email: 'nope', role: 'x' }).sort(),
    ).toEqual(['email', 'role']);
    expect(
      errorsFor(UpdateSettingsDto, { registrationEnabled: 'yes' }),
    ).toEqual(['registrationEnabled']);
  });
});

describe('AdminOverviewService', () => {
  function setup() {
    const settings = {
      accessSettings: jest.fn().mockResolvedValue({
        registrationEnabled: true,
        requireAdminTotp: false,
      }),
      update: jest.fn().mockResolvedValue({
        registrationEnabled: false,
        requireAdminTotp: true,
      }),
    };
    const mailer = { enabled: true };
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValue([{ users: 3, kids: 4, activeKidsLast7Days: 2 }]),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminOverviewService(
      settings as unknown as SettingsService,
      mailer as unknown as AuthMailer,
      dataSource as unknown as DataSource,
      audit as unknown as AuditService,
    );
    return { service, settings, dataSource, audit };
  }

  it('reports settings with emailEnabled', async () => {
    await expect(setup().service.settingsView()).resolves.toEqual({
      registrationEnabled: true,
      requireAdminTotp: false,
      emailEnabled: true,
    });
  });

  it('updates settings and audits only the changed keys', async () => {
    const { service, settings, audit } = setup();

    const result = await service.updateSettings('a1', '203.0.113.4', {
      requireAdminTotp: true,
      registrationEnabled: undefined,
    });

    expect(settings.update).toHaveBeenCalled();
    expect(result).toEqual({
      registrationEnabled: false,
      requireAdminTotp: true,
      emailEnabled: true,
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'admin.settings_updated',
      actorId: 'a1',
      targetType: 'setting',
      ip: '203.0.113.4',
      meta: { requireAdminTotp: true },
    });
  });

  it('returns counts only', async () => {
    const { service, dataSource } = setup();

    await expect(service.stats()).resolves.toEqual({
      users: 3,
      kids: 4,
      activeKidsLast7Days: 2,
    });
    expect(dataSource.query).toHaveBeenCalledWith(STATS_SQL);
    expect(STATS_SQL).not.toContain('nickname');
  });
});

describe('AdminController', () => {
  it('delegates to the overview and audit services', async () => {
    const overview = {
      settingsView: jest.fn().mockResolvedValue({}),
      updateSettings: jest.fn().mockResolvedValue({}),
      stats: jest.fn().mockResolvedValue({}),
    };
    const audit = { list: jest.fn().mockResolvedValue({ items: [] }) };
    const controller = new AdminController(
      overview as unknown as AdminOverviewService,
      audit as unknown as AuditService,
    );

    await controller.settings();
    await controller.updateSettings(
      auth,
      { registrationEnabled: true },
      request,
    );
    await controller.stats();
    await controller.auditLog({ action: 'auth.login' });

    expect(overview.updateSettings).toHaveBeenCalledWith('a1', '203.0.113.4', {
      registrationEnabled: true,
    });
    expect(audit.list).toHaveBeenCalledWith({ action: 'auth.login' });
  });
});

describe('AdminUsersController', () => {
  function setup(revoked = true) {
    const adminUsers = {
      list: jest.fn().mockResolvedValue({ items: [] }),
      update: jest.fn().mockResolvedValue({ id: 'u1' }),
      delete: jest.fn().mockResolvedValue(undefined),
      recordInvite: jest.fn().mockResolvedValue(undefined),
    };
    const registration = {
      resendForUser: jest.fn().mockResolvedValue(undefined),
    };
    const invites = {
      list: jest.fn().mockResolvedValue({ items: [] }),
      create: jest.fn().mockResolvedValue({ invite: { id: 'i1' } }),
      revoke: jest.fn().mockResolvedValue(revoked),
    };
    const users = {
      findById: jest.fn().mockResolvedValue({ locale: 'en-US' }),
    };
    const recovery = {
      passwordResetLink: jest.fn().mockResolvedValue({ resetUrl: 'url' }),
      verifyEmail: jest.fn().mockResolvedValue({ id: 'u1' }),
    };
    const controller = new AdminUsersController(
      adminUsers as unknown as AdminUsersService,
      registration as unknown as RegistrationService,
      invites as unknown as InviteService,
      users as unknown as UsersService,
      recovery as unknown as AdminRecoveryService,
    );
    return { controller, adminUsers, registration, invites, users, recovery };
  }

  it('manages users', async () => {
    const { controller, adminUsers, registration } = setup();

    await controller.listUsers({ search: 'a' });
    await controller.updateUser(auth, 'u1', { disabled: true }, request);
    await controller.deleteUser(auth, 'u1', request);
    await expect(controller.resendVerification('u1')).resolves.toEqual({
      ok: true,
    });

    expect(adminUsers.update).toHaveBeenCalledWith(actor, 'u1', {
      disabled: true,
    });
    expect(adminUsers.delete).toHaveBeenCalledWith(actor, 'u1');
    expect(registration.resendForUser).toHaveBeenCalledWith('u1');
  });

  it('hands out reset links and verifies addresses as the admin', async () => {
    const { controller, recovery } = setup();

    await expect(
      controller.passwordResetLink(auth, 'u1', request),
    ).resolves.toEqual({ resetUrl: 'url' });
    await expect(controller.verifyEmail(auth, 'u1', request)).resolves.toEqual({
      id: 'u1',
    });

    expect(recovery.passwordResetLink).toHaveBeenCalledWith(actor, 'u1');
    expect(recovery.verifyEmail).toHaveBeenCalledWith(actor, 'u1');
  });

  it('creates invites in the admin locale and audits them', async () => {
    const { controller, invites, adminUsers } = setup();

    await controller.createInvite(
      auth,
      { email: 'n@example.com', role: 'parent' },
      request,
    );

    expect(invites.create).toHaveBeenCalledWith(
      'n@example.com',
      'parent',
      'a1',
      'en-US',
    );
    expect(adminUsers.recordInvite).toHaveBeenCalledWith(
      'admin.invite_created',
      actor,
      'i1',
      { role: 'parent' },
    );
  });

  it('falls back to de-CH when the admin is gone', async () => {
    const { controller, invites, users } = setup();
    users.findById.mockResolvedValue(null);

    await controller.createInvite(
      auth,
      { email: 'n@example.com', role: 'admin' },
      request,
    );

    expect(invites.create).toHaveBeenCalledWith(
      'n@example.com',
      'admin',
      'a1',
      'de-CH',
    );
  });

  it('lists and revokes invites', async () => {
    const { controller, invites, adminUsers } = setup();

    await controller.listInvites({ page: 1 });
    await controller.revokeInvite(auth, 'i1', request);

    expect(invites.list).toHaveBeenCalledWith({ page: 1 });
    expect(adminUsers.recordInvite).toHaveBeenCalledWith(
      'admin.invite_revoked',
      actor,
      'i1',
    );
  });

  it('answers 404 INVITE_INVALID for an unknown invite', async () => {
    const { controller, adminUsers } = setup(false);

    const error = await controller
      .revokeInvite(auth, 'nope', request)
      .catch((e: unknown) => e as HttpException);

    expect((error as HttpException).getStatus()).toBe(404);
    expect(adminUsers.recordInvite).not.toHaveBeenCalled();
  });
});
