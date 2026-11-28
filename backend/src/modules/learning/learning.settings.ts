import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pickEnv } from '../../config/app-config';
import type { Env } from '../../config/env.schema';
import type { LimitPolicy } from '../auth/limits/attempt-limiter.service';

export const LEARNING_ENV_KEYS = [
  'APP_TIMEZONE',
  'RATE_LIMIT_LEARN_WINDOW_SECONDS',
  'RATE_LIMIT_LEARN_ANSWER_LIMIT',
  'RATE_LIMIT_LEARN_RUN_LIMIT',
  'LEARNING_UNLOCK_ALL',
] as const;

/**
 * The learning engine's settings from the env: the day boundary and the
 * per-kid limits that stop scripted answering.
 */
@Injectable()
export class LearningSettings {
  readonly timeZone: string;
  readonly answers: LimitPolicy;
  readonly runs: LimitPolicy;
  readonly unlockAll: boolean;

  constructor(config: ConfigService<Env, true>) {
    const env = pickEnv(config, LEARNING_ENV_KEYS);
    const window = env.RATE_LIMIT_LEARN_WINDOW_SECONDS;
    this.timeZone = env.APP_TIMEZONE;
    this.answers = {
      name: 'learn-answer',
      limit: env.RATE_LIMIT_LEARN_ANSWER_LIMIT,
      windowSeconds: window,
      lockSeconds: window,
    };
    this.runs = {
      name: 'learn-run',
      limit: env.RATE_LIMIT_LEARN_RUN_LIMIT,
      windowSeconds: window,
      lockSeconds: window,
    };
    this.unlockAll = env.LEARNING_UNLOCK_ALL;
  }
}
