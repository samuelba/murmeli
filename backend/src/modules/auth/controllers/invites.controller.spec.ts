import type { Request, Response } from 'express';
import { InvitesController } from './invites.controller';

describe('InvitesController', () => {
  const request = { ip: '203.0.113.3', headers: {} } as unknown as Request;
  const response = {} as Response;

  function setup() {
    const invites = {
      details: jest.fn().mockResolvedValue({ email: 'g@example.com' }),
      accept: jest.fn().mockResolvedValue({ id: 'user-9' }),
    };
    const issuer = { signIn: jest.fn().mockResolvedValue({ id: 'user-9' }) };
    const controller = new InvitesController(invites as never, issuer as never);
    return { controller, invites, issuer };
  }

  it('shows invite details', async () => {
    const { controller, invites } = setup();

    await expect(controller.details('tok')).resolves.toEqual({
      email: 'g@example.com',
    });
    expect(invites.details).toHaveBeenCalledWith('tok');
  });

  it('accepts and signs the new user in', async () => {
    const { controller, invites, issuer } = setup();
    const dto = {
      password: 'p'.repeat(10),
      locale: 'de-CH' as const,
      acceptTerms: true as const,
    };

    await expect(
      controller.accept('tok', dto, request, response),
    ).resolves.toEqual({
      user: { id: 'user-9' },
    });
    expect(invites.accept).toHaveBeenCalledWith('tok', dto.password, 'de-CH');
    expect(issuer.signIn).toHaveBeenCalledWith(
      response,
      { id: 'user-9' },
      { ip: '203.0.113.3', userAgent: null },
      'invite',
    );
  });
});
