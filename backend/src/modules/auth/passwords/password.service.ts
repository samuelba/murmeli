import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { apiError } from '../../../common/errors/api-exception';
import { errorMessage } from '../../../common/errors/error-message';
import type { Env } from '../../../config/env.schema';
import { type Fetch, isPwnedPassword } from './hibp';

export const HASH_PREFIX = 'argon2id$';

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_PASSWORD = 'murmeli-timing-equalizer-password';

/**
 * argon2id hashes stored as `argon2id$<phc>`. The prefix names the algorithm
 * so a later migration to another one stays possible.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly hibpEnabled: boolean;
  private dummyHash: Promise<string> | undefined;
  protected fetchFn: Fetch = (input, init) => fetch(input, init);

  constructor(config: ConfigService<Env, true>) {
    this.hibpEnabled = config.get('PASSWORD_HIBP_CHECK', { infer: true });
  }

  async hash(password: string): Promise<string> {
    return `${HASH_PREFIX}${await argon2.hash(password, ARGON2_OPTIONS)}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    if (!stored.startsWith(HASH_PREFIX)) {
      return false;
    }
    try {
      return await argon2.verify(stored.slice(HASH_PREFIX.length), password);
    } catch (error) {
      this.logger.error(`Password hash unreadable: ${errorMessage(error)}`);
      return false;
    }
  }

  /**
   * Spends the same time as a real verification, for requests about an
   * account that does not exist.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(DUMMY_PASSWORD);
    await this.verify(password, await this.dummyHash);
    return false;
  }

  /**
   * @throws 400 PASSWORD_TOO_WEAK if the HIBP check is on and the password
   * is in a known breach. An unreachable HIBP service lets it through.
   */
  async assertAcceptable(password: string): Promise<void> {
    if (!this.hibpEnabled) {
      return;
    }
    let pwned = false;
    try {
      pwned = await isPwnedPassword(password, this.fetchFn);
    } catch (error) {
      this.logger.warn(
        `HIBP check skipped (fail open): ${errorMessage(error)}`,
      );
    }
    if (pwned) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'PASSWORD_TOO_WEAK',
        'This password appears in a known data breach',
      );
    }
  }
}
