import type { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

export type AppConfigService = ConfigService<Env, true>;

export function pickEnv<K extends keyof Env>(
  config: AppConfigService,
  keys: readonly K[],
): Pick<Env, K> {
  return Object.freeze(
    Object.fromEntries(
      keys.map((key) => [key, config.get(key, { infer: true })]),
    ),
  ) as Pick<Env, K>;
}
