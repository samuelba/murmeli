import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import type { Locale, Role } from './user.types';

export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly locale: Locale;
  readonly role?: Role;
  readonly emailVerifiedAt?: Date | null;
}

export type UserChanges = Partial<
  Pick<
    UserEntity,
    | 'email'
    | 'passwordHash'
    | 'role'
    | 'locale'
    | 'theme'
    | 'emailVerifiedAt'
    | 'totpEnabled'
    | 'disabled'
    | 'lastLoginAt'
  >
>;

export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC');
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ email: normalizeEmail(email) });
  }

  async create(user: NewUser, manager?: EntityManager): Promise<UserEntity> {
    const repository = manager?.getRepository(UserEntity) ?? this.repository;
    return repository.save(
      repository.create({
        email: normalizeEmail(user.email),
        passwordHash: user.passwordHash,
        locale: user.locale,
        role: user.role ?? 'parent',
        emailVerifiedAt: user.emailVerifiedAt ?? null,
      }),
    );
  }

  async update(id: string, changes: UserChanges): Promise<UserEntity | null> {
    await this.repository.update({ id }, changes);
    return this.findById(id);
  }

  count(): Promise<number> {
    return this.repository.count();
  }
}
