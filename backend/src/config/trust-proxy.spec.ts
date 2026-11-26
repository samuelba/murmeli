import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['  ', 1],
    ['2', 2],
    ['0', false],
    ['false', false],
    ['FALSE', false],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('parses %p as %p', (raw, expected) => {
    expect(parseTrustProxy(raw)).toBe(expected);
  });

  it.each(['true', 'TRUE', ' true '])('rejects %p', (raw) => {
    expect(() => parseTrustProxy(raw)).toThrow(/X-Forwarded-For/);
  });
});
