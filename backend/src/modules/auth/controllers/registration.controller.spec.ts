import type { Request } from 'express';
import { RegistrationController } from './registration.controller';

const request = { ip: '198.51.100.2', headers: {} } as unknown as Request;
const meta = { ip: '198.51.100.2', userAgent: null };

function setup() {
  const registration = {
    register: jest.fn(),
    verifyEmail: jest.fn().mockResolvedValue('email_change'),
    resendVerification: jest.fn(),
  };
  const passwordReset = { requestReset: jest.fn(), reset: jest.fn() };
  const controller = new RegistrationController(
    registration as never,
    passwordReset as never,
  );
  return { controller, registration, passwordReset };
}

describe('RegistrationController', () => {
  const withAltcha = { email: 'a@example.com', altcha: 'x' };

  it('answers ok for register, resend and forgot', async () => {
    const { controller, registration, passwordReset } = setup();
    const dto = {
      ...withAltcha,
      password: 'p'.repeat(10),
      locale: 'en-US' as const,
      acceptTerms: true as const,
    };

    await expect(controller.register(dto)).resolves.toEqual({ ok: true });
    await expect(controller.resendVerification(withAltcha)).resolves.toEqual({
      ok: true,
    });
    await expect(controller.forgotPassword(withAltcha)).resolves.toEqual({
      ok: true,
    });
    expect(registration.register).toHaveBeenCalledWith(dto);
    expect(registration.resendVerification).toHaveBeenCalledWith(withAltcha);
    expect(passwordReset.requestReset).toHaveBeenCalledWith(withAltcha);
  });

  it('returns the verified token type', async () => {
    const { controller, registration } = setup();

    await expect(
      controller.verifyEmail({ token: 't' }, request),
    ).resolves.toEqual({
      ok: true,
      type: 'email_change',
    });
    expect(registration.verifyEmail).toHaveBeenCalledWith('t', meta);
  });

  it('resets the password', async () => {
    const { controller, passwordReset } = setup();
    const dto = { token: 't', password: 'p'.repeat(10) };

    await expect(controller.resetPassword(dto, request)).resolves.toEqual({
      ok: true,
    });
    expect(passwordReset.reset).toHaveBeenCalledWith(dto, meta);
  });
});
