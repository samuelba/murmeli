import type { Request } from 'express';
import { TotpController } from './totp.controller';

const auth = { userId: 'u', familyId: 'f' };
const request = { ip: '192.0.2.8', headers: {} } as unknown as Request;
const actor = { userId: 'u', ip: '192.0.2.8' };

function setup() {
  const totp = {
    setup: jest
      .fn()
      .mockResolvedValue({ otpauthUrl: 'otpauth://x', qrDataUrl: 'data:' }),
    enable: jest.fn().mockResolvedValue(['A']),
    disable: jest.fn(),
    regenerateRecoveryCodes: jest.fn().mockResolvedValue(['B']),
  };
  return { controller: new TotpController(totp as never), totp };
}

describe('TotpController', () => {
  it('starts the setup', async () => {
    const { controller, totp } = setup();

    await expect(controller.setup(auth)).resolves.toEqual({
      otpauthUrl: 'otpauth://x',
      qrDataUrl: 'data:',
    });
    expect(totp.setup).toHaveBeenCalledWith('u');
  });

  it('wraps recovery codes from enable and regenerate', async () => {
    const { controller, totp } = setup();

    await expect(
      controller.enable(auth, { code: '123456' }, request),
    ).resolves.toEqual({
      recoveryCodes: ['A'],
    });
    await expect(
      controller.recoveryCodes(auth, { code: '654321' }),
    ).resolves.toEqual({
      recoveryCodes: ['B'],
    });
    expect(totp.enable).toHaveBeenCalledWith(actor, '123456');
    expect(totp.regenerateRecoveryCodes).toHaveBeenCalledWith('u', '654321');
  });

  it('disables', async () => {
    const { controller, totp } = setup();

    await controller.disable(auth, { password: 'pw', code: '123456' }, request);

    expect(totp.disable).toHaveBeenCalledWith(actor, 'pw', '123456');
  });
});
