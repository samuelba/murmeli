export const STRONG_JWT_SECRET =
  'jwt-Secret-0123456789-abcdefghijklmnopqrstuvwxyz';
export const STRONG_ENCRYPTION_KEY =
  'enc-Key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ-xyz';
export const STRONG_ALTCHA_KEY = 'altcha-Key-0123456789-abcdefghijklmnopqrstu';

type RawEnv = Record<string, string | undefined>;

export function validRawEnv(overrides: RawEnv = {}): RawEnv {
  return {
    NODE_ENV: 'test',
    APP_URL: 'https://murmeli.example.com',
    DATABASE_HOST: 'localhost',
    DATABASE_USERNAME: 'murmeli',
    DATABASE_PASSWORD: 'murmeli',
    REDIS_HOST: 'localhost',
    JWT_SECRET: STRONG_JWT_SECRET,
    ENCRYPTION_KEY: STRONG_ENCRYPTION_KEY,
    ALTCHA_HMAC_KEY: STRONG_ALTCHA_KEY,
    ...overrides,
  };
}

export function productionRawEnv(overrides: RawEnv = {}): RawEnv {
  return validRawEnv({
    NODE_ENV: 'production',
    REDIS_PASSWORD: 'redis-Password-0123456789',
    ...overrides,
  });
}
