import { HttpException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { PasswordService } from '../auth/passwords/password.service';
import type { KidEntity } from './kid.entity';
import type { CreateKidDto } from './kid.dto';
import { KidsService, kidNotFound, pinToSecret } from './kids.service';

const KID_ID = '01a218d7-5f49-7405-9a50-e2aba78ec51e';
const avatar = { animal: 'marmot', accessory: null, background: '#FFD8A8' };

function kidEntity(overrides: Partial<KidEntity> = {}): KidEntity {
  return {
    id: KID_ID,
    userId: 'u1',
    nickname: 'Zoë',
    avatar,
    startClass: 'KG1',
    birthYear: null,
    language: 'de-CH',
    pinHash: null,
    dailyLimitMinutes: null,
    soundEnabled: true,
    readAloud: 'auto',
    lastActiveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const createDto: CreateKidDto = {
  nickname: 'Zoë',
  avatar,
  startClass: 'KG1',
  language: 'de-CH',
};

function setup(existingKids = 0) {
  const kidsRepository = {
    find: jest.fn().mockResolvedValue([kidEntity()]),
    findOneBy: jest.fn().mockResolvedValue(kidEntity()),
    findOneByOrFail: jest.fn().mockResolvedValue(kidEntity()),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
  const txRepository = {
    create: jest.fn((value: Partial<KidEntity>) => value),
    save: jest.fn((value: Partial<KidEntity>) =>
      Promise.resolve(kidEntity(value)),
    ),
  };
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    countBy: jest.fn().mockResolvedValue(existingKids),
    getRepository: () => txRepository,
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
    query: jest.fn().mockResolvedValue([]),
  };
  const passwords = { hash: jest.fn().mockResolvedValue('argon2id$pin') };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new KidsService(
    kidsRepository as unknown as Repository<KidEntity>,
    dataSource as unknown as DataSource,
    passwords as unknown as PasswordService,
    audit as unknown as AuditService,
  );
  return {
    service,
    kidsRepository,
    txRepository,
    manager,
    passwords,
    audit,
    dataSource,
  };
}

async function errorCode(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return {
    status: (error as HttpException).getStatus(),
    code: ((error as HttpException).getResponse() as { errorCode: string })
      .errorCode,
  };
}

const actor = { userId: 'u1', ip: '203.0.113.9' };

describe('KidsService', () => {
  it('lists the kids of a user oldest first', async () => {
    const { service, kidsRepository } = setup();

    const kids = await service.list('u1');

    expect(kidsRepository.find).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      order: { createdAt: 'ASC' },
    });
    expect(kids[0]).toMatchObject({ id: KID_ID, hasPin: false });
  });

  it('only finds kids of the same user and ignores non-uuid ids', async () => {
    const { service, kidsRepository } = setup();

    await service.findOwned('u1', KID_ID);
    await expect(service.findOwned('u1', 'nope')).resolves.toBeNull();

    expect(kidsRepository.findOneBy).toHaveBeenCalledTimes(1);
    expect(kidsRepository.findOneBy).toHaveBeenCalledWith({
      id: KID_ID,
      userId: 'u1',
    });
  });

  it('throws 404 KID_NOT_FOUND for missing kids', async () => {
    const { service, kidsRepository } = setup();
    kidsRepository.findOneBy.mockResolvedValue(null);

    await expect(
      errorCode(service.requireOwned('u1', KID_ID)),
    ).resolves.toEqual({ status: 404, code: 'KID_NOT_FOUND' });
    await expect(errorCode(service.requireOwned('u1', '1'))).resolves.toEqual({
      status: 404,
      code: 'KID_NOT_FOUND',
    });
    expect(kidNotFound().getStatus()).toBe(404);
  });

  it('creates a kid with defaults under a row lock and audits without the nickname', async () => {
    const { service, txRepository, manager, audit } = setup(2);

    const kid = await service.create(actor, createDto);

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['u1'],
    );
    expect(txRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        pinHash: null,
        birthYear: null,
        dailyLimitMinutes: null,
        soundEnabled: true,
        readAloud: 'auto',
      }),
    );
    expect(kid.nickname).toBe('Zoë');
    expect(audit.record).toHaveBeenCalledWith({
      action: 'kid.created',
      actorId: 'u1',
      targetType: 'kid',
      targetId: KID_ID,
      ip: '203.0.113.9',
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('Zoë');
  });

  it('hashes the PIN as joined indexes', async () => {
    const { service, passwords, txRepository } = setup();

    await service.create(actor, {
      ...createDto,
      pin: [3, 1, 4, 1],
      birthYear: 2020,
      dailyLimitMinutes: 30,
      soundEnabled: false,
      readAloud: 'on',
    });

    expect(passwords.hash).toHaveBeenCalledWith('3-1-4-1');
    expect(txRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pinHash: 'argon2id$pin',
        birthYear: 2020,
        dailyLimitMinutes: 30,
        soundEnabled: false,
        readAloud: 'on',
      }),
    );
    expect(pinToSecret([0, 8])).toBe('0-8');
  });

  it('refuses a ninth kid with 400 KID_LIMIT', async () => {
    const { service, txRepository } = setup(8);

    await expect(errorCode(service.create(actor, createDto))).resolves.toEqual({
      status: 400,
      code: 'KID_LIMIT',
    });
    expect(txRepository.save).not.toHaveBeenCalled();
  });

  it('refuses unknown avatars with 400 AVATAR_INVALID', async () => {
    const { service } = setup();

    await expect(
      errorCode(
        service.create(actor, {
          ...createDto,
          avatar: { ...avatar, animal: 'velociraptor' },
        }),
      ),
    ).resolves.toEqual({ status: 400, code: 'AVATAR_INVALID' });
  });

  it('updates only the given fields', async () => {
    const { service, kidsRepository, passwords } = setup();

    await service.update('u1', KID_ID, {
      nickname: 'Max',
      pin: [1, 2, 3, 4],
      dailyLimitMinutes: null,
      avatar: { ...avatar, background: '#ffd8a8' },
    });

    expect(passwords.hash).toHaveBeenCalledWith('1-2-3-4');
    expect(kidsRepository.update).toHaveBeenCalledWith(
      { id: KID_ID },
      {
        nickname: 'Max',
        pinHash: 'argon2id$pin',
        dailyLimitMinutes: null,
        avatar: { ...avatar, background: '#FFD8A8' },
      },
    );
  });

  it('removes the PIN with pin: null', async () => {
    const { service, kidsRepository, passwords } = setup();

    await service.update('u1', KID_ID, { pin: null });

    expect(passwords.hash).not.toHaveBeenCalled();
    expect(kidsRepository.update).toHaveBeenCalledWith(
      { id: KID_ID },
      { pinHash: null },
    );
  });

  it('skips the write for an empty patch', async () => {
    const { service, kidsRepository } = setup();

    const kid = await service.update('u1', KID_ID, {});

    expect(kidsRepository.update).not.toHaveBeenCalled();
    expect(kid.id).toBe(KID_ID);
  });

  it('refuses updates of other users kids', async () => {
    const { service, kidsRepository } = setup();
    kidsRepository.findOneBy.mockResolvedValue(null);

    await expect(
      errorCode(service.update('u2', KID_ID, { nickname: 'X' })),
    ).resolves.toEqual({ status: 404, code: 'KID_NOT_FOUND' });
  });

  it('deletes a kid and audits it', async () => {
    const { service, kidsRepository, audit } = setup();

    await service.remove(actor, KID_ID);

    expect(kidsRepository.delete).toHaveBeenCalledWith({ id: KID_ID });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kid.deleted', targetId: KID_ID }),
    );
  });

  it('marks a kid active at most once a minute', async () => {
    const { service, dataSource } = setup();

    await service.markActive(KID_ID);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining(
        `"last_active_at" < now() - interval '60 seconds'`,
      ),
      [KID_ID],
    );
  });
});
