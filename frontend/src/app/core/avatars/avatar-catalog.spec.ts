import {
  AVATAR_ACCESSORIES,
  AVATAR_ANIMALS,
  AVATAR_BACKGROUNDS,
  DEFAULT_AVATAR,
  accessoryUrl,
  animalName,
  animalUrl,
  isValidAvatar,
  randomAvatar,
} from './avatar-catalog';

describe('avatar catalog', () => {
  it('exposes the brand manifest', () => {
    expect(AVATAR_ANIMALS.length).toBe(30);
    expect(AVATAR_ACCESSORIES.length).toBe(8);
    expect(AVATAR_BACKGROUNDS.length).toBe(10);
    expect(isValidAvatar(DEFAULT_AVATAR)).toBe(true);
  });

  it('builds asset urls', () => {
    expect(animalUrl('fox')).toBe('/brand/avatars/fox.svg');
    expect(animalUrl('dodo')).toBeNull();
    expect(accessoryUrl('crown')).toBe('/brand/avatars/accessories/crown.svg');
    expect(accessoryUrl(null)).toBeNull();
  });

  it('names animals per language', () => {
    expect(animalName('fox', 'de-CH')).toBe('Fuchs');
    expect(animalName('fox', 'en-US')).toBe('Fox');
    expect(animalName('dodo', 'en-US')).toBe('dodo');
  });

  it.each([
    [{ animal: 'dodo', accessory: null, background: '#FFD8A8' }],
    [{ animal: 'fox', accessory: 'cape', background: '#FFD8A8' }],
    [{ animal: 'fox', accessory: null, background: '#000000' }],
  ])('rejects %j', (avatar) => {
    expect(isValidAvatar(avatar)).toBe(false);
  });

  it('creates valid random avatars', () => {
    expect(randomAvatar(() => 0.99)).toEqual({
      animal: 'octopus',
      accessory: null,
      background: AVATAR_BACKGROUNDS[9],
    });
  });
});
