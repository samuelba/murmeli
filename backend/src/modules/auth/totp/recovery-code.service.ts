import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'node:crypto';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { sha256Hex } from '../../../common/crypto/secure-token';
import { RecoveryCodeEntity } from '../entities/recovery-code.entity';

export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(normalizeRecoveryCode(code));
}

function randomGroup(): string {
  return Array.from(
    { length: GROUP_LENGTH },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join('');
}

export function generateRecoveryCode(): string {
  return Array.from({ length: GROUPS }, randomGroup).join('-');
}

/**
 * Ten single-use recovery codes per user (about 60 bits each), stored as
 * SHA-256 hashes and redeemed atomically.
 */
@Injectable()
export class RecoveryCodeService {
  constructor(
    @InjectRepository(RecoveryCodeEntity)
    private readonly repository: Repository<RecoveryCodeEntity>,
  ) {}

  async replace(userId: string, manager?: EntityManager): Promise<string[]> {
    const repository =
      manager?.getRepository(RecoveryCodeEntity) ?? this.repository;
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) {
      codes.add(generateRecoveryCode());
    }
    await repository.delete({ userId });
    await repository.insert(
      [...codes].map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    );
    return [...codes];
  }

  async consume(userId: string, code: string): Promise<boolean> {
    if (normalizeRecoveryCode(code).length !== GROUPS * GROUP_LENGTH) {
      return false;
    }
    const result = await this.repository.update(
      { userId, codeHash: hashRecoveryCode(code), usedAt: IsNull() },
      { usedAt: new Date() },
    );
    return (result.affected ?? 0) === 1;
  }

  async removeAll(userId: string, manager?: EntityManager): Promise<void> {
    const repository =
      manager?.getRepository(RecoveryCodeEntity) ?? this.repository;
    await repository.delete({ userId });
  }
}
