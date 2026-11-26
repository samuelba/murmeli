import type { RedisOptions } from 'ioredis';
import type { Env } from '../config/env.schema';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const REDIS_ENV_KEYS = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
] as const;

export type RedisEnv = Pick<Env, (typeof REDIS_ENV_KEYS)[number]>;

export function buildRedisConnection(env: RedisEnv) {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  };
}

export function buildBullConnection(env: RedisEnv) {
  return { ...buildRedisConnection(env), maxRetriesPerRequest: null };
}

export function buildRedisClientOptions(env: RedisEnv): RedisOptions {
  return {
    ...buildRedisConnection(env),
    lazyConnect: true,
    connectTimeout: 5_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 2,
  };
}
