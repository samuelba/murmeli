import { HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { type Challenge, solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import type { Env } from '../../config/env.schema';
import { STRONG_ALTCHA_KEY } from '../../../test/fixtures/env';
import { AltchaController } from './altcha.controller';
import {
  ALTCHA_ALGORITHM,
  ALTCHA_MAX_NUMBER,
  ALTCHA_TTL_SECONDS,
  AltchaService,
} from './altcha.service';

const HMAC_KEY = STRONG_ALTCHA_KEY;

function service(setResult: string | null = 'OK') {
  const redis = { set: jest.fn().mockResolvedValue(setResult) };
  const config = {
    get: () => HMAC_KEY,
  } as unknown as ConfigService<Env, true>;
  return { redis, altcha: new AltchaService(config, redis) };
}

async function payloadFor(challenge: Challenge): Promise<string> {
  const solution = await solveChallenge({ challenge, deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString(
    'base64',
  );
}

describe('AltchaService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates signed, expiring SHA-256 challenges', async () => {
    const { altcha } = service();
    const now = Date.UTC(2026, 0, 1);

    const challenge = await altcha.createChallenge(now);

    expect(challenge.parameters.algorithm).toBe(ALTCHA_ALGORITHM);
    expect(challenge.parameters.expiresAt).toBe(
      Math.floor(now / 1000) + ALTCHA_TTL_SECONDS,
    );
    expect(challenge.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge.parameters.keySignature).toBeDefined();
    expect(ALTCHA_MAX_NUMBER).toBe(50_000);
  });

  it('accepts a solved challenge once and marks it spent', async () => {
    const { altcha, redis } = service();
    const challenge = await altcha.createChallenge();

    await expect(altcha.verify(await payloadFor(challenge))).resolves.toBe(
      true,
    );
    expect(redis.set).toHaveBeenCalledWith(
      `murmeli:altcha:spent:${challenge.parameters.nonce}`,
      '1',
      'EX',
      ALTCHA_TTL_SECONDS,
      'NX',
    );
  });

  it('rejects a replayed payload', async () => {
    const { altcha } = service(null);
    const challenge = await altcha.createChallenge();

    await expect(altcha.verify(await payloadFor(challenge))).resolves.toBe(
      false,
    );
  });

  it('rejects an expired challenge', async () => {
    const { altcha, redis } = service();
    const challenge = await altcha.createChallenge(
      Date.now() - (ALTCHA_TTL_SECONDS + 60) * 1000,
    );

    await expect(altcha.verify(await payloadFor(challenge))).resolves.toBe(
      false,
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('rejects a tampered challenge', async () => {
    const { altcha } = service();
    const challenge = await altcha.createChallenge();
    const solution = await solveChallenge({ challenge, deriveKey });
    const tampered = {
      ...challenge,
      parameters: { ...challenge.parameters, expiresAt: 9_999_999_999 },
    };
    const payload = Buffer.from(
      JSON.stringify({ challenge: tampered, solution }),
    ).toString('base64');

    await expect(altcha.verify(payload)).resolves.toBe(false);
  });

  it('rejects a challenge signed with another key', async () => {
    const other = new AltchaService(
      {
        get: () => 'another-Key-0123456789-abcdefghijklmnopqr',
      } as unknown as ConfigService<Env, true>,
      { set: jest.fn() },
    );
    const { altcha } = service();
    const challenge = await other.createChallenge();

    await expect(altcha.verify(await payloadFor(challenge))).resolves.toBe(
      false,
    );
  });

  it.each([
    '',
    'not-base64-json',
    Buffer.from('{"challenge":{}}').toString('base64'),
    Buffer.from('[1,2]').toString('base64'),
    'a'.repeat(5000),
  ])('rejects garbage payload %#', async (payload) => {
    const { altcha } = service();

    await expect(altcha.verify(payload)).resolves.toBe(false);
  });

  it('treats library errors as failures', async () => {
    const { altcha } = service();
    const payload = Buffer.from(
      JSON.stringify({
        challenge: { parameters: { algorithm: 'NOPE' }, signature: 'x' },
        solution: { counter: 1, derivedKey: 'ab' },
      }),
    ).toString('base64');

    await expect(altcha.verify(payload)).resolves.toBe(false);
  });

  it('assertValid throws 400 ALTCHA_INVALID', async () => {
    const { altcha } = service();

    const error = await altcha.assertValid('nope').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect((error as HttpException).getResponse()).toMatchObject({
      errorCode: 'ALTCHA_INVALID',
    });
  });

  it('assertValid passes a valid payload', async () => {
    const { altcha } = service();
    const challenge = await altcha.createChallenge();

    await expect(
      altcha.assertValid(await payloadFor(challenge)),
    ).resolves.toBeUndefined();
  });
});

describe('AltchaController', () => {
  it('returns a new challenge', async () => {
    const challenge = { parameters: {} } as Challenge;
    const altcha = {
      createChallenge: jest.fn().mockResolvedValue(challenge),
    } as unknown as AltchaService;

    await expect(new AltchaController(altcha).challenge()).resolves.toBe(
      challenge,
    );
  });
});
