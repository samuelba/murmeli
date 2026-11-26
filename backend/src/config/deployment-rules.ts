import type { Env } from './env.schema';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type OriginEnv = Pick<Env, 'APP_URL' | 'CORS_ORIGINS'>;

function originsOf(env: OriginEnv): { name: string; origin: string }[] {
  return [
    { name: 'APP_URL', origin: env.APP_URL },
    ...env.CORS_ORIGINS.map((origin) => ({ name: 'CORS_ORIGINS', origin })),
  ];
}

/**
 * Plain HTTP is only acceptable for a local development origin. In
 * production every origin must use HTTPS.
 */
export function findInsecureOrigins(
  env: OriginEnv,
  isProduction: boolean,
): string[] {
  return originsOf(env)
    .filter(({ origin }) => {
      const url = new URL(origin);
      if (url.protocol === 'https:') {
        return false;
      }
      return isProduction || !LOCAL_HOSTS.has(url.hostname);
    })
    .map(
      ({ name, origin }) =>
        `${name} entry ${origin} must use https${isProduction ? ' in production' : ' unless it is localhost'}.`,
    );
}

export function findProductionProblems(
  env: Pick<Env, 'REDIS_PASSWORD' | 'COOKIE_SECURE'>,
): string[] {
  return [
    ...(env.REDIS_PASSWORD === undefined
      ? ['REDIS_PASSWORD is required in production.']
      : []),
    ...(env.COOKIE_SECURE ? [] : ['COOKIE_SECURE must be true in production.']),
  ];
}
