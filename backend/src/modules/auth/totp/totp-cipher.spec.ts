import { TOTP_KEY_VERSION, createTotpCipher } from './totp-cipher';

const KEY = 'enc-Key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ-xyz';

describe('createTotpCipher', () => {
  it('encrypts with the v1 key and round-trips', () => {
    const cipher = createTotpCipher(KEY);

    const encrypted = cipher.encrypt('JBSWY3DPEHPK3PXP');

    expect(encrypted.startsWith(`${TOTP_KEY_VERSION}:`)).toBe(true);
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(cipher.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('cannot decrypt with another ENCRYPTION_KEY', () => {
    const encrypted = createTotpCipher(KEY).encrypt('secret');

    expect(() => createTotpCipher(`${KEY}-other`).decrypt(encrypted)).toThrow();
  });
});
