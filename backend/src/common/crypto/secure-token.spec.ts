import {
  TOKEN_BYTES,
  generateSecureToken,
  safeEqual,
  sha256Hex,
} from './secure-token';

describe('secure tokens', () => {
  it('generates base64url tokens of 32 random bytes with their hash', () => {
    const first = generateSecureToken();
    const second = generateSecureToken();

    expect(Buffer.from(first.token, 'base64url')).toHaveLength(TOKEN_BYTES);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.hash).toBe(sha256Hex(first.token));
    expect(first.token).not.toBe(second.token);
  });

  it('accepts a custom size', () => {
    expect(Buffer.from(generateSecureToken(8).token, 'base64url')).toHaveLength(
      8,
    );
  });

  it('hashes with SHA-256 hex', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('compares in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
