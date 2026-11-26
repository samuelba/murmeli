import { randomBytes } from 'node:crypto';
import {
  UnknownKeyVersionError,
  VersionedCipher,
  deriveEncryptionKey,
} from './versioned-cipher';

const keyA = deriveEncryptionKey('secret-a-0123456789-abcdefghijklmn', 'totp');
const keyB = deriveEncryptionKey('secret-b-0123456789-abcdefghijklmn', 'totp');

describe('deriveEncryptionKey', () => {
  it('derives a stable 32-byte key per secret and purpose', () => {
    expect(keyA).toHaveLength(32);
    expect(
      deriveEncryptionKey('secret-a-0123456789-abcdefghijklmn', 'totp'),
    ).toEqual(keyA);
    expect(
      deriveEncryptionKey('secret-a-0123456789-abcdefghijklmn', 'smtp'),
    ).not.toEqual(keyA);
    expect(keyB).not.toEqual(keyA);
  });
});

describe('VersionedCipher', () => {
  const v1 = new VersionedCipher({ current: 'v1', keys: { v1: keyA } });

  it('round-trips plaintext with a version prefix', () => {
    const encrypted = v1.encrypt('JBSWY3DPEHPK3PXP');

    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted.split(':')).toHaveLength(4);
    expect(v1.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV for every value', () => {
    expect(v1.encrypt('same')).not.toBe(v1.encrypt('same'));
  });

  it('handles unicode and empty strings', () => {
    expect(v1.decrypt(v1.encrypt('Grüezi 🐹'))).toBe('Grüezi 🐹');
    expect(v1.decrypt(v1.encrypt(''))).toBe('');
  });

  it('reads old versions after a key rotation and writes the new one', () => {
    const old = v1.encrypt('secret');
    const rotated = new VersionedCipher({
      current: 'v2',
      keys: { v1: keyA, v2: keyB },
    });

    expect(rotated.decrypt(old)).toBe('secret');
    expect(rotated.needsUpgrade(old)).toBe(true);
    const upgraded = rotated.encrypt('secret');
    expect(upgraded.startsWith('v2:')).toBe(true);
    expect(rotated.needsUpgrade(upgraded)).toBe(false);
  });

  it('rejects a version without a configured key', () => {
    const v2Only = new VersionedCipher({ current: 'v2', keys: { v2: keyB } });

    expect(() => v2Only.decrypt(v1.encrypt('x'))).toThrow(
      UnknownKeyVersionError,
    );
  });

  it('rejects malformed values', () => {
    expect(() => v1.decrypt('nonsense')).toThrow(
      'Invalid encrypted value format',
    );
    expect(() => v1.decrypt('v1:only-two:parts')).toThrow(
      'Invalid encrypted value format',
    );
    expect(v1.versionOf('no-colon')).toBeNull();
    expect(v1.needsUpgrade('garbage')).toBe(true);
  });

  it('detects tampering and wrong keys', () => {
    const [version, iv, tag, data] = v1.encrypt('secret').split(':');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 0xff;
    const tampered = [version, iv, tag, flipped.toString('base64url')].join(
      ':',
    );
    const otherKey = new VersionedCipher({ current: 'v1', keys: { v1: keyB } });

    expect(() => v1.decrypt(tampered)).toThrow();
    expect(() => otherKey.decrypt(v1.encrypt('secret'))).toThrow();
    expect(() =>
      v1.decrypt(`v1:${randomBytes(12).toString('base64url')}:${tag}:${data}`),
    ).toThrow();
  });

  it('binds a value to its additional authenticated data', () => {
    const bound = v1.encrypt('JBSWY3DPEHPK3PXP', 'user-1');

    expect(v1.decrypt(bound, 'user-1')).toBe('JBSWY3DPEHPK3PXP');
    expect(() => v1.decrypt(bound, 'user-2')).toThrow();
    expect(() => v1.decrypt(bound)).toThrow();
    expect(v1.decrypt(v1.encrypt('x'), '')).toBe('x');
  });

  it('rejects IVs and tags of the wrong length', () => {
    const [version, iv, tag, data] = v1.encrypt('secret').split(':');
    const short = (part: string) =>
      Buffer.from(part, 'base64url').subarray(1).toString('base64url');

    expect(() => v1.decrypt([version, short(iv), tag, data].join(':'))).toThrow(
      'Invalid encrypted value format',
    );
    expect(() => v1.decrypt([version, iv, short(tag), data].join(':'))).toThrow(
      'Invalid encrypted value format',
    );
  });

  it('validates its configuration', () => {
    expect(
      () => new VersionedCipher({ current: 'one', keys: { one: keyA } }),
    ).toThrow('Invalid key version one');
    expect(
      () => new VersionedCipher({ current: 'v3', keys: { v1: keyA } }),
    ).toThrow('No key configured for version v3');
  });
});
