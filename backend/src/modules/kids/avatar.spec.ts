import { canonicalAvatar } from './avatar';
import {
  AVATAR_ACCESSORIES,
  AVATAR_ANIMALS,
  AVATAR_BACKGROUNDS,
} from './avatar-catalog';
import type { KidEntity } from './kid.entity';
import { toKidView } from './kid.view';

const animal = AVATAR_ANIMALS[0];
const accessory = AVATAR_ACCESSORIES[0];
const background = AVATAR_BACKGROUNDS[0];

describe('canonicalAvatar', () => {
  it('accepts catalog values with and without an accessory', () => {
    expect(canonicalAvatar({ animal, accessory, background })).toEqual({
      animal,
      accessory,
      background,
    });
    expect(canonicalAvatar({ animal, accessory: null, background })).toEqual({
      animal,
      accessory: null,
      background,
    });
  });

  it('normalizes the background to the catalog spelling', () => {
    expect(
      canonicalAvatar({
        animal,
        accessory: null,
        background: background.toLowerCase(),
      })?.background,
    ).toBe(background);
  });

  it.each([
    [{ animal: 'velociraptor', accessory: null, background }],
    [{ animal, accessory: 'jetpack', background }],
    [{ animal, accessory: null, background: '#000001' }],
  ])('rejects %p', (avatar) => {
    expect(canonicalAvatar(avatar)).toBeNull();
  });
});

describe('toKidView', () => {
  const kid = {
    id: 'k1',
    userId: 'u1',
    nickname: 'Zoë',
    avatar: { animal, background } as KidEntity['avatar'],
    startClass: 'KG2',
    birthYear: 2020,
    language: 'de-CH',
    pinHash: 'argon2id$secret',
    dailyLimitMinutes: 30,
    soundEnabled: false,
    readAloud: 'on',
    lastActiveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as KidEntity;

  it('exposes hasPin but never the hash, and defaults the accessory', () => {
    expect(toKidView(kid)).toEqual({
      id: 'k1',
      nickname: 'Zoë',
      avatar: { animal, accessory: null, background },
      startClass: 'KG2',
      birthYear: 2020,
      language: 'de-CH',
      hasPin: true,
      dailyLimitMinutes: 30,
      soundEnabled: false,
      readAloud: 'on',
    });
    expect(JSON.stringify(toKidView(kid))).not.toContain('argon2id');
  });

  it('reports no PIN', () => {
    expect(toKidView({ ...kid, pinHash: null }).hasPin).toBe(false);
  });
});
