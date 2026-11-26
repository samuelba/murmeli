import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  generateSecureToken,
  sha256Hex,
} from '../../../common/crypto/secure-token';
import { addSeconds } from '../../../common/time/duration';
import { EMAIL_TOKEN_TTL_SECONDS } from '../auth.constants';
import {
  EmailTokenEntity,
  type EmailTokenType,
} from '../entities/email-token.entity';

export interface ConsumedToken {
  readonly userId: string;
  readonly type: EmailTokenType;
  readonly newEmail: string | null;
}

export type Querier = Pick<EntityManager, 'query'>;

const MAX_TOKEN_LENGTH = 128;

interface TokenRow {
  readonly user_id: string;
  readonly type: EmailTokenType;
  readonly new_email: string | null;
}

const INVALIDATE_SQL = `UPDATE "email_tokens" SET "used_at" = now()
  WHERE "user_id" = $1 AND "used_at" IS NULL
    AND ($2::text IS NULL OR "type" = $2::text)`;

/**
 * Single-use email tokens (verification, password reset, email change):
 * 32 random bytes in the link, only the SHA-256 hash in the database. At most
 * one open token per user and type exists (partial unique index).
 */
@Injectable()
export class EmailTokenService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Issues a new token and invalidates the user's open one of that type, in
   * one transaction serialised on the user row.
   */
  issue(
    userId: string,
    type: EmailTokenType,
    newEmail: string | null = null,
  ): Promise<string> {
    const { token, hash } = generateSecureToken();
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE', [
        userId,
      ]);
      await manager.query(INVALIDATE_SQL, [userId, type]);
      await manager.insert(EmailTokenEntity, {
        userId,
        type,
        tokenHash: hash,
        newEmail,
        expiresAt: addSeconds(new Date(), EMAIL_TOKEN_TTL_SECONDS[type]),
      });
      return token;
    });
  }

  /**
   * Invalidates every open token of the user, e.g. after a password or
   * email change.
   */
  async invalidateAll(
    userId: string,
    querier: Querier = this.dataSource,
  ): Promise<void> {
    await querier.query(INVALIDATE_SQL, [userId, null]);
  }

  /**
   * Marks a valid token as used and returns it; null for an unknown, used,
   * expired or wrongly typed token. Pass the transaction that applies the
   * token's effect, so both commit together.
   */
  async consume(
    token: string,
    types: readonly EmailTokenType[],
    querier: Querier = this.dataSource,
  ): Promise<ConsumedToken | null> {
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    const rows = await querier.query<[TokenRow[], number]>(
      `UPDATE "email_tokens" SET "used_at" = now()
       WHERE "token_hash" = $1 AND "used_at" IS NULL AND "expires_at" > now()
         AND "type" = ANY($2::text[])
       RETURNING "user_id", "type", "new_email"`,
      [sha256Hex(token), [...types]],
    );
    const [row] = rows[0];
    return row
      ? { userId: row.user_id, type: row.type, newEmail: row.new_email }
      : null;
  }
}
