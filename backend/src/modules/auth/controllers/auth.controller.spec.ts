import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';

const request = {
  ip: '203.0.113.1',
  headers: { 'user-agent': 'jest' },
} as unknown as Request;
const response = {} as Response;
const meta = { ip: '203.0.113.1', userAgent: 'jest' };

function setup() {
  const deps = {
    settings: { isRegistrationEnabled: jest.fn().mockResolvedValue(true) },
    setupService: {
      isRequired: jest.fn().mockResolvedValue(false),
      tokenRequired: true,
      createFirstAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
    },
    login: {
      login: jest.fn().mockResolvedValue({ totpRequired: true }),
      verifyTotp: jest.fn().mockResolvedValue({ user: { id: 'u' } }),
    },
    sessionFlow: { refresh: jest.fn(), logout: jest.fn() },
    issuer: { signIn: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
    mailer: { enabled: false },
  };
  const controller = new AuthController(
    deps.settings as never,
    deps.setupService as never,
    deps.login as never,
    deps.sessionFlow as never,
    deps.issuer as never,
    deps.mailer as never,
  );
  return { controller, ...deps };
}

describe('AuthController', () => {
  it('reports the public config', async () => {
    const { controller } = setup();

    await expect(controller.config()).resolves.toEqual({
      registrationEnabled: true,
      emailEnabled: false,
      setupRequired: false,
      setupTokenRequired: true,
    });
  });

  it('creates the first admin and signs them in', async () => {
    const { controller, setupService, issuer } = setup();
    const dto = {
      email: 'a@example.com',
      password: 'p'.repeat(10),
      locale: 'de-CH' as const,
    };

    await expect(controller.setup(dto, request, response)).resolves.toEqual({
      user: { id: 'admin-1' },
    });
    expect(setupService.createFirstAdmin).toHaveBeenCalledWith(dto);
    expect(issuer.signIn).toHaveBeenCalledWith(
      response,
      { id: 'admin-1' },
      meta,
      'setup',
    );
  });

  it('delegates login and the TOTP step', async () => {
    const { controller, login } = setup();
    const dto = { email: 'a@example.com', password: 'pw' };

    await expect(controller.signIn(dto, request, response)).resolves.toEqual({
      totpRequired: true,
    });
    await expect(
      controller.verifyTotp({ code: '123456' }, request, response),
    ).resolves.toEqual({
      user: { id: 'u' },
    });
    expect(login.login).toHaveBeenCalledWith(dto, meta, response);
    expect(login.verifyTotp).toHaveBeenCalledWith(
      { code: '123456' },
      meta,
      request,
      response,
    );
  });

  it('refreshes and answers ok', async () => {
    const { controller, sessionFlow } = setup();

    await expect(controller.refresh(request, response)).resolves.toEqual({
      ok: true,
    });
    expect(sessionFlow.refresh).toHaveBeenCalledWith(request, response, meta);
  });

  it('logs out', async () => {
    const { controller, sessionFlow } = setup();

    await expect(controller.logout(request, response)).resolves.toBeUndefined();
    expect(sessionFlow.logout).toHaveBeenCalledWith(request, response, meta);
  });
});
