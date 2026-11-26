import type { EntityManager, Repository } from 'typeorm';
import type { UserEntity } from './user.entity';
import { toUserView } from './user.view';
import {
  UsersService,
  isUniqueViolation,
  normalizeEmail,
} from './users.service';

function repositoryMock() {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((value: Partial<UserEntity>) => ({ ...value })),
    save: jest.fn((value: Partial<UserEntity>) =>
      Promise.resolve({ id: 'u1', ...value }),
    ),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(3),
  };
}

function service() {
  const repository = repositoryMock();
  return {
    repository,
    users: new UsersService(repository as unknown as Repository<UserEntity>),
  };
}

describe('UsersService', () => {
  it('finds users by id and normalized email', async () => {
    const { users, repository } = service();

    await users.findById('u1');
    await users.findByEmail('  Anna@Example.com ');

    expect(repository.findOneBy).toHaveBeenNthCalledWith(1, { id: 'u1' });
    expect(repository.findOneBy).toHaveBeenNthCalledWith(2, {
      email: 'Anna@Example.com',
    });
  });

  it('creates parents by default, unverified', async () => {
    const { users, repository } = service();

    const user = await users.create({
      email: ' a@b.ch ',
      passwordHash: 'h',
      locale: 'de-CH',
    });

    expect(repository.create).toHaveBeenCalledWith({
      email: 'a@b.ch',
      passwordHash: 'h',
      locale: 'de-CH',
      role: 'parent',
      emailVerifiedAt: null,
    });
    expect(user.id).toBe('u1');
  });

  it('uses the transaction manager when given', async () => {
    const { users, repository } = service();
    const managerRepository = repositoryMock();
    const manager = {
      getRepository: () => managerRepository,
    } as unknown as EntityManager;
    const verifiedAt = new Date();

    await users.create(
      {
        email: 'a@b.ch',
        passwordHash: 'h',
        locale: 'en-US',
        role: 'admin',
        emailVerifiedAt: verifiedAt,
      },
      manager,
    );

    expect(managerRepository.save).toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(managerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', emailVerifiedAt: verifiedAt }),
    );
  });

  it('updates and returns the fresh user', async () => {
    const { users, repository } = service();
    repository.findOneBy.mockResolvedValue({ id: 'u1', locale: 'en-US' });

    await expect(users.update('u1', { locale: 'en-US' })).resolves.toEqual({
      id: 'u1',
      locale: 'en-US',
    });
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'u1' },
      { locale: 'en-US' },
    );
  });

  it('counts users', async () => {
    const { users } = service();

    await expect(users.count()).resolves.toBe(3);
  });
});

describe('helpers', () => {
  it('detects unique violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('normalizes emails to trimmed NFC', () => {
    expect(normalizeEmail(' zoë@example.com ')).toBe('zoë@example.com');
  });
});

describe('toUserView', () => {
  const base = {
    id: 'u1',
    email: 'a@b.ch',
    passwordHash: 'argon2id$secret',
    role: 'parent',
    locale: 'de-CH',
    theme: 'dark',
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    totpEnabled: true,
    disabled: false,
    lastLoginAt: null,
    createdAt: new Date('2025-12-31T00:00:00Z'),
    updatedAt: new Date(),
  } as UserEntity;

  it('exposes only the public fields', () => {
    expect(toUserView(base)).toEqual({
      id: 'u1',
      email: 'a@b.ch',
      role: 'parent',
      locale: 'de-CH',
      theme: 'dark',
      emailVerified: true,
      totpEnabled: true,
      createdAt: '2025-12-31T00:00:00.000Z',
    });
  });

  it('marks unverified users', () => {
    expect(toUserView({ ...base, emailVerifiedAt: null }).emailVerified).toBe(
      false,
    );
  });
});
