import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import {
  generateSecureToken,
  sha256Hex,
} from '../../../common/crypto/secure-token';
import { errorMessage } from '../../../common/errors/error-message';
import { addSeconds, durationToSeconds } from '../../../common/time/duration';
import type { Env } from '../../../config/env.schema';
import { REDIS_CLIENT } from '../../../redis/redis.options';
import { UserEntity } from '../../users/user.entity';
import {
  RefreshTokenEntity,
  type RevocationReason,
} from '../entities/refresh-token.entity';

export interface NewSession {
  readonly familyId: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

export type RotationResult =
  | {
      readonly status: 'rotated';
      readonly user: UserEntity;
      readonly session: NewSession;
    }
  | { readonly status: 'expired' }
  | { readonly status: 'compromised'; readonly userId: string };

export const FAMILY_CACHE_PREFIX = 'murmeli:fam:';
export const ACTIVE_CACHE_SECONDS = 30;
export const REVOKED_CACHE_SECONDS = 24 * 3600;

const FAMILY_ACTIVE_SQL = `SELECT EXISTS (
  SELECT 1 FROM "refresh_tokens"
  WHERE "family_id" = $1 AND "revoked" = false AND "expires_at" > now()
) AS "active"`;

class ConcurrentRotationError extends Error {}

/**
 * Refresh token families: every login starts a family, every refresh rotates
 * the token within it, and presenting a rotated token again revokes the whole
 * family. JWT cookies carry the family id (`fam`), so revoking a family
 * invalidates them too.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTtlSeconds: number;

  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokens: Repository<RefreshTokenEntity>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'get' | 'set'>,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlSeconds = durationToSeconds(
      config.get('JWT_REFRESH_EXPIRATION', { infer: true }),
    );
  }

  async start(userId: string, userAgent: string | null): Promise<NewSession> {
    const familyId = randomUUID();
    const session = this.newToken(familyId);
    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: sha256Hex(session.refreshToken),
      userAgent,
      expiresAt: session.refreshExpiresAt,
    });
    return session;
  }

  async rotate(
    refreshToken: string,
    userAgent: string | null,
  ): Promise<RotationResult> {
    const stored = await this.tokens.findOne({
      where: { tokenHash: sha256Hex(refreshToken) },
      relations: { user: true },
    });
    if (!stored?.user || stored.expiresAt.getTime() <= Date.now()) {
      return { status: 'expired' };
    }
    if (stored.revoked) {
      return stored.revokedReason === 'rotated'
        ? this.compromised(stored)
        : { status: 'expired' };
    }
    if (stored.user.disabled) {
      await this.revokeFamily(stored.familyId, 'disabled');
      return { status: 'expired' };
    }
    try {
      const session = await this.replace(stored, userAgent);
      return { status: 'rotated', user: stored.user, session };
    } catch (error) {
      if (error instanceof ConcurrentRotationError) {
        return this.compromised(stored);
      }
      throw error;
    }
  }

  async findFamily(refreshToken: string): Promise<RefreshTokenEntity | null> {
    return this.tokens.findOneBy({ tokenHash: sha256Hex(refreshToken) });
  }

  async revokeFamily(
    familyId: string,
    reason: RevocationReason,
  ): Promise<void> {
    await this.tokens.update(
      { familyId, revoked: false },
      { revoked: true, revokedReason: reason },
    );
    await this.cacheFamily(familyId, false);
  }

  /**
   * Revokes every family of the user, except `keepFamilyId` when given.
   */
  async revokeUserSessions(
    userId: string,
    reason: RevocationReason,
    keepFamilyId?: string,
  ): Promise<void> {
    const families = await this.revokeUserSessionsIn(
      this.dataSource.manager,
      userId,
      reason,
      keepFamilyId,
    );
    await this.markRevoked(families);
  }

  /**
   * Revokes the user's families inside the caller's transaction. Call
   * `markRevoked` with the result once the transaction has committed.
   */
  async revokeUserSessionsIn(
    manager: Pick<EntityManager, 'query'>,
    userId: string,
    reason: RevocationReason,
    keepFamilyId?: string,
  ): Promise<string[]> {
    const rows = await manager.query<[{ family_id: string }[], number]>(
      `UPDATE "refresh_tokens" SET "revoked" = true, "revoked_reason" = $2
       WHERE "user_id" = $1 AND "revoked" = false
         AND ($3::uuid IS NULL OR "family_id" <> $3::uuid)
       RETURNING "family_id"`,
      [userId, reason, keepFamilyId ?? null],
    );
    return [...new Set(rows[0].map((row) => row.family_id))];
  }

  async markRevoked(familyIds: readonly string[]): Promise<void> {
    await Promise.all(
      familyIds.map((familyId) => this.cacheFamily(familyId, false)),
    );
  }

  async isFamilyActive(familyId: string): Promise<boolean> {
    const cached = await this.readCache(familyId);
    if (cached !== null) {
      return cached;
    }
    const [row] = await this.dataSource.query<{ active: boolean }[]>(
      FAMILY_ACTIVE_SQL,
      [familyId],
    );
    const active = row?.active === true;
    await this.cacheFamily(familyId, active);
    return active;
  }

  private newToken(familyId: string): NewSession {
    const { token } = generateSecureToken();
    return {
      familyId,
      refreshToken: token,
      refreshExpiresAt: addSeconds(new Date(), this.refreshTtlSeconds),
    };
  }

  private async replace(
    stored: RefreshTokenEntity,
    userAgent: string | null,
  ): Promise<NewSession> {
    const session = this.newToken(stored.familyId);
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenEntity);
      const inserted = await repository.insert({
        userId: stored.userId,
        familyId: stored.familyId,
        tokenHash: sha256Hex(session.refreshToken),
        userAgent,
        expiresAt: session.refreshExpiresAt,
      });
      const replacedBy = (inserted.identifiers[0] as { id: string }).id;
      const result = await repository.update(
        { id: stored.id, revoked: false },
        { revoked: true, revokedReason: 'rotated', replacedBy },
      );
      if ((result.affected ?? 0) === 0) {
        throw new ConcurrentRotationError();
      }
    });
    return session;
  }

  private async compromised(
    stored: RefreshTokenEntity,
  ): Promise<RotationResult> {
    await this.revokeFamily(stored.familyId, 'compromised');
    this.logger.warn(
      `Refresh token reuse detected, family ${stored.familyId} of user ${stored.userId} revoked`,
    );
    return { status: 'compromised', userId: stored.userId };
  }

  private async readCache(familyId: string): Promise<boolean | null> {
    try {
      const value = await this.redis.get(`${FAMILY_CACHE_PREFIX}${familyId}`);
      return value === null ? null : value === '1';
    } catch (error) {
      this.logger.warn(`Family cache unavailable: ${errorMessage(error)}`);
      return null;
    }
  }

  private async cacheFamily(familyId: string, active: boolean): Promise<void> {
    const key = `${FAMILY_CACHE_PREFIX}${familyId}`;
    try {
      if (active) {
        await this.redis.set(key, '1', 'EX', ACTIVE_CACHE_SECONDS, 'NX');
      } else {
        await this.redis.set(key, '0', 'EX', REVOKED_CACHE_SECONDS);
      }
    } catch (error) {
      this.logger.warn(`Family cache unavailable: ${errorMessage(error)}`);
    }
  }
}
