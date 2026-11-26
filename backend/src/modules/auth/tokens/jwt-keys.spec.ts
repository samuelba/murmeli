import { TOKEN_TYPES, deriveTokenKey } from './jwt-keys';

const SECRET = 'jwt-Secret-0123456789-abcdefghijklmnopqrstuvwxyz';

describe('deriveTokenKey', () => {
  it('derives a stable 32-byte key per type', () => {
    expect(deriveTokenKey(SECRET, 'access')).toHaveLength(32);
    expect(deriveTokenKey(SECRET, 'access')).toEqual(
      deriveTokenKey(SECRET, 'access'),
    );
  });

  it('derives a different key for every token type', () => {
    const keys = TOKEN_TYPES.map((type) =>
      deriveTokenKey(SECRET, type).toString('hex'),
    );

    expect(new Set(keys).size).toBe(TOKEN_TYPES.length);
  });

  it('depends on the secret', () => {
    expect(deriveTokenKey(SECRET, 'kid')).not.toEqual(
      deriveTokenKey(`${SECRET}x`, 'kid'),
    );
  });
});
