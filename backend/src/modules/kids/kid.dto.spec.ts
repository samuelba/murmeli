import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActivateKidDto, CreateKidDto, UpdateKidDto } from './kid.dto';

type Dto = typeof CreateKidDto | typeof UpdateKidDto | typeof ActivateKidDto;

function check(dto: Dto, raw: Record<string, unknown>) {
  const instance = plainToInstance(dto, raw);
  return {
    instance,
    errors: validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).map((error) => error.property),
  };
}

const valid = {
  nickname: 'Zoë',
  avatar: { animal: 'marmot', accessory: null, background: '#FFD8A8' },
  startClass: 'KG1',
  language: 'de-CH',
};

describe('CreateKidDto', () => {
  it('accepts a minimal kid', () => {
    expect(check(CreateKidDto, valid).errors).toEqual([]);
  });

  it.each(['Léa', 'Jürg-Ueli', 'Anna 2', 'Ñandú', 'Zoë Müller'])(
    'accepts the nickname %s',
    (nickname) => {
      expect(check(CreateKidDto, { ...valid, nickname }).errors).toEqual([]);
    },
  );

  it.each(['', '   ', 'a'.repeat(21), 'Bob!', '<script>', 'x_y', 'Zoë😀'])(
    'rejects the nickname %p',
    (nickname) => {
      expect(check(CreateKidDto, { ...valid, nickname }).errors).toEqual([
        'nickname',
      ]);
    },
  );

  it('trims and NFC-normalizes the nickname', () => {
    const { instance, errors } = check(CreateKidDto, {
      ...valid,
      nickname: '  Zoë ',
    });

    expect(errors).toEqual([]);
    expect(instance.nickname).toBe('Zoë');
  });

  it.each([[[0, 8, 4, 4]], [[1, 1, 1, 1]]])('accepts the PIN %p', (pin) => {
    expect(check(CreateKidDto, { ...valid, pin }).errors).toEqual([]);
  });

  it.each([
    [[1, 2, 3]],
    [[1, 2, 3, 4, 5]],
    [[0, 1, 2, 9]],
    [[0, 1, 2, -1]],
    [['1', 2, 3, 4]],
    ['1234'],
  ])('rejects the PIN %p', (pin) => {
    expect(check(CreateKidDto, { ...valid, pin }).errors).toEqual(['pin']);
  });

  it('validates the optional settings', () => {
    expect(
      check(CreateKidDto, {
        ...valid,
        birthYear: 2019,
        dailyLimitMinutes: 30,
        soundEnabled: false,
        readAloud: 'off',
      }).errors,
    ).toEqual([]);
    expect(
      check(CreateKidDto, {
        ...valid,
        birthYear: 1999,
        dailyLimitMinutes: 1,
        soundEnabled: 'yes',
        readAloud: 'loud',
        startClass: '3',
        language: 'fr-CH',
      }).errors.sort(),
    ).toEqual(
      [
        'birthYear',
        'dailyLimitMinutes',
        'language',
        'readAloud',
        'soundEnabled',
        'startClass',
      ].sort(),
    );
  });

  it('validates the avatar shape', () => {
    expect(check(CreateKidDto, { ...valid, avatar: 'marmot' }).errors).toEqual([
      'avatar',
    ]);
    expect(
      check(CreateKidDto, {
        ...valid,
        avatar: { animal: 'marmot', accessory: 5, background: '#FFD8A8' },
      }).errors,
    ).toEqual(['avatar']);
  });

  it('rejects unknown fields', () => {
    expect(check(CreateKidDto, { ...valid, photo: 'x' }).errors).toEqual([
      'photo',
    ]);
  });
});

describe('UpdateKidDto', () => {
  it('accepts an empty patch and pin: null', () => {
    expect(check(UpdateKidDto, {}).errors).toEqual([]);
    expect(check(UpdateKidDto, { pin: null }).errors).toEqual([]);
    expect(
      check(UpdateKidDto, { birthYear: null, dailyLimitMinutes: null }).errors,
    ).toEqual([]);
  });

  it('rejects null for required fields', () => {
    expect(
      check(UpdateKidDto, {
        nickname: null,
        avatar: null,
        startClass: null,
        language: null,
        soundEnabled: null,
        readAloud: null,
      }).errors.sort(),
    ).toEqual(
      [
        'avatar',
        'language',
        'nickname',
        'readAloud',
        'soundEnabled',
        'startClass',
      ].sort(),
    );
  });

  it('validates present fields', () => {
    expect(check(UpdateKidDto, { pin: [1, 2] }).errors).toEqual(['pin']);
    expect(check(UpdateKidDto, { nickname: 'Max' }).errors).toEqual([]);
  });
});

describe('ActivateKidDto', () => {
  it('accepts no PIN or a PIN', () => {
    expect(check(ActivateKidDto, {}).errors).toEqual([]);
    expect(check(ActivateKidDto, { pin: [0, 1, 2, 3] }).errors).toEqual([]);
    expect(check(ActivateKidDto, { pin: [0] }).errors).toEqual(['pin']);
  });
});
