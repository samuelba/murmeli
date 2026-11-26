import { HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Env } from '../../../config/env.schema';
import type { Fetch } from './hibp';
import { HASH_PREFIX, PasswordService } from './password.service';

class TestPasswordService extends PasswordService {
  constructor(hibp: boolean, fetchFn?: Fetch) {
    super({ get: () => hibp } as unknown as ConfigService<Env, true>);
    if (fetchFn) {
      this.fetchFn = fetchFn;
    }
  }
}

function rangeFor(password: string): string {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  return `${hash.slice(5)}:7`;
}

describe('PasswordService', () => {
  afterEach(() => jest.restoreAllMocks());

  const passwords = new TestPasswordService(false);

  it('stores argon2id hashes with the algorithm prefix', async () => {
    const hash = await passwords.hash('correct-horse-battery');

    expect(hash.startsWith(`${HASH_PREFIX}$argon2id$`)).toBe(true);
    await expect(passwords.verify('correct-horse-battery', hash)).resolves.toBe(
      true,
    );
    await expect(passwords.verify('wrong-password!', hash)).resolves.toBe(
      false,
    );
  });

  it('salts every hash', async () => {
    expect(await passwords.hash('same-password')).not.toBe(
      await passwords.hash('same-password'),
    );
  });

  it('rejects hashes without the prefix', async () => {
    await expect(passwords.verify('x', '$2b$10$bcrypt')).resolves.toBe(false);
  });

  it('logs and rejects unreadable hashes', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(passwords.verify('x', `${HASH_PREFIX}garbage`)).resolves.toBe(
      false,
    );
    expect(error).toHaveBeenCalled();
  });

  it('verifies against a dummy hash for unknown accounts', async () => {
    await expect(passwords.verifyDummy('anything')).resolves.toBe(false);
    await expect(passwords.verifyDummy('again')).resolves.toBe(false);
  });

  describe('assertAcceptable', () => {
    it('does nothing when the HIBP check is off', async () => {
      const fetchFn = jest.fn();

      await new TestPasswordService(false, fetchFn).assertAcceptable('x');

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects a breached password with PASSWORD_TOO_WEAK', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(rangeFor('password1234')),
      });

      const error = await new TestPasswordService(true, fetchFn)
        .assertAcceptable('password1234')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toMatchObject({
        errorCode: 'PASSWORD_TOO_WEAK',
      });
    });

    it('accepts a password that is not breached', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('ABC:1'),
      });

      await expect(
        new TestPasswordService(true, fetchFn).assertAcceptable('unique-pass'),
      ).resolves.toBeUndefined();
    });

    it('fails open with a warning when HIBP is unreachable', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const fetchFn = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        new TestPasswordService(true, fetchFn).assertAcceptable('unique-pass'),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('fail open'));
    });

    it('uses the global fetch by default', async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('offline'));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await new TestPasswordService(true).assertAcceptable('unique-pass');

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
