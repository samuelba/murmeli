import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { productionRawEnv, validRawEnv } from '../../test/fixtures/env';
import {
  EnvValidationError,
  NODE_ENV_UNSET_WARNING,
  UNLOCK_ALL_WARNING,
  validateEnv,
} from './validate-env';

const silent = { warn: jest.fn() };

function problemsOf(raw: Record<string, unknown>): readonly string[] {
  try {
    validateEnv(raw, silent);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).problems;
  }
  throw new Error('expected validation to fail');
}

describe('validateEnv', () => {
  beforeEach(() => silent.warn.mockClear());

  it('applies the documented defaults', () => {
    const env = validateEnv(validRawEnv(), silent);

    expect(env).toMatchObject({
      PORT: 3000,
      LOG_LEVEL: 'info',
      TRUST_PROXY: 1,
      CORS_ORIGINS: [],
      DATABASE_PORT: 5432,
      DATABASE_NAME: 'murmeli',
      DB_MIGRATIONS_RUN: true,
      REDIS_PORT: 6379,
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '30d',
      COOKIE_SECURE: true,
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      REGISTRATION_ENABLED: false,
      RATE_LIMIT_LIMIT: 120,
      BACKUP_DIR: '/app/backups',
      BACKUP_MANDATORY: true,
      BACKUP_KEEP_COUNT: 10,
    });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('defaults NODE_ENV to development', () => {
    expect(validateEnv(validRawEnv({ NODE_ENV: undefined }), silent)).toEqual(
      expect.objectContaining({ NODE_ENV: 'development' }),
    );
  });

  it('parses typed values', () => {
    const env = validateEnv(
      validRawEnv({
        PORT: '8080',
        DB_MIGRATIONS_RUN: 'false',
        REGISTRATION_ENABLED: 'yes',
        TRUST_PROXY: '10.0.0.0/8',
        CORS_ORIGINS: 'https://a.example.com/, http://localhost:4200',
        APP_URL: 'https://murmeli.example.com/',
      }),
      silent,
    );

    expect(env.PORT).toBe(8080);
    expect(env.DB_MIGRATIONS_RUN).toBe(false);
    expect(env.REGISTRATION_ENABLED).toBe(true);
    expect(env.TRUST_PROXY).toBe('10.0.0.0/8');
    expect(env.CORS_ORIGINS).toEqual([
      'https://a.example.com',
      'http://localhost:4200',
    ]);
    expect(env.APP_URL).toBe('https://murmeli.example.com');
  });

  it('treats empty strings as unset', () => {
    const env = validateEnv(
      validRawEnv({ SMTP_HOST: '', REDIS_PASSWORD: '', PORT: '' }),
      silent,
    );

    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.REDIS_PASSWORD).toBeUndefined();
    expect(env.PORT).toBe(3000);
  });

  it('lists every missing required variable at once', () => {
    const problems = problemsOf({ NODE_ENV: 'test' });

    expect(problems).toEqual(
      expect.arrayContaining([
        'APP_URL: is required',
        'DATABASE_HOST: is required',
        'DATABASE_USERNAME: is required',
        'DATABASE_PASSWORD: is required',
        'REDIS_HOST: is required',
        'JWT_SECRET: is required',
        'ENCRYPTION_KEY: is required',
        'ALTCHA_HMAC_KEY: is required',
      ]),
    );
  });

  it('includes every problem in the error message', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' }, silent)).toThrow(
      /Invalid environment configuration:\n {2}- APP_URL: is required/,
    );
  });

  it.each([
    ['PORT', '70000'],
    ['PORT', 'abc'],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['COOKIE_SECURE', 'maybe'],
    ['JWT_ACCESS_EXPIRATION', '15 minutes'],
    ['APP_URL', 'ftp://murmeli.example.com'],
    ['APP_URL', 'not a url'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://a.example.com/path'],
    ['TRUST_PROXY', 'true'],
    ['BACKUP_KEEP_COUNT', '0'],
  ])('rejects %s=%s', (name, value) => {
    const problems = problemsOf(validRawEnv({ [name]: value }));

    expect(problems.some((problem) => problem.startsWith(`${name}:`))).toBe(
      true,
    );
  });

  it('requires SMTP_FROM when SMTP_HOST is set', () => {
    expect(problemsOf(validRawEnv({ SMTP_HOST: 'smtp.example.com' }))).toEqual([
      'SMTP_FROM: is required when SMTP_HOST is set',
    ]);
  });

  it('accepts matching migration credentials and SSL modes', () => {
    const env = validateEnv(
      validRawEnv({
        DB_MIGRATION_USERNAME: 'owner',
        DB_MIGRATION_PASSWORD: 'pw',
        DATABASE_SSL: 'require-verify',
        BACKUP_MAX_AGE_DAYS: '7',
      }),
      silent,
    );

    expect(env).toMatchObject({
      DB_MIGRATION_USERNAME: 'owner',
      DATABASE_SSL: 'require-verify',
      BACKUP_MAX_AGE_DAYS: 7,
    });
  });

  it.each([
    [{ DB_MIGRATION_USERNAME: 'owner' }, 'DB_MIGRATION_PASSWORD'],
    [{ DB_MIGRATION_PASSWORD: 'pw' }, 'DB_MIGRATION_USERNAME'],
  ])('requires both migration credentials (%p)', (overrides, missing) => {
    expect(problemsOf(validRawEnv(overrides))).toEqual([
      `${missing}: DB_MIGRATION_USERNAME and DB_MIGRATION_PASSWORD must be set together`,
    ]);
  });

  it('rejects an unknown DATABASE_SSL mode', () => {
    expect(problemsOf(validRawEnv({ DATABASE_SSL: 'verify-ca' }))[0]).toMatch(
      /^DATABASE_SSL:/,
    );
  });

  it('warns loudly when NODE_ENV is unset', () => {
    validateEnv(validRawEnv({ NODE_ENV: undefined }), silent);

    expect(silent.warn).toHaveBeenCalledWith(NODE_ENV_UNSET_WARNING);
  });

  it('warns when LEARNING_UNLOCK_ALL is on outside production', () => {
    validateEnv(validRawEnv({ LEARNING_UNLOCK_ALL: 'true' }), silent);

    expect(silent.warn).toHaveBeenCalledWith(UNLOCK_ALL_WARNING);
  });

  describe('production', () => {
    it('accepts a hardened configuration without warnings', () => {
      expect(() => validateEnv(productionRawEnv(), silent)).not.toThrow();
      expect(silent.warn).not.toHaveBeenCalled();
    });

    it('refuses to start with LEARNING_UNLOCK_ALL on', () => {
      expect(() =>
        validateEnv(productionRawEnv({ LEARNING_UNLOCK_ALL: 'true' }), silent),
      ).toThrow(/LEARNING_UNLOCK_ALL must not be enabled in production/);
    });

    it.each(['JWT_SECRET', 'ENCRYPTION_KEY', 'ALTCHA_HMAC_KEY'])(
      'refuses to start with a %s shorter than 32 characters',
      (name) => {
        const almost = 'Qw3rTy-uIoP_aSdF-gHjK_lZxC-vBnM9'.slice(0, 31);
        expect(() =>
          validateEnv(productionRawEnv({ [name]: almost }), silent),
        ).toThrow(new RegExp(`${name} is shorter than 32`));
      },
    );

    it('lists every production problem at once without echoing secrets', () => {
      const problems = problemsOf(
        productionRawEnv({
          JWT_SECRET: 'change-me',
          ENCRYPTION_KEY: 'short',
          ALTCHA_HMAC_KEY: 'a'.repeat(40),
          REDIS_PASSWORD: undefined,
          COOKIE_SECURE: 'false',
          APP_URL: 'http://murmeli.example.com',
          CORS_ORIGINS: 'http://localhost:4200',
        }),
      );

      expect(problems).toHaveLength(7);
      expect(problems.join('\n')).not.toContain('change-me');
    });

    it('rejects the development values of .env.example', () => {
      const example = readFileSync(
        join(__dirname, '..', '..', '.env.example'),
        'utf8',
      );
      const raw = Object.fromEntries(
        example
          .split('\n')
          .filter((line) => /^[A-Z_]+=/.test(line))
          .map((line) => {
            const index = line.indexOf('=');
            return [line.slice(0, index), line.slice(index + 1)];
          }),
      );

      expect(validateEnv(raw, silent).NODE_ENV).toBe('development');
      const problems = problemsOf({ ...raw, NODE_ENV: 'production' });
      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^JWT_SECRET looks like a placeholder/),
          expect.stringMatching(/^ENCRYPTION_KEY looks like a placeholder/),
          expect.stringMatching(/^ALTCHA_HMAC_KEY looks like a placeholder/),
          'COOKIE_SECURE must be true in production.',
          expect.stringMatching(/^APP_URL entry http:\/\/localhost:4200/),
        ]),
      );
    });
  });

  describe('outside production', () => {
    it('only warns about weak secrets', () => {
      const env = validateEnv(
        validRawEnv({ NODE_ENV: 'development', JWT_SECRET: 'change-me' }),
        silent,
      );

      expect(env.JWT_SECRET).toBe('change-me');
      expect(silent.warn).toHaveBeenCalledTimes(1);
    });
  });
});
