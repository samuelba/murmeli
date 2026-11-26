import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuditLogEntity } from './audit-log.entity';
import { AuditService, toAuditEntryView } from './audit.service';

function service() {
  const repository = {
    insert: jest.fn().mockResolvedValue({}),
    findAndCount: jest.fn(),
  };
  return {
    repository,
    audit: new AuditService(
      repository as unknown as Repository<AuditLogEntity>,
    ),
  };
}

const entry = {
  id: 'e1',
  at: new Date('2026-01-02T03:04:05Z'),
  actorId: 'u1',
  action: 'auth.login',
  targetType: 'user',
  targetId: 'u1',
  ip: '203.0.113.0',
  meta: { method: 'password' },
} as AuditLogEntity;

describe('AuditService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores the shortened ip and defaults the optional fields', async () => {
    const { audit, repository } = service();

    await audit.record({ action: 'auth.logout', ip: '203.0.113.99' });

    expect(repository.insert).toHaveBeenCalledWith({
      action: 'auth.logout',
      actorId: null,
      targetType: null,
      targetId: null,
      ip: '203.0.113.0',
      meta: null,
    });
  });

  it('keeps the given fields', async () => {
    const { audit, repository } = service();

    await audit.record({
      action: 'kid.created',
      actorId: 'u1',
      targetType: 'kid',
      targetId: 'k1',
      ip: '2001:db8:1:2::5',
      meta: { a: 1 },
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        targetType: 'kid',
        targetId: 'k1',
        ip: '2001:db8:1::',
        meta: { a: 1 },
      }),
    );
  });

  it('never throws when the write fails', async () => {
    const { audit, repository } = service();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    repository.insert.mockRejectedValue(new Error('db down'));

    await expect(
      audit.record({ action: 'auth.login' }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('lists entries newest first with an optional action filter', async () => {
    const { audit, repository } = service();
    repository.findAndCount.mockResolvedValue([[entry], 21]);

    const page = await audit.list({
      page: 2,
      pageSize: 20,
      action: 'auth.login',
    });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: { action: 'auth.login' },
      order: { at: 'DESC', id: 'DESC' },
      skip: 20,
      take: 20,
    });
    expect(page).toEqual({
      items: [toAuditEntryView(entry)],
      total: 21,
      page: 2,
      pageSize: 20,
    });
  });

  it('lists everything without a filter', async () => {
    const { audit, repository } = service();
    repository.findAndCount.mockResolvedValue([[], 0]);

    await audit.list({});

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0 }),
    );
  });

  it('maps entries to the API view', () => {
    expect(toAuditEntryView(entry)).toEqual({
      id: 'e1',
      at: '2026-01-02T03:04:05.000Z',
      actorId: 'u1',
      action: 'auth.login',
      targetType: 'user',
      targetId: 'u1',
      ip: '203.0.113.0',
      meta: { method: 'password' },
    });
  });
});
