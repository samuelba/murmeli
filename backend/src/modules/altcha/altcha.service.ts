import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Challenge,
  type Payload,
  createChallenge,
  randomInt,
  verifySolution,
} from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import type { Redis } from 'ioredis';
import { createHmac } from 'node:crypto';
import { apiError } from '../../common/errors/api-exception';
import { errorMessage } from '../../common/errors/error-message';
import type { Env } from '../../config/env.schema';
import { REDIS_CLIENT } from '../../redis/redis.options';

export const ALTCHA_ALGORITHM = 'SHA-256';
export const ALTCHA_COST = 1;
export const ALTCHA_MAX_NUMBER = 50_000;
export const ALTCHA_TTL_SECONDS = 600;
export const ALTCHA_PAYLOAD_MAX_LENGTH = 4096;
const SPENT_KEY_PREFIX = 'murmeli:altcha:spent:';

function decodePayload(raw: string): Payload | null {
  if (raw.length === 0 || raw.length > ALTCHA_PAYLOAD_MAX_LENGTH) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64').toString('utf8'),
    ) as Partial<Payload>;
    return parsed.challenge?.parameters && parsed.solution
      ? (parsed as Payload)
      : null;
  } catch {
    return null;
  }
}

/**
 * Self-hosted ALTCHA proof of work. Challenges are HMAC-signed, expire after
 * ten minutes and can be redeemed once: the nonce of a verified payload is
 * marked as spent in Redis.
 */
@Injectable()
export class AltchaService {
  private readonly logger = new Logger(AltchaService.name);
  private readonly hmacKey: string;
  private readonly keySignatureSecret: string;

  constructor(
    config: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'set'>,
  ) {
    this.hmacKey = config.get('ALTCHA_HMAC_KEY', { infer: true });
    this.keySignatureSecret = createHmac('sha256', this.hmacKey)
      .update('murmeli:altcha:key-signature')
      .digest('hex');
  }

  createChallenge(now = Date.now()): Promise<Challenge> {
    return createChallenge({
      algorithm: ALTCHA_ALGORITHM,
      cost: ALTCHA_COST,
      counter: randomInt(ALTCHA_MAX_NUMBER),
      deriveKey,
      expiresAt: Math.floor(now / 1000) + ALTCHA_TTL_SECONDS,
      hmacSignatureSecret: this.hmacKey,
      hmacKeySignatureSecret: this.keySignatureSecret,
    });
  }

  /**
   * @returns true only for a valid, unexpired payload seen for the first time
   */
  async verify(raw: string): Promise<boolean> {
    const payload = decodePayload(raw);
    if (!payload) {
      return false;
    }
    try {
      const result = await verifySolution({
        challenge: payload.challenge,
        solution: payload.solution,
        deriveKey,
        hmacSignatureSecret: this.hmacKey,
        hmacKeySignatureSecret: this.keySignatureSecret,
      });
      return result.verified && (await this.markSpent(payload));
    } catch (error) {
      this.logger.warn(`ALTCHA verification failed: ${errorMessage(error)}`);
      return false;
    }
  }

  async assertValid(raw: string): Promise<void> {
    if (!(await this.verify(raw))) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'ALTCHA_INVALID',
        'The bot check failed, please try again',
      );
    }
  }

  private async markSpent(payload: Payload): Promise<boolean> {
    const stored = await this.redis.set(
      `${SPENT_KEY_PREFIX}${payload.challenge.parameters.nonce}`,
      '1',
      'EX',
      ALTCHA_TTL_SECONDS,
      'NX',
    );
    return stored === 'OK';
  }
}
