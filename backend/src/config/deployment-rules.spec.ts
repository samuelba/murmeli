import {
  findInsecureOrigins,
  findProductionProblems,
} from './deployment-rules';

describe('findInsecureOrigins', () => {
  const env = (APP_URL: string, CORS_ORIGINS: string[] = []) => ({
    APP_URL,
    CORS_ORIGINS,
  });

  it('accepts https everywhere', () => {
    expect(
      findInsecureOrigins(
        env('https://murmeli.example.com', ['https://a.example.com']),
        true,
      ),
    ).toEqual([]);
  });

  it.each(['http://localhost:4200', 'http://127.0.0.1:4200', 'http://[::1]'])(
    'allows %s outside production only',
    (origin) => {
      expect(findInsecureOrigins(env(origin), false)).toEqual([]);
      expect(findInsecureOrigins(env(origin), true)).toEqual([
        `APP_URL entry ${origin} must use https in production.`,
      ]);
    },
  );

  it('flags plain-http LAN origins outside production', () => {
    expect(
      findInsecureOrigins(
        env('https://murmeli.example.com', ['http://192.168.1.5:4200']),
        false,
      ),
    ).toEqual([
      'CORS_ORIGINS entry http://192.168.1.5:4200 must use https unless it is localhost.',
    ]);
  });
});

describe('findProductionProblems', () => {
  it('requires a Redis password and secure cookies', () => {
    expect(
      findProductionProblems({
        REDIS_PASSWORD: undefined,
        COOKIE_SECURE: false,
        LEARNING_UNLOCK_ALL: false,
      }),
    ).toEqual([
      'REDIS_PASSWORD is required in production.',
      'COOKIE_SECURE must be true in production.',
    ]);
  });

  it('refuses the unlock-all test flag', () => {
    expect(
      findProductionProblems({
        REDIS_PASSWORD: 'pw',
        COOKIE_SECURE: true,
        LEARNING_UNLOCK_ALL: true,
      }),
    ).toEqual(['LEARNING_UNLOCK_ALL must not be enabled in production.']);
  });

  it('passes a hardened configuration', () => {
    expect(
      findProductionProblems({
        REDIS_PASSWORD: 'pw',
        COOKIE_SECURE: true,
        LEARNING_UNLOCK_ALL: false,
      }),
    ).toEqual([]);
  });
});
