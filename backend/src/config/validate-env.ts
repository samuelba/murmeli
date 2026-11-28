import { Logger } from '@nestjs/common';
import type { z } from 'zod';
import {
  findInsecureOrigins,
  findProductionProblems,
} from './deployment-rules';
import { type Env, envSchema } from './env.schema';
import { findSecretProblems } from './secret-strength';

export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      [
        'Invalid environment configuration:',
        ...problems.map((problem) => `  - ${problem}`),
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

type RawEnv = Record<string, unknown>;

export const NODE_ENV_UNSET_WARNING =
  'NODE_ENV is not set, so the backend runs in DEVELOPMENT mode: weak secrets are accepted and error details are exposed. Set NODE_ENV=production for any deployment.';

export const UNLOCK_ALL_WARNING =
  'LEARNING_UNLOCK_ALL is on: every world and level is open for every kid. Use it for testing only.';

export function withoutEmptyValues(raw: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== ''),
  );
}

export function formatIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const name = issue.path.length > 0 ? String(issue.path[0]) : 'environment';
    return `${name}: ${issue.message}`;
  });
}

export function parseEnvSchema<T extends z.ZodType>(
  schema: T,
  raw: RawEnv,
): z.output<T> {
  const result = schema.safeParse(withoutEmptyValues(raw));
  if (!result.success) {
    throw new EnvValidationError(formatIssues(result.error.issues));
  }
  return result.data;
}

/**
 * Validates every environment variable at startup. Production additionally
 * requires strong distinct secrets, a Redis password, secure cookies and
 * HTTPS origins; outside production these problems are only logged.
 */
export function validateEnv(
  raw: RawEnv,
  logger: Pick<Logger, 'warn'> = new Logger('Config'),
): Env {
  const env = parseEnvSchema(envSchema, raw);
  const isProduction = env.NODE_ENV === 'production';

  if (raw.NODE_ENV === undefined || raw.NODE_ENV === '') {
    logger.warn(NODE_ENV_UNSET_WARNING);
  }
  if (!isProduction && env.LEARNING_UNLOCK_ALL) {
    logger.warn(UNLOCK_ALL_WARNING);
  }

  const problems = [
    ...findSecretProblems(env),
    ...findInsecureOrigins(env, isProduction),
    ...(isProduction ? findProductionProblems(env) : []),
  ];
  if (isProduction && problems.length > 0) {
    throw new EnvValidationError(problems);
  }
  problems.forEach((problem) => logger.warn(problem));

  return Object.freeze(env);
}
