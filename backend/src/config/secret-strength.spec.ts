import {
  STRONG_ALTCHA_KEY,
  STRONG_ENCRYPTION_KEY,
  STRONG_JWT_SECRET,
} from '../../test/fixtures/env';
import {
  PLACEHOLDER_MARKERS,
  findSecretProblems,
  findSecretWeakness,
} from './secret-strength';

const RANDOM_TAIL = '-Q7w9Zr2Lk5Xp8Vb3Nm6Hj4Gf1Dc0Sa';

describe('findSecretWeakness', () => {
  it.each(PLACEHOLDER_MARKERS)(
    'rejects secrets containing %p in any case',
    (marker) => {
      expect(
        findSecretWeakness(
          'JWT_SECRET',
          `${marker.toUpperCase()}${RANDOM_TAIL}`,
        ),
      ).toMatch(/looks like a placeholder/);
    },
  );

  it('rejects short secrets', () => {
    expect(findSecretWeakness('JWT_SECRET', 'Ab1!'.repeat(7))).toMatch(
      /shorter than 32/,
    );
  });

  it('rejects low-entropy secrets', () => {
    expect(findSecretWeakness('JWT_SECRET', 'ab'.repeat(20))).toMatch(
      /too few distinct characters/,
    );
  });

  it('accepts a random secret', () => {
    expect(findSecretWeakness('JWT_SECRET', STRONG_JWT_SECRET)).toBeNull();
  });
});

describe('findSecretProblems', () => {
  const strong = {
    JWT_SECRET: STRONG_JWT_SECRET,
    ENCRYPTION_KEY: STRONG_ENCRYPTION_KEY,
    ALTCHA_HMAC_KEY: STRONG_ALTCHA_KEY,
  };

  it('returns nothing for strong, distinct secrets', () => {
    expect(findSecretProblems(strong)).toEqual([]);
  });

  it('names each weak secret', () => {
    expect(
      findSecretProblems({ ...strong, JWT_SECRET: 'x', ENCRYPTION_KEY: 'y' }),
    ).toEqual([
      expect.stringMatching(/^JWT_SECRET/),
      expect.stringMatching(/^ENCRYPTION_KEY/),
    ]);
  });

  it.each([
    ['ENCRYPTION_KEY', 'JWT_SECRET and ENCRYPTION_KEY must be different'],
    ['ALTCHA_HMAC_KEY', 'JWT_SECRET and ALTCHA_HMAC_KEY must be different'],
  ])('requires %s to differ from JWT_SECRET', (name, message) => {
    expect(
      findSecretProblems({ ...strong, [name]: STRONG_JWT_SECRET }),
    ).toEqual([expect.stringContaining(message)]);
  });

  it('requires ENCRYPTION_KEY and ALTCHA_HMAC_KEY to differ', () => {
    expect(
      findSecretProblems({ ...strong, ALTCHA_HMAC_KEY: STRONG_ENCRYPTION_KEY }),
    ).toEqual([expect.stringContaining('ENCRYPTION_KEY and ALTCHA_HMAC_KEY')]);
  });
});
